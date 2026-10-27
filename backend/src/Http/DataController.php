<?php
declare(strict_types=1);

namespace CoopKraft\Http;

use CoopKraft\Context;
use CoopKraft\HttpError;
use CoopKraft\Json;
use CoopKraft\Tables;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** Generische Datensätze: entspricht getAll/getOne/put/del in src/services/db.ts. */
final class DataController
{
    public function __construct(private Context $ctx)
    {
    }

    private static function store(array $args): string
    {
        $store = (string) $args['store'];
        if (!Tables::exists($store) || Tables::isBinary($store)) {
            throw HttpError::notFound("Unbekannter Datenbereich: $store");
        }
        return $store;
    }

    public function list(Request $request, Response $response, array $args): Response
    {
        $store = self::store($args);
        $acl = $this->ctx->acl();
        $rows = [];
        foreach ($this->ctx->repo()->all($store) as $row) {
            $visible = $acl->read($store, $row);
            if ($visible !== null) {
                $rows[] = $visible;
            }
        }
        return Json::respond($response, $rows);
    }

    public function get(Request $request, Response $response, array $args): Response
    {
        $store = self::store($args);
        $row = $this->ctx->repo()->get($store, (string) $args['id']);
        $visible = $row === null ? null : $this->ctx->acl()->read($store, $row);
        if ($visible === null) {
            throw HttpError::notFound();
        }
        return Json::respond($response, $visible);
    }

    public function put(Request $request, Response $response, array $args): Response
    {
        $store = self::store($args);
        $id = (string) $args['id'];
        $repo = $this->ctx->repo();
        $row = $this->ctx->acl()->write($store, $id, Json::decodeObject((string) $request->getBody()), $repo->get($store, $id));
        $repo->upsert($store, $row);
        return $response->withStatus(204);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $store = self::store($args);
        $this->ctx->acl()->delete($store);
        $this->ctx->repo()->delete($store, (string) $args['id']);
        return $response->withStatus(204);
    }
}
