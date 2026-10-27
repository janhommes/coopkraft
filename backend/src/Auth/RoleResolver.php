<?php
declare(strict_types=1);

namespace CoopKraft\Auth;

/**
 * PHP-Fassung von resolveRoles() aus src/lib/sso.ts. Beide müssen sich gleich verhalten:
 * tests/fixtures/resolve-roles.json wird von PHPUnit UND scripts/check-contract.mjs geprüft.
 * DEFAULT_CONFIG entspricht DEFAULT_SSO_CONFIG (Fixture tests/fixtures/sso-default.json).
 */
final class RoleResolver
{
    public const DEFAULT_CONFIG = [
        'claim' => 'groups',
        'unknownPolicy' => 'deny',
        'mappings' => [
            ['group' => 'egv-admin', 'roles' => ['admin']],
            ['group' => 'egv-vorstand', 'roles' => ['vorstand', 'mitgliedsbestaetiger']],
            ['group' => 'egv-aufsichtsrat', 'roles' => ['aufsichtsrat']],
            ['group' => 'egv-verwaltung', 'roles' => ['mitgliederverwalter']],
            ['group' => 'egv-finanzen', 'roles' => ['zahlungspruefer', 'auszahler']],
            ['group' => 'egv-kommunikation', 'roles' => ['kommunikation']],
        ],
    ];

    /**
     * @param array{email: string, groups: list<string>} $identity
     * @param array{claim?: string, unknownPolicy?: string, mappings?: list<array{group: string, roles: list<string>}>} $config
     * @param iterable<object|array> $members Mitglieder (mindestens id, email, status)
     * @param list<string> $overrides gespeicherte Zusatzrollen (users.roles)
     * @return array{roles: list<string>, memberId: ?string}
     */
    public static function resolve(array $identity, array $config, iterable $members, array $overrides = []): array
    {
        $roles = [];
        $add = function (string $role) use (&$roles): void {
            if (!in_array($role, $roles, true)) {
                $roles[] = $role;
            }
        };
        foreach ($overrides as $role) {
            $add($role);
        }
        $groups = array_map(fn ($g) => strtolower(trim((string) $g)), $identity['groups']);
        foreach ($config['mappings'] ?? [] as $mapping) {
            if (in_array(strtolower(trim((string) $mapping['group'])), $groups, true)) {
                foreach ($mapping['roles'] as $role) {
                    $add($role);
                }
            }
        }
        $email = strtolower(trim($identity['email']));
        $memberId = null;
        foreach ($members as $m) {
            $m = (object) $m;
            $status = $m->status ?? null;
            if (isset($m->email) && strtolower((string) $m->email) === $email && ($status === 'active' || $status === 'terminating')) {
                $memberId = (string) $m->id;
                break;
            }
        }
        if ($memberId !== null) {
            $add('mitglied');
        }
        if ($roles === [] && ($config['unknownPolicy'] ?? 'deny') === 'mitglied') {
            $add('mitglied');
        }
        return ['roles' => $roles, 'memberId' => $memberId];
    }

    /** Gruppen aus dem Token-Claim: Liste oder komma-/leerzeichengetrennter String. @return list<string> */
    public static function groupsFromClaim(mixed $value): array
    {
        if (is_string($value)) {
            $value = preg_split('/[\s,]+/', $value) ?: [];
        }
        if (!is_array($value)) {
            return [];
        }
        $groups = array_filter(array_map(fn ($g) => is_scalar($g) ? trim((string) $g) : '', $value), fn ($g) => $g !== '');
        return array_values($groups);
    }
}
