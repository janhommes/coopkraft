<?php
declare(strict_types=1);

namespace CoopKraft\Tests;

use CoopKraft\App;
use CoopKraft\Auth\ArraySession;
use CoopKraft\Config;
use CoopKraft\Context;
use CoopKraft\Db;
use CoopKraft\Json;
use CoopKraft\Tables;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Slim\Psr7\Factory\ServerRequestFactory;

/**
 * Tests gegen eine echte MariaDB (TEST_DB_NAME, Standard coopkraft_test) über die Slim-App,
 * also inklusive Routing, Middleware, Migration und Berechtigungen.
 */
abstract class ApiTestCase extends TestCase
{
    protected static PDO $pdo;
    protected ArraySession $session;

    protected static function config(array $overrides = []): Config
    {
        return Config::fromArray($overrides + [
            'DB_HOST' => getenv('DB_HOST') ?: '127.0.0.1',
            'DB_PORT' => getenv('DB_PORT') ?: '3306',
            'DB_NAME' => getenv('TEST_DB_NAME') ?: 'coopkraft_test',
            'DB_USER' => getenv('DB_USER') ?: 'coopkraft',
            'DB_PASSWORD' => getenv('DB_PASSWORD') ?: 'coopkraft',
            'AUTH_MODE' => 'dev',
            'ADMIN_EMAILS' => 'root@demo.de',
            'APP_DEBUG' => 'true',
        ]);
    }

    public static function setUpBeforeClass(): void
    {
        self::$pdo = Db::connect(self::config());
        foreach (self::$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
            self::$pdo->exec("DROP TABLE `$table`");
        }
    }

    protected function setUp(): void
    {
        $this->session = new ArraySession();
        $ctx = $this->context();
        $ctx->migrator()->migrateIfNeeded();
        foreach (Tables::stores() as $store) {
            $ctx->repo()->clear($store);
        }
    }

    protected function context(array $config = []): Context
    {
        return new Context(self::config($config), self::$pdo, $this->session);
    }

    /** Ein Request durch die komplette App (neuer Kontext je Request, gemeinsame Session). */
    protected function request(string $method, string $path, mixed $body = null, array $headers = ['X-Requested-With' => 'coopkraft']): ResponseInterface
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, '/api' . $path);
        if ($body !== null) {
            $request->getBody()->write(is_string($body) ? $body : Json::encode($body));
            $request = $request->withHeader('Content-Type', 'application/json');
        }
        foreach ($headers as $name => $value) {
            $request = $request->withHeader($name, $value);
        }
        return App::create($this->context())->handle($request);
    }

    protected static function json(ResponseInterface $response): mixed
    {
        return json_decode((string) $response->getBody(), true);
    }

    protected function loginAs(string $email, array $groups = [], string $name = 'Test'): void
    {
        $this->session = new ArraySession();
        $this->context()->auth()->login(['sub' => $email, 'email' => $email, 'name' => $name, 'groups' => $groups]);
    }

    protected function logout(): void
    {
        $this->session = new ArraySession();
    }

    protected function seed(string $store, array $row): void
    {
        $this->context()->repo()->upsert($store, Json::decode(Json::encode($row)));
    }

    protected function stored(string $store, string $id): ?array
    {
        $row = $this->context()->repo()->get($store, $id);
        return $row === null ? null : Json::toArray($row);
    }

    protected function seedSettings(): void
    {
        $this->seed('settings', ['id' => 'singleton', 'data' => [
            'genossenschaftsName' => 'Test eG', 'primary' => '#000', 'accent' => '#111',
            'anteilsWert' => 100, 'minAnteile' => 1, 'maxAnteile' => 10,
            'bank' => ['iban' => 'DE89370400440532013000'], 'signup' => ['layout' => 'single'],
        ]]);
    }

    protected static function member(string $id, string $email, string $status, int $nummer): array
    {
        return [
            'id' => $id, 'mitgliedsnummer' => $nummer, 'status' => $status, 'typ' => 'Privatperson',
            'anrede' => 'Keine', 'vorname' => ucfirst(explode('@', $email)[0]), 'nachname' => 'Test',
            'email' => $email, 'iban' => 'DE02120300000000202051', 'strasse' => 'Weg', 'hausnummer' => '1',
            'plz' => '41747', 'ort' => 'Viersen', 'land' => 'DE', 'newsletter' => false, 'customFields' => new \stdClass(),
            'createdAt' => '2026-01-01T00:00:00.000Z', 'updatedAt' => '2026-01-01T00:00:00.000Z',
        ];
    }
}
