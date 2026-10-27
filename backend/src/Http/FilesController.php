<?php
declare(strict_types=1);

namespace CoopKraft\Http;

use CoopKraft\Context;
use CoopKraft\HttpError;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** Dateiinhalte zu Dokumenten (Store documentFiles), binär statt JSON. */
final class FilesController
{
    public function __construct(private Context $ctx)
    {
    }

    public function get(Request $request, Response $response, array $args): Response
    {
        $id = (string) $args['id'];
        $file = $this->ctx->acl()->canReadFile($id) ? $this->ctx->repo()->getFile($id) : null;
        if ($file === null) {
            throw HttpError::notFound();
        }
        $response->getBody()->write($file['content']);
        return $response
            ->withHeader('Content-Type', $file['mime'])
            ->withHeader('Cache-Control', 'private, no-store')
            ->withHeader('X-Content-Type-Options', 'nosniff');
    }

    public function put(Request $request, Response $response, array $args): Response
    {
        $this->ctx->acl()->requireFileWrite();
        $mime = $request->getHeaderLine('Content-Type') ?: 'application/octet-stream';
        $this->ctx->repo()->putFile((string) $args['id'], $mime, (string) $request->getBody());
        return $response->withStatus(204);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $this->ctx->acl()->delete('documentFiles');
        $this->ctx->repo()->delete('documentFiles', (string) $args['id']);
        return $response->withStatus(204);
    }
}
