<?php
declare(strict_types=1);

namespace CoopKraft\Tests;

use CoopKraft\Tables;

final class ApiTest extends ApiTestCase
{
    public function testAdminSeesCountsForAllStores(): void
    {
        $this->loginAs('root@demo.de');
        $response = $this->request('GET', '/admin/counts');
        self::assertSame(200, $response->getStatusCode());
        // Der Login selbst legt den users-Datensatz an
        self::assertSame(['users' => 1] + array_fill_keys(Tables::stores(), 0), self::json($response));
    }

    public function testUnknownStoreIs404(): void
    {
        $this->loginAs('root@demo.de');
        self::assertSame(404, $this->request('GET', '/data/nope')->getStatusCode());
        self::assertSame(404, $this->request('GET', '/data/documentFiles')->getStatusCode());
    }

    public function testWritesNeedAppHeader(): void
    {
        $this->loginAs('root@demo.de');
        $response = $this->request('PUT', '/data/campaigns/c1', ['id' => 'c1'], headers: []);
        self::assertSame(403, $response->getStatusCode());
        self::assertSame(204, $this->request('PUT', '/data/campaigns/c1', ['id' => 'c1'])->getStatusCode());
    }

    public function testIdInBodyMustMatchPath(): void
    {
        $this->loginAs('root@demo.de');
        self::assertSame(400, $this->request('PUT', '/data/campaigns/c1', ['id' => 'c2'])->getStatusCode());
    }

    public function testMeResolvesRolesFromGroupsOverridesAndAdminEmails(): void
    {
        self::assertSame(['user' => null], self::json($this->request('GET', '/me')));

        $this->loginAs('root@demo.de');
        self::assertSame(['admin'], self::json($this->request('GET', '/me'))['user']['roles']);

        $this->loginAs('v@demo.de', ['egv-vorstand'], 'Vera');
        $user = self::json($this->request('GET', '/me'))['user'];
        self::assertSame(['vorstand', 'mitgliedsbestaetiger'], $user['roles']);
        self::assertSame('Vera', $user['name']);
        $record = $this->context()->repo()->findBy('users', 'email', 'v@demo.de')[0];
        self::assertSame(['egv-vorstand'], $record->groups);
        self::assertNotEmpty($record->lastLoginAt);

        // Gespeicherte Rollen bleiben beim nächsten Login als Override erhalten
        $record->roles = ['kommunikation'];
        $this->context()->repo()->upsert('users', $record);
        $this->loginAs('v@demo.de', ['egv-vorstand'], 'Vera');
        self::assertSame(['kommunikation', 'vorstand', 'mitgliedsbestaetiger'], self::json($this->request('GET', '/me'))['user']['roles']);
    }

    public function testMemberRoleComesFromActiveMemberEmail(): void
    {
        $this->seed('members', self::member('m-anna', 'anna@demo.de', 'active', 1001));
        $this->loginAs('Anna@Demo.de');
        $user = self::json($this->request('GET', '/me'))['user'];
        self::assertSame(['mitglied'], $user['roles']);
        self::assertSame('m-anna', $user['memberId']);
    }

    public function testSsoMappingFromSettingsIsUsed(): void
    {
        $this->seed('settings', ['id' => 'sso', 'data' => [
            'claim' => 'groups', 'unknownPolicy' => 'deny',
            'mappings' => [['group' => 'kasse', 'roles' => ['auszahler']]],
        ]]);
        $this->loginAs('k@demo.de', ['kasse', 'egv-admin']);
        self::assertSame(['auszahler'], self::json($this->request('GET', '/me'))['user']['roles']);
    }

