<?php
declare(strict_types=1);

namespace CoopKraft\Http;

use CoopKraft\Context;
use CoopKraft\HttpError;
use CoopKraft\Json;
use CoopKraft\Tables;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** Datenbank-Verwaltung (nur Admin): Zählung, Sicherung, Wiederherstellung im Format "egv-backup". */
final class AdminController
{
    private const BACKUP_VERSION = 1;

    public function __construct(private Context $ctx)
    {
    }

    public function counts(Request $request, Response $response): Response
    {
        $this->ctx->acl()->requireAdmin();
        $counts = [];
        foreach (Tables::stores() as $store) {
            $counts[$store] = $this->ctx->repo()->count($store);
        }
        return Json::respond($response, $counts);
    }

    public function backup(Request $request, Response $response): Response
    {
        $this->ctx->acl()->requireAdmin();
        $repo = $this->ctx->repo();
        $tables = [];
        foreach (Tables::stores() as $store) {
            if (Tables::isBinary($store)) {
                $tables[$store] = [];
                foreach ($repo->fileIds() as $id) {
                    $file = $repo->getFile($id);
                    $tables[$store][] = ['id' => $id, 'dataUrl' => 'data:' . $file['mime'] . ';base64,' . base64_encode($file['content'])];
                }
                continue;
            }
            $tables[$store] = $repo->all($store);
        }
        return Json::respond($response, [
            'format' => 'egv-backup',
            'version' => self::BACKUP_VERSION,
            'createdAt' => Json::now(),
            'tables' => $tables,
        ]);
    }

    /** Ersetzt ALLE Daten durch die Sicherung (in einer Transaktion). */
    public function restore(Request $request, Response $response): Response
    {
        $this->ctx->acl()->requireAdmin();
        $file = Json::decodeObject((string) $request->getBody());
        if (($file->format ?? null) !== 'egv-backup' || !isset($file->tables) || !is_object($file->tables)) {
            throw HttpError::badRequest('Keine gültige Sicherungsdatei');
        }
        $repo = $this->ctx->repo();
        $repo->transaction(function () use ($repo, $file) {
            foreach (Tables::stores() as $store) {
                $repo->clear($store);
                foreach ((array) ($file->tables->$store ?? []) as $row) {
                    if (!is_object($row) || !isset($row->id)) {
                        throw HttpError::badRequest("Ungültiger Datensatz in $store");
                    }
                    if (Tables::isBinary($store)) {
                        [$mime, $content] = self::parseDataUrl((string) ($row->dataUrl ?? ''));
                        $repo->putFile((string) $row->id, $mime, $content);
                    } else {
                        $repo->upsert($store, $row);
                    }
                }
            }
        });
        return $response->withStatus(204);
    }

    /** @return array{0: string, 1: string} */
    private static function parseDataUrl(string $url): array
    {
        if (!preg_match('/^data:([^;,]*)(;base64)?,(.*)$/s', $url, $m)) {
            throw HttpError::badRequest('Ungültige Datei in der Sicherung');
        }
        $content = $m[2] !== '' ? base64_decode($m[3], true) : rawurldecode($m[3]);
        if ($content === false) {
            throw HttpError::badRequest('Ungültige Datei in der Sicherung');
        }
        return [$m[1] !== '' ? $m[1] : 'application/octet-stream', $content];
    }
}
