<?php
declare(strict_types=1);

namespace CoopKraft;

use CoopKraft\Http\AdminController;
use CoopKraft\Http\AuthController;
use CoopKraft\Http\DataController;
use CoopKraft\Http\FilesController;
use CoopKraft\Http\PublicController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Slim\App as SlimApp;
use Slim\Exception\HttpException;
use Slim\Factory\AppFactory;

/**
 * REST-API für src/services/db.rest.ts und auth.service.ts. Alle Routen unter BASE_PATH (/api).
 */
final class App
{
    public static function create(Context $ctx): SlimApp
    {
        $app = AppFactory::create();
        $basePath = $ctx->config->get('BASE_PATH', '/api') ?? '/api';
        $app->setBasePath($basePath);

        $data = new DataController($ctx);
        $files = new FilesController($ctx);
        $admin = new AdminController($ctx);
        $auth = new AuthController($ctx, $basePath);
        $public = new PublicController($ctx);

        $app->get('/health', fn (Request $q, Response $r) => Json::respond($r, ['ok' => true]));

        $app->get('/me', [$auth, 'me']);
        $app->get('/auth/login', [$auth, 'login']);
        $app->get('/auth/callback', [$auth, 'callback']);
        $app->post('/auth/dev-login', [$auth, 'devLogin']);
        $app->post('/auth/logout', [$auth, 'logout']);

        $app->get('/data/{store}', [$data, 'list']);
        $app->get('/data/{store}/{id}', [$data, 'get']);
        $app->put('/data/{store}/{id}', [$data, 'put']);
        $app->delete('/data/{store}/{id}', [$data, 'delete']);

        $app->get('/files/{id}', [$files, 'get']);
        $app->put('/files/{id}', [$files, 'put']);
        $app->delete('/files/{id}', [$files, 'delete']);

        $app->get('/admin/counts', [$admin, 'counts']);
        $app->get('/admin/backup', [$admin, 'backup']);
        $app->post('/admin/restore', [$admin, 'restore']);

        $app->post('/public/anmeldung', [$public, 'anmeldung']);

        // Läuft innerhalb von Routing und Fehlerbehandlung (Slim: zuletzt hinzugefügt = außen)
        $app->add(function (Request $request, Handler $handler) use ($ctx, $basePath): Response {
            $method = $request->getMethod();
            $path = $request->getUri()->getPath();
            // CSRF: schreibende Aufrufe nur von der App (eigener Header, den fremde Seiten nicht setzen können).
            // Ausnahme: das Formular des Entwicklungs-Logins.
            if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)
                && $path !== $basePath . '/auth/dev-login'
                && $request->getHeaderLine('X-Requested-With') !== 'coopkraft') {
                throw HttpError::forbidden('Anfrage ohne App-Kennung abgelehnt');
            }
            if ($path !== $basePath . '/health') {
                $ctx->migrator()->migrateIfNeeded();
            }
            return $handler->handle($request)
                ->withHeader('X-Content-Type-Options', 'nosniff')
                ->withAddedHeader('Cache-Control', 'no-store');
        });
        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();

        $debug = $ctx->config->bool('APP_DEBUG');
        $errors = $app->addErrorMiddleware($debug, true, true);
        $errors->setDefaultErrorHandler(function (Request $request, \Throwable $e) use ($app, $debug): Response {
            [$status, $message] = match (true) {
                $e instanceof HttpError => [$e->status, $e->getMessage()],
                $e instanceof HttpException => [$e->getCode(), $e->getCode() === 404 ? 'Nicht gefunden' : $e->getMessage()],
                $e instanceof \PDOException && $e->getCode() === '23000' => [409, 'Datensatz kollidiert mit einem bestehenden (z. B. Mitgliedsnummer schon vergeben)'],
                default => [500, $debug ? $e->getMessage() : 'Interner Serverfehler'],
            };
            if ($status >= 500) {
                error_log((string) $e);
            }
            return Json::respond($app->getResponseFactory()->createResponse(), ['error' => $message], $status);
        });

        return $app;
    }
}
