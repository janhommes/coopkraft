<?php
declare(strict_types=1);

namespace CoopKraft;

use PDO;

/**
 * Generischer Speicher: jede Tabelle hat `id`, ggf. herausgezogene Spalten, `data` (JSON).
 * Kennt keine Berechtigungen, das macht Acl.
 */
final class Repo
{
    public function __construct(private PDO $pdo)
    {
    }

    public function pdo(): PDO
    {
        return $this->pdo;
    }

    /** @return list<object> */
    public function all(string $store): array
    {
        $table = Tables::table($store);
        $rows = $this->pdo->query("SELECT data FROM `$table` ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
        return array_map(fn ($json) => Json::decode($json), $rows);
    }

    public function get(string $store, string $id): ?object
    {
        $table = Tables::table($store);
        $stmt = $this->pdo->prepare("SELECT data FROM `$table` WHERE id = ?");
        $stmt->execute([$id]);
        $json = $stmt->fetchColumn();
        return $json === false ? null : Json::decode($json);
    }

    /** Suche über eine herausgezogene Spalte (z. B. members.email). @return list<object> */
    public function findBy(string $store, string $column, string|int $value): array
    {
        $table = Tables::table($store);
        if (!array_key_exists($column, Tables::columns($store))) {
            throw new \InvalidArgumentException("Spalte $column ist für $store nicht herausgezogen");
        }
        $stmt = $this->pdo->prepare("SELECT data FROM `$table` WHERE `$column` = ? ORDER BY id");
        $stmt->execute([$value]);
        return array_map(fn ($json) => Json::decode($json), $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    public function upsert(string $store, object $row): void
    {
        $table = Tables::table($store);
        $values = ['data' => Json::encode($row)];
        foreach (Tables::columns($store) as $column => $field) {
            $value = $row->$field ?? null;
            $values[$column] = is_scalar($value) ? $value : null;
        }
        // Erst per id aktualisieren, sonst einfügen. Bewusst weder REPLACE (DELETE + INSERT) noch
        // ON DUPLICATE KEY UPDATE: das greift bei JEDEM Unique-Index (z. B. Mitgliedsnummer) und würde
        // dann einen fremden Datensatz überschreiben statt einen Konflikt (409) zu melden.
        $set = implode(', ', array_map(fn ($c) => "`$c` = ?", array_keys($values)));
        $update = $this->pdo->prepare("UPDATE `$table` SET $set WHERE id = ?");
        $update->execute([...array_values($values), (string) $row->id]);
        if ($update->rowCount() > 0) {
            return; // MYSQL_ATTR_FOUND_ROWS: zählt gefundene, nicht nur geänderte Zeilen
        }
        $columns = ['id', ...array_keys($values)];
        $quoted = implode(', ', array_map(fn ($c) => "`$c`", $columns));
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $this->pdo->prepare("INSERT INTO `$table` ($quoted) VALUES ($placeholders)")
            ->execute([(string) $row->id, ...array_values($values)]);
    }

    public function delete(string $store, string $id): void
    {
        $table = Tables::table($store);
        $this->pdo->prepare("DELETE FROM `$table` WHERE id = ?")->execute([$id]);
    }

    public function count(string $store): int
    {
        $table = Tables::table($store);
        return (int) $this->pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    }

    public function clear(string $store): void
    {
        $table = Tables::table($store);
        $this->pdo->exec("DELETE FROM `$table`");
    }

    /** @return array{mime: string, content: string}|null */
    public function getFile(string $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT mime_type, content FROM document_files WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row === false ? null : ['mime' => $row['mime_type'] ?: 'application/octet-stream', 'content' => (string) $row['content']];
    }

    public function putFile(string $id, string $mime, string $content): void
    {
        $this->pdo->prepare(
            'INSERT INTO document_files (id, mime_type, content) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), content = VALUES(content)'
        )->execute([$id, $mime, $content]);
    }

    /** @return list<string> */
    public function fileIds(): array
    {
        return $this->pdo->query('SELECT id FROM document_files ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
    }

    public function maxMitgliedsnummer(): int
    {
        return (int) $this->pdo->query('SELECT COALESCE(MAX(mitgliedsnummer), 0) FROM members')->fetchColumn();
    }

    /** @template T @param callable(): T $fn @return T */
    public function transaction(callable $fn): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $result = $fn();
            $this->pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
