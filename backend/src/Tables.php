<?php
declare(strict_types=1);

namespace CoopKraft;

/**
 * Zuordnung App-Datenbereich (Store-Name wie in src/services/stores.ts) -> SQL-Tabelle.
 * `columns`: herausgezogene Spalte => Feld im JSON-Datensatz (wird beim Speichern befüllt).
 * Muss zu docs/schema.sql passen; `node scripts/check-contract.mjs` prüft das.
 */
final class Tables
{
    public const MAP = [
        'users' => ['table' => 'users', 'columns' => ['email' => 'email']],
        'members' => ['table' => 'members', 'columns' => ['email' => 'email', 'status' => 'status', 'mitgliedsnummer' => 'mitgliedsnummer']],
        'shareLots' => ['table' => 'share_lots', 'columns' => ['member_id' => 'memberId', 'status' => 'status']],
        'shareTransfers' => ['table' => 'share_transfers', 'columns' => []],
        'terminations' => ['table' => 'terminations', 'columns' => ['member_id' => 'memberId']],
        'approvals' => ['table' => 'approvals', 'columns' => []],
        'paymentConfirmations' => ['table' => 'payment_confirmations', 'columns' => []],
        'documents' => ['table' => 'documents', 'columns' => ['member_id' => 'memberId', 'visibility' => 'visibility']],
        'documentFiles' => ['table' => 'document_files', 'columns' => [], 'binary' => true],
        'campaigns' => ['table' => 'campaigns', 'columns' => []],
        'dividends' => ['table' => 'dividends', 'columns' => []],
        'settings' => ['table' => 'settings', 'columns' => []],
        'customFields' => ['table' => 'custom_fields', 'columns' => []],
        'workflowConfig' => ['table' => 'workflow_config', 'columns' => []],
        'auditLog' => ['table' => 'audit_log', 'columns' => ['member_id' => 'memberId']],
        'meta' => ['table' => 'meta', 'columns' => []],
    ];

    public static function exists(string $store): bool
    {
        return isset(self::MAP[$store]);
    }

    public static function table(string $store): string
    {
        if (!self::exists($store)) {
            throw new HttpError(404, "Unbekannter Datenbereich: $store");
        }
        return self::MAP[$store]['table'];
    }

    /** @return array<string,string> */
    public static function columns(string $store): array
    {
        return self::MAP[$store]['columns'] ?? [];
    }

    public static function isBinary(string $store): bool
    {
        return (self::MAP[$store]['binary'] ?? false) === true;
    }

    /** @return list<string> */
    public static function stores(): array
    {
        return array_keys(self::MAP);
    }
}
