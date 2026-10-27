<?php
declare(strict_types=1);

namespace CoopKraft\Auth;

/** Sitzungsspeicher. PHP-Sessions im Betrieb, ein Array in Tests. */
interface Session
{
    public function get(string $key): mixed;

    public function set(string $key, mixed $value): void;

    public function remove(string $key): void;

    /** Neue Session-ID nach dem Login (Session Fixation). */
    public function regenerate(): void;

    public function destroy(): void;
}
