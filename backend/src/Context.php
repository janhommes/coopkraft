<?php
declare(strict_types=1);

namespace CoopKraft;

use CoopKraft\Auth\Auth;
use CoopKraft\Auth\PhpSession;
use CoopKraft\Auth\Session;
use PDO;

/** Request-übergreifende Dienste, lazy aufgebaut (keine DB-Verbindung, solange sie nicht gebraucht wird). */
final class Context
{
    private ?PDO $pdo = null;
    private ?Repo $repo = null;
    private ?Auth $auth = null;
    private ?Session $session;

    public function __construct(public readonly Config $config, ?PDO $pdo = null, ?Session $session = null)
    {
        $this->pdo = $pdo;
        $this->session = $session;
    }

    public function pdo(): PDO
    {
        return $this->pdo ??= Db::connect($this->config);
    }

    public function repo(): Repo
    {
        return $this->repo ??= new Repo($this->pdo());
    }

    public function session(): Session
    {
        return $this->session ??= new PhpSession(secure: $this->config->bool('COOKIE_SECURE', true));
    }

    public function auth(): Auth
    {
        return $this->auth ??= new Auth($this->session(), $this->repo(), $this->config);
    }

    public function acl(): Acl
    {
        return new Acl($this->auth()->user(), $this->repo());
    }

    public function migrator(): Migrator
    {
        $root = dirname(__DIR__);
        // Im Deploy-Paket liegt schema.sql neben src/, im Repository unter docs/
        $schema = $this->config->get('SCHEMA_FILE')
            ?? (is_file("$root/schema.sql") ? "$root/schema.sql" : dirname($root) . '/docs/schema.sql');
        return new Migrator($this->pdo(), $schema, "$root/migrations");
    }
}
