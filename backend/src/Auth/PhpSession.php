<?php
declare(strict_types=1);

namespace CoopKraft\Auth;

/** Native PHP-Session; Cookie: HttpOnly, SameSite=Lax, Secure bei HTTPS. Startet erst bei Bedarf. */
final class PhpSession implements Session
{
    public function __construct(private bool $secure)
    {
    }

    private function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        session_name('coopkraft');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $this->secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    public function get(string $key): mixed
    {
        if (session_status() !== PHP_SESSION_ACTIVE && !isset($_COOKIE['coopkraft'])) {
            return null; // ohne Cookie keine Session anlegen
        }
        $this->start();
        return $_SESSION[$key] ?? null;
    }

    public function set(string $key, mixed $value): void
    {
        $this->start();
        $_SESSION[$key] = $value;
    }

    public function remove(string $key): void
    {
        $this->start();
        unset($_SESSION[$key]);
    }

    public function regenerate(): void
    {
        $this->start();
        session_regenerate_id(true);
    }

    public function destroy(): void
    {
        $this->start();
        $_SESSION = [];
        session_destroy();
        setcookie('coopkraft', '', ['expires' => 1, 'path' => '/', 'secure' => $this->secure, 'httponly' => true, 'samesite' => 'Lax']);
    }
}