    public function testAnonymousSeesOnlyPublicData(): void
    {
        $this->seedSettings();
        $this->seed('settings', ['id' => 'sso', 'data' => ['claim' => 'groups']]);
        $this->seed('members', self::member('m1', 'a@demo.de', 'active', 1001));
        $this->seed('customFields', ['id' => 'f1', 'key' => 'x', 'label' => 'X', 'type' => 'text', 'required' => false, 'showOnSignup' => true]);
        foreach (['public', 'members', 'internal'] as $visibility) {
            $this->seed('documents', ['id' => "d-$visibility", 'visibility' => $visibility, 'title' => $visibility]);
        }
        $this->context()->repo()->putFile('d-public', 'application/pdf', 'PUBLIC');
        $this->context()->repo()->putFile('d-internal', 'application/pdf', 'SECRET');

        $settings = self::json($this->request('GET', '/data/settings'));
        self::assertCount(1, $settings);
        self::assertSame('Test eG', $settings[0]['data']['genossenschaftsName']);
        self::assertArrayNotHasKey('bank', $settings[0]['data']);
        self::assertSame(404, $this->request('GET', '/data/settings/sso')->getStatusCode());

        self::assertSame([], self::json($this->request('GET', '/data/members')));
        self::assertCount(1, self::json($this->request('GET', '/data/customFields')));
        self::assertSame(['d-public'], array_column(self::json($this->request('GET', '/data/documents')), 'id'));
        self::assertSame('PUBLIC', (string) $this->request('GET', '/files/d-public')->getBody());
        self::assertSame(404, $this->request('GET', '/files/d-internal')->getStatusCode());
        self::assertSame(401, $this->request('PUT', '/data/members/m1', self::member('m1', 'a@demo.de', 'active', 1001))->getStatusCode());
    }

    public function testStaffWritesDataButNotConfiguration(): void
    {
        $this->loginAs('v@demo.de', ['egv-vorstand']);
        self::assertSame(204, $this->request('PUT', '/data/members/m1', self::member('m1', 'a@demo.de', 'pending', 1001))->getStatusCode());
        self::assertSame('pending', $this->stored('members', 'm1')['status']);
        self::assertEquals(1, self::$pdo->query("SELECT COUNT(*) FROM members WHERE status = 'pending' AND mitgliedsnummer = 1001")->fetchColumn());

        self::assertSame(403, $this->request('PUT', '/data/settings/singleton', ['id' => 'singleton', 'data' => []])->getStatusCode());
        self::assertSame(403, $this->request('PUT', '/data/users/u1', ['id' => 'u1'])->getStatusCode());
        self::assertSame(403, $this->request('DELETE', '/data/members/m1')->getStatusCode());

        $this->seed('documents', ['id' => 'd1', 'visibility' => 'internal']);
        self::assertSame(204, $this->request('DELETE', '/data/documents/d1')->getStatusCode());
        self::assertNull($this->stored('documents', 'd1'));
    }

    public function testDuplicateMitgliedsnummerIsConflict(): void
    {
        $this->loginAs('v@demo.de', ['egv-verwaltung']);
        $this->request('PUT', '/data/members/m1', self::member('m1', 'a@demo.de', 'active', 1001));
        self::assertSame(409, $this->request('PUT', '/data/members/m2', self::member('m2', 'b@demo.de', 'active', 1001))->getStatusCode());
    }

    public function testEmptyObjectsSurviveRoundtrip(): void
    {
        $this->loginAs('v@demo.de', ['egv-verwaltung']);
        $this->request('PUT', '/data/members/m1', self::member('m1', 'a@demo.de', 'active', 1001));
        $body = (string) $this->request('GET', '/data/members/m1')->getBody();
        self::assertStringContainsString('"customFields":{}', $body);
    }

    private function seedTwoMembers(): void
    {
        $this->seed('members', self::member('m-anna', 'anna@demo.de', 'active', 1001));
        $this->seed('members', self::member('m-bob', 'bob@demo.de', 'active', 1002));
        $this->seed('members', self::member('m-new', 'new@demo.de', 'pending', 1003));
        $this->seed('shareLots', ['id' => 'l-anna', 'memberId' => 'm-anna', 'count' => 2, 'valuePerShare' => 100, 'status' => 'active']);
        $this->seed('shareLots', ['id' => 'l-bob', 'memberId' => 'm-bob', 'count' => 1, 'valuePerShare' => 100, 'status' => 'active']);
    }

