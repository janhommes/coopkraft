<?php
declare(strict_types=1);

namespace CoopKraft;

use PDO;

/**
 * Hält die Datenbank auf dem Stand von docs/schema.sql + backend/migrations/*.sql.
 * Läuft bei jedem Request als Prüfung (eine kleine Abfrage), weil Shared Hosting per FTP
 * keine Shell für Migrationen hat. Änderungen werden unter einer DB-Sperre eingespielt.
 */
final class Migrator
{
    private const STATE_ID = '__state__';

    public function __construct(private PDO $pdo, private string $schemaFile, private string $migrationsDir)
    {
    }

    public function migrateIfNeeded(): void
    {
        $checksum = $this->checksum();
        if ($this->appliedChecksum() === $checksum) {
            return;
        }
        $this->pdo->query("SELECT GET_LOCK('coopkraft_migrate', 30)");
        try {
            if ($this->appliedChecksum() === $checksum) {
                return;
            }
            $this->pdo->exec('CREATE TABLE IF NOT EXISTS _migrations (
                id VARCHAR(191) NOT NULL PRIMARY KEY,
                checksum VARCHAR(64) NULL,
                applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

            foreach (self::statements((string) file_get_contents($this->schemaFile)) as $sql) {
                $this->pdo->exec($sql);
            }
            $applied = $this->pdo->query('SELECT id FROM _migrations')->fetchAll(PDO::FETCH_COLUMN);
            foreach ($this->migrationFiles() as $name => $path) {
                if (in_array($name, $applied, true)) {
                    continue;
                }
                foreach (self::statements((string) file_get_contents($path)) as $sql) {
                    $this->pdo->exec($sql);
                }
                $this->pdo->prepare('INSERT INTO _migrations (id) VALUES (?)')->execute([$name]);
            }
            $this->pdo->prepare('REPLACE INTO _migrations (id, checksum) VALUES (?, ?)')->execute([self::STATE_ID, $checksum]);
        } finally {
            $this->pdo->query("SELECT RELEASE_LOCK('coopkraft_migrate')");
        }
    }

    private function appliedChecksum(): ?string
    {
        try {
            $stmt = $this->pdo->prepare('SELECT checksum FROM _migrations WHERE id = ?');
            $stmt->execute([self::STATE_ID]);
            $value = $stmt->fetchColumn();
            return $value === false ? null : (string) $value;
        } catch (\PDOException) {
            return null; // Tabelle existiert noch nicht
        }
    }

    private function checksum(): string
    {
        $parts = [(string) @file_get_contents($this->schemaFile)];
        foreach ($this->migrationFiles() as $name => $path) {
            $parts[] = $name . "\n" . file_get_contents($path);
        }
        return hash('sha256', implode("\n--\n", $parts));
    }

    /** @return array<string,string> Dateiname => Pfad, sortiert */
    private function migrationFiles(): array
    {
        $files = glob(rtrim($this->migrationsDir, '/') . '/*.sql') ?: [];
        sort($files);
        $out = [];
        foreach ($files as $path) {
            $out[basename($path)] = $path;
        }
        return $out;
    }

    /** Zerlegt eine SQL-Datei in Anweisungen (Zeilenkommentare `--` werden entfernt). @return list<string> */
    public static function statements(string $sql): array
    {
        $lines = array_filter(explode("\n", $sql), fn ($l) => !str_starts_with(ltrim($l), '--'));
        $parts = array_map('trim', explode(';', implode("\n", $lines)));
        return array_values(array_filter($parts, fn ($p) => $p !== ''));
    }
}
