<?php
declare(strict_types=1);

namespace CoopKraft\Http;

use CoopKraft\Auth\Oidc;
use CoopKraft\Auth\RoleResolver;
use CoopKraft\Context;
use CoopKraft\HttpError;
use CoopKraft\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Anmeldung. AUTH_MODE=oidc (Standard): SSO-Anbieter, z. B. Nextcloud.
 * AUTH_MODE=dev: lokales Formular "SSO simulieren" (E-Mail + Gruppen), nie in Produktion.
 */
final class AuthController
{
    public function __construct(private Context $ctx, private string $basePath)
    {
    }

    private function devMode(): bool
    {
        return $this->ctx->config->get('AUTH_MODE', 'oidc') === 'dev';
    }

    public function me(Request $request, Response $response): Response
    {
        return Json::respond($response, ['user' => $this->ctx->auth()->user()?->toArray()]);
    }

    public function login(Request $request, Response $response): Response
    {
        $returnTo = self::safeReturnTo($request->getQueryParams()['returnTo'] ?? '/');
        if ($this->devMode()) {
            return $this->devForm($response, $returnTo);
        }
        $oidc = new Oidc($this->ctx->config, $this->ctx->session());
        $redirectUri = rtrim($this->ctx->config->require('APP_URL'), '/') . $this->basePath . '/auth/callback';
        return $response->withStatus(302)->withHeader('Location', $oidc->authorizationUrl($redirectUri, $returnTo));
    }

    public function callback(Request $request, Response $response): Response
    {
        $oidc = new Oidc($this->ctx->config, $this->ctx->session());
        $result = $oidc->handleCallback($request->getQueryParams());
        $claims = $result['claims'];
        $email = trim((string) ($claims['email'] ?? ''));
        if ($email === '') {
            throw new HttpError(401, 'Der Anmeldedienst liefert keine E-Mail-Adresse (Scope "email" freigeben).');
        }
        $claim = (string) ($this->ctx->auth()->ssoConfig()['claim'] ?? 'groups');
        $this->ctx->auth()->login([
            'sub' => (string) ($claims['sub'] ?? $email),
            'email' => $email,
            'name' => (string) ($claims['name'] ?? $claims['preferred_username'] ?? $email),
            'groups' => RoleResolver::groupsFromClaim($claims[$claim] ?? []),
        ]);
        return $response->withStatus(302)->withHeader('Location', self::safeReturnTo($result['returnTo']));
    }

    public function devLogin(Request $request, Response $response): Response
    {
        if (!$this->devMode()) {
            throw HttpError::notFound();
        }
        $form = (array) $request->getParsedBody();
        $email = trim((string) ($form['email'] ?? ''));
        if ($email === '') {
            throw HttpError::badRequest('E-Mail fehlt');
        }
        $this->ctx->auth()->login([
            'sub' => 'dev:' . strtolower($email),
            'email' => $email,
            'name' => trim((string) ($form['name'] ?? '')) ?: $email,
            'groups' => RoleResolver::groupsFromClaim((string) ($form['groups'] ?? '')),
        ]);
        return $response->withStatus(302)->withHeader('Location', self::safeReturnTo($form['returnTo'] ?? '/'));
    }

    public function logout(Request $request, Response $response): Response
    {
        $this->ctx->auth()->logout();
        return $response->withStatus(204);
    }

    /** Nur Pfade innerhalb der App (kein Open Redirect). */
    private static function safeReturnTo(mixed $value): string
    {
        $value = is_string($value) ? $value : '/';
        return (str_starts_with($value, '/') && !str_starts_with($value, '//') && !str_contains($value, '\\')) ? $value : '/';
    }

    private function devForm(Response $response, string $returnTo): Response
    {
        $action = htmlspecialchars($this->basePath . '/auth/dev-login');
        $returnTo = htmlspecialchars($returnTo);
        $response->getBody()->write(<<<HTML
            <!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>SSO simulieren</title>
            <style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem}label{display:block;margin:.75rem 0 .25rem}input{width:100%;padding:.5rem;box-sizing:border-box}button{margin-top:1rem;padding:.5rem 1rem}</style>
            </head><body>
            <h1>SSO simulieren</h1>
            <p>Entwicklungsmodus (AUTH_MODE=dev). Gruppen werden wie der SSO-Claim ausgewertet, z.&nbsp;B. <code>egv-admin</code>.</p>
            <form method="post" action="$action">
              <input type="hidden" name="returnTo" value="$returnTo">
              <label for="email">E-Mail</label><input id="email" name="email" type="email" required value="greta@demo.de">
              <label for="name">Name</label><input id="name" name="name" value="Greta Admin">
              <label for="groups">Gruppen (kommagetrennt)</label><input id="groups" name="groups" value="egv-admin">
              <button type="submit">Anmelden</button>
            </form>
            </body></html>
            HTML);
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }
}