    public function testMemberSeesOwnDataAndMemberList(): void
    {
        $this->seedTwoMembers();
        $this->seed('dividends', ['id' => 'r1', 'fiscalYear' => 2025, 'totalAmount' => 30, 'totals' => ['gross' => 30],
            'items' => [['memberId' => 'm-anna', 'lotId' => 'l-anna', 'amount' => 10], ['memberId' => 'm-bob', 'lotId' => 'l-bob', 'amount' => 20]],
            'certificates' => ['m-anna' => 'doc-a', 'm-bob' => 'doc-b']]);
        $this->seed('documents', ['id' => 'g-members', 'visibility' => 'members']);
        $this->seed('documents', ['id' => 'g-internal', 'visibility' => 'internal']);
        $this->seed('documents', ['id' => 'own-visible', 'memberId' => 'm-anna', 'visibility' => 'internal', 'visibleToMember' => true]);
        $this->seed('documents', ['id' => 'own-hidden', 'memberId' => 'm-anna', 'visibility' => 'internal']);
        $this->seed('documents', ['id' => 'bob-doc', 'memberId' => 'm-bob', 'visibility' => 'internal', 'visibleToMember' => true]);
        $this->seed('campaigns', ['id' => 'c1']);
        $this->loginAs('anna@demo.de');

        $members = array_column(self::json($this->request('GET', '/data/members')), null, 'id');
        self::assertSame(['m-anna', 'm-bob'], array_keys($members));
        self::assertSame('DE02120300000000202051', $members['m-anna']['iban']);
        self::assertSame(['id', 'mitgliedsnummer', 'status', 'typ', 'anrede', 'vorname', 'nachname', 'customFields'], array_keys($members['m-bob']));
        self::assertSame(404, $this->request('GET', '/data/members/m-new')->getStatusCode());

        self::assertSame(['l-anna'], array_column(self::json($this->request('GET', '/data/shareLots')), 'id'));
        self::assertSame([], self::json($this->request('GET', '/data/campaigns')));
        self::assertSame(['g-members', 'own-visible'], array_column(self::json($this->request('GET', '/data/documents')), 'id'));

        $runs = self::json($this->request('GET', '/data/dividends'));
        self::assertSame([['memberId' => 'm-anna', 'lotId' => 'l-anna', 'amount' => 10]], $runs[0]['items']);
        self::assertSame(['m-anna' => 'doc-a'], $runs[0]['certificates']);
        self::assertEquals(10, $runs[0]['totalAmount']);
        self::assertArrayNotHasKey('totals', $runs[0]);
    }

    public function testMemberSelfServiceWrites(): void
    {
        $this->seedTwoMembers();
        $this->loginAs('anna@demo.de');

        // Stammdaten ändern, geschützte Felder bleiben
        $changed = self::member('m-anna', 'evil@demo.de', 'active', 9999);
        $changed['vorname'] = 'Annabelle';
        $changed['status'] = 'terminated';
        self::assertSame(204, $this->request('PUT', '/data/members/m-anna', $changed)->getStatusCode());
        $stored = $this->stored('members', 'm-anna');
        self::assertSame(['Annabelle', 'active', 1001, 'anna@demo.de'], [$stored['vorname'], $stored['status'], $stored['mitgliedsnummer'], $stored['email']]);
        self::assertSame(403, $this->request('PUT', '/data/members/m-bob', self::member('m-bob', 'bob@demo.de', 'active', 1002))->getStatusCode());

        // Anteile zeichnen: nur eigener, unbezahlter, neuer Lot
        $lot = ['id' => 'l-new', 'memberId' => 'm-anna', 'count' => 1, 'valuePerShare' => 100, 'status' => 'pending_payment'];
        self::assertSame(204, $this->request('PUT', '/data/shareLots/l-new', $lot)->getStatusCode());
        self::assertSame(403, $this->request('PUT', '/data/shareLots/l-new', ['status' => 'active'] + $lot)->getStatusCode());
        self::assertSame(403, $this->request('PUT', '/data/shareLots/l-x', ['id' => 'l-x', 'memberId' => 'm-bob'] + $lot)->getStatusCode());
        self::assertSame(403, $this->request('PUT', '/data/shareLots/l-y', ['id' => 'l-y', 'status' => 'active'] + $lot)->getStatusCode());

        // Übertragung nur aus eigenem Lot
        $transfer = ['id' => 't1', 'fromMemberId' => 'm-anna', 'fromLotId' => 'l-anna', 'toMemberId' => 'm-bob', 'count' => 1, 'status' => 'pending'];
        self::assertSame(204, $this->request('PUT', '/data/shareTransfers/t1', $transfer)->getStatusCode());
        self::assertSame(403, $this->request('PUT', '/data/shareTransfers/t2', ['id' => 't2', 'fromLotId' => 'l-bob'] + $transfer)->getStatusCode());

        // Kündigung beantragen und zurückziehen, aber nicht selbst genehmigen
        $termination = ['id' => 'k1', 'target' => 'membership', 'memberId' => 'm-anna', 'status' => 'pending', 'approvals' => []];
        self::assertSame(204, $this->request('PUT', '/data/terminations/k1', $termination)->getStatusCode());
        self::assertSame(403, $this->request('PUT', '/data/terminations/k1', ['status' => 'approved'] + $termination)->getStatusCode());
        self::assertSame(204, $this->request('PUT', '/data/terminations/k1', ['status' => 'cancelled', 'reason' => 'x'] + $termination)->getStatusCode());
        $stored = $this->stored('terminations', 'k1');
        self::assertSame('cancelled', $stored['status']);
        self::assertArrayNotHasKey('reason', $stored);

        self::assertSame(403, $this->request('PUT', '/data/approvals/a1', ['id' => 'a1', 'memberId' => 'm-anna'])->getStatusCode());
        self::assertSame(403, $this->request('DELETE', '/data/shareLots/l-new')->getStatusCode());
    }

