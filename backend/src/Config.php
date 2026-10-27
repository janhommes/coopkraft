<?php
declare(strict_types=1);

namespace CoopKraft;

/** Konfiguration aus Umgebungsvariablen bzw. backend/.env (siehe .env.example). */
final class Config
{
    /** @param array<string,string> $values */
    private function __construct(private array $values)
    {
    }

    public static function load(string $envFile): self
    {
        $values = [];
        if (is_file($envFile)) {
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                    continue;
                }
                [$key, $value] = explode('=', $line, 2);
                $values[trim($key)] = trim(trim($value), "\"'");
            }
        }
        // Echte Umgebungsvariablen (z. B. Docker, CI) haben Vorrang vor .env
        foreach (getenv() as $key => $value) {
            $values[$key] = $value;
        }
        return new self($values);
    }

    /** @param array<string,string> $values */
    public static function fromArray(array $values): self
    {
        return new self($values);
    }

    public function get(string $key, ?string $default = null): ?string
    {
        $value = $this->values[$key] ?? null;
        return ($value === null || $value === '') ? $default : $value;
    }

    public function require(string $key): string
    {
        return $this->get($key) ?? throw new \RuntimeException("Konfiguration fehlt: $key");
    }

    public function bool(string $key, bool $default = false): bool
    {
        $value = $this->get($key);
        return $value === null ? $default : in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }

    /** Kommagetrennte Liste, kleingeschrieben (z. B. ADMIN_EMAILS). @return list<string> */
    public function list(string $key): array
    {
        $parts = array_map(fn ($s) => strtolower(trim($s)), explode(',', $this->get($key, '') ?? ''));
        return array_values(array_filter($parts, fn ($s) => $s !== ''));
    }
}
