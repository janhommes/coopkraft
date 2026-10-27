<?php
declare(strict_types=1);

namespace CoopKraft\Auth;

/** Sitzung im Speicher (Tests). */
final class ArraySession implements Session
{
    /** @param array<string,mixed> $data */
    public function __construct(public array $data = [])
    {
    }

    public function get(string $key): mixed
    {
        return $this->data[$key] ?? null;
    }

    public function set(string $key, mixed $value): void
    {
        $this->data[$key] = $value;
    }

    public function remove(string $key): void
    {
        unset($this->data[$key]);
    }

    public function regenerate(): void
    {
    }

    public function destroy(): void
    {
        $this->data = [];
    }
}