    public function testUnmappedUserHasNoAccess(): void
    {
        $this->seedTwoMembers();
        $this->loginAs('fremd@demo.de', ['irgendwas']);
        self::assertSame([], self::json($this->request('GET', '/me'))['user']['roles']);
        self::assertSame([], self::json($this->request('GET', '/data/members')));
        self::assertSame(403, $this->request('PUT', '/data/shareLots/l1', ['id' => 'l1'])->getStatusCode());
    }

    public function testAuditEntriesAreStampedAndAppendOnly(): void
    {
        $this->seedTwoMembers();
        $this->loginAs('anna@demo.de', [], 'Anna');
        $entry = ['id' => 'e1', 'memberId' => 'm-anna', 'userId' => 'u-greta', 'userName' => 'Greta Admin', 'action' => 'x', 'at' => '2000-01-01T00:00:00.000Z'];
        self::assertSame(204, $this->request('PUT', '/data/auditLog/e1', $entry)->getStatusCode());
        $stored = $this->stored('auditLog', 'e1');
        self::assertSame('Anna', $stored['userName']);
        self::assertNotSame('2000-01-01T00:00:00.000Z', $stored['at']);
        self::assertSame(403, $this->request('PUT', '/data/auditLog/e1', $entry)->getStatusCode());
        self::assertSame(403, $this->request('PUT', '/data/auditLog/e2', ['id' => 'e2', 'memberId' => 'm-bob'] + $entry)->getStatusCode());
    }

    public function testFilesFollowDocumentVisibility(): void
    {
        $this->seedTwoMembers();
        $this->seed('documents', ['id' => 'own', 'memberId' => 'm-anna', 'visibility' => 'internal', 'visibleToMember' => true]);
        $this->seed('documents', ['id' => 'bob', 'memberId' => 'm-bob', 'visibility' => 'internal', 'visibleToMember' => true]);

        $this->loginAs('v@demo.de', ['egv-vorstand']);
        foreach (['own', 'bob'] as $id) {
            self::assertSame(204, $this->request('PUT', "/files/$id", "PDF-$id", ['X-Requested-With' => 'coopkraft', 'Content-Type' => 'application/pdf'])->getStatusCode());
        }

        $this->loginAs('anna@demo.de');
        $response = $this->request('GET', '/files/own');
        self::assertSame('PDF-own', (string) $response->getBody());
        self::assertSame('application/pdf', $response->getHeaderLine('Content-Type'));
        self::assertSame(404, $this->request('GET', '/files/bob')->getStatusCode());
        self::assertSame(403, $this->request('PUT', '/files/own', 'x')->getStatusCode());
    }

    public function testAnmeldungCreatesPendingMemberWithLot(): void
    {
        $this->seedSettings();
        $this->seed('members', self::member('m1', 'a@demo.de', 'active', 1041));
        $input = ['typ' => 'Privatperson', 'anrede' => 'Frau', 'vorname' => 'Nora', 'nachname' => 'Neu', 'email' => ' nora@demo.de ',
            'strasse' => 'Weg', 'hausnummer' => '2', 'plz' => '41747', 'ort' => 'Viersen', 'land' => 'DE', 'newsletter' => true,
            'customFields' => new \stdClass(), 'anteile' => 3, 'status' => 'active', 'mitgliedsnummer' => 1];

        $response = $this->request('POST', '/public/anmeldung', $input);
        self::assertSame(201, $response->getStatusCode());
        $member = self::json($response);
        self::assertSame([1042, 'pending', 'nora@demo.de'], [$member['mitgliedsnummer'], $member['status'], $member['email']]);
        self::assertStringContainsString('"customFields":{}', (string) $response->getBody());

        $lots = $this->context()->repo()->findBy('shareLots', 'member_id', $member['id']);
        self::assertCount(1, $lots);
        self::assertSame([3, 100, 'pending_payment'], [$lots[0]->count, $lots[0]->valuePerShare, $lots[0]->status]);
        self::assertCount(2, $this->context()->repo()->findBy('auditLog', 'member_id', $member['id']));

        self::assertSame(1043, self::json($this->request('POST', '/public/anmeldung', ['email' => 'b@demo.de'] + $input))['mitgliedsnummer']);
        self::assertSame(400, $this->request('POST', '/public/anmeldung', ['anteile' => 11] + $input)->getStatusCode());
        self::assertSame(400, $this->request('POST', '/public/anmeldung', ['vorname' => ' '] + $input)->getStatusCode());
        self::assertSame(400, $this->request('POST', '/public/anmeldung', ['email' => 'kaputt'] + $input)->getStatusCode());
    }

    public function testBackupRestoreRoundtrip(): void
    {
        $this->seedTwoMembers();
        $this->seedSettings();
        $this->seed('documents', ['id' => 'd1', 'visibility' => 'public']);
        $this->context()->repo()->putFile('d1', 'application/pdf', "%PDF-\x00\xff binär");
        $this->loginAs('root@demo.de');

        // Roh weitergeben wie die App: json_decode(..., true) würde {} zu [] machen
        $original = (string) $this->request('GET', '/admin/backup')->getBody();
        $backup = json_decode($original, true);
        self::assertSame('egv-backup', $backup['format']);
        self::assertSame(['id' => 'd1', 'dataUrl' => 'data:application/pdf;base64,' . base64_encode("%PDF-\x00\xff binär")], $backup['tables']['documentFiles'][0]);

        // Daten ändern, dann Sicherung zurückspielen
        $this->request('DELETE', '/data/members/m-bob');
        $this->request('PUT', '/data/campaigns/c-neu', ['id' => 'c-neu']);
        $raw = (string) $this->request('GET', '/admin/backup')->getBody();
        self::assertStringContainsString('c-neu', $raw);

        self::assertSame(204, $this->request('POST', '/admin/restore', $original)->getStatusCode());
        $counts = self::json($this->request('GET', '/admin/counts'));
        self::assertSame([3, 2, 0, 1, 1], [$counts['members'], $counts['shareLots'], $counts['campaigns'], $counts['documentFiles'], $counts['settings']]);
        self::assertSame("%PDF-\x00\xff binär", $this->context()->repo()->getFile('d1')['content']);
        self::assertStringContainsString('"customFields":{}', (string) $this->request('GET', '/data/members/m-anna')->getBody());

        self::assertSame(400, $this->request('POST', '/admin/restore', ['format' => 'anders'])->getStatusCode());
        $this->loginAs('v@demo.de', ['egv-vorstand']);
        self::assertSame(403, $this->request('GET', '/admin/backup')->getStatusCode());
    }

    public function testDevLoginFormAndLogout(): void
    {
        $response = $this->request('GET', '/auth/login?returnTo=/app/dashboard');
        self::assertStringContainsString('SSO simulieren', (string) $response->getBody());

        $request = (new \Slim\Psr7\Factory\ServerRequestFactory())->createServerRequest('POST', '/api/auth/dev-login')
            ->withHeader('Content-Type', 'application/x-www-form-urlencoded');
        $request->getBody()->write(http_build_query(['email' => 'root@demo.de', 'groups' => 'egv-admin, x', 'returnTo' => '//evil.example']));
        $response = \CoopKraft\App::create($this->context())->handle($request);
        self::assertSame(302, $response->getStatusCode());
        self::assertSame('/', $response->getHeaderLine('Location'));
        self::assertSame(['egv-admin', 'x'], $this->session->get('identity')['groups']);

        self::assertSame(204, $this->request('POST', '/auth/logout')->getStatusCode());
        self::assertSame(['user' => null], self::json($this->request('GET', '/me')));
    }

    public function testDevLoginIsDisabledOutsideDevMode(): void
    {
        $request = (new \Slim\Psr7\Factory\ServerRequestFactory())->createServerRequest('POST', '/api/auth/dev-login')
            ->withHeader('Content-Type', 'application/x-www-form-urlencoded');
        $request->getBody()->write('email=root@demo.de');
        $response = \CoopKraft\App::create($this->context(['AUTH_MODE' => 'oidc']))->handle($request);
        self::assertSame(404, $response->getStatusCode());
        self::assertNull($this->session->get('identity'));
    }
}
