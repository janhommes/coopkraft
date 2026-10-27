<?php
declare(strict_types=1);

namespace CoopKraft\Auth;

use CoopKraft\Config;
use CoopKraft\HttpError;

/**
 * OpenID Connect Authorization Code Flow mit PKCE (z. B. Nextcloud "OIDC Identity Provider").
 *
 * Das ID-Token kommt direkt vom Token-Endpunkt über TLS; laut OIDC Core 3.1.3.7 ersetzt die
 * TLS-Prüfung dann die Signaturprüfung. Geprüft werden iss, aud, exp und nonce; die Claims
 * (E-Mail, Name, Gruppen) kommen zusätzlich vom Userinfo-Endpunkt.
 */
final class Oidc
{
    public function __construct(private Config $config, private Session $session)
    {
    }

    private function issuer(): string
    {
        return rtrim($this->config->require('OIDC_ISSUER'), '/');
    }

    /** @return array<string,mixed> */
    private function discovery(): array
    {
        $url = $this->config->get('OIDC_DISCOVERY_URL') ?? $this->issuer() . '/.well-known/openid-configuration';
        return self::json($this->http('GET', $url));
    }

    public function authorizationUrl(string $redirectUri, string $returnTo): string
    {
        $d = $this->discovery();
        $verifier = self::base64url(random_bytes(32));
        $state = bin2hex(random_bytes(16));
        $nonce = bin2hex(random_bytes(16));
        $this->session->set('oidc', compact('state', 'nonce', 'verifier', 'returnTo', 'redirectUri'));

        return $d['authorization_endpoint'] . '?' . http_build_query([
            'response_type' => 'code',
            'client_id' => $this->config->require('OIDC_CLIENT_ID'),
            'redirect_uri' => $redirectUri,
            'scope' => $this->config->get('OIDC_SCOPES', 'openid email profile groups'),
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => self::base64url(hash('sha256', $verifier, true)),
            'code_challenge_method' => 'S256',
        ]);
    }

    /**
     * Prüft den Rückruf und liefert alle Claims (ID-Token + Userinfo) sowie das Rücksprungziel.
     * @param array<string,mixed> $query
     * @return array{claims: array<string,mixed>, returnTo: string}
     */
    public function handleCallback(array $query): array
    {
        $flow = $this->session->get('oidc');
        $this->session->remove('oidc');
        if (!is_array($flow) || !isset($query['state']) || !hash_equals($flow['state'], (string) $query['state'])) {
            throw new HttpError(400, 'Ungültiger Anmeldeversuch (state). Bitte erneut anmelden.');
        }
        if (isset($query['error'])) {
            throw new HttpError(401, 'Anmeldung abgelehnt: ' . (string) $query['error']);
        }
        $d = $this->discovery();
        $clientId = $this->config->require('OIDC_CLIENT_ID');
        $secret = $this->config->require('OIDC_CLIENT_SECRET');

        $form = [
            'grant_type' => 'authorization_code',
            'code' => (string) ($query['code'] ?? ''),
            'redirect_uri' => $flow['redirectUri'],
            'code_verifier' => $flow['verifier'],
        ];
        $headers = ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'];
        if ($this->config->get('OIDC_TOKEN_AUTH', 'basic') === 'post') {
            $form += ['client_id' => $clientId, 'client_secret' => $secret];
        } else {
            $headers[] = 'Authorization: Basic ' . base64_encode(rawurlencode($clientId) . ':' . rawurlencode($secret));
        }
        $tokens = self::json($this->http('POST', $d['token_endpoint'], $headers, http_build_query($form)));
        if (!isset($tokens['id_token'], $tokens['access_token'])) {
            throw new HttpError(401, 'Anmeldung fehlgeschlagen (kein Token)');
        }

        $idToken = self::jwtPayload((string) $tokens['id_token']);
        $aud = (array) ($idToken['aud'] ?? []);
        if (rtrim((string) ($idToken['iss'] ?? ''), '/') !== rtrim((string) ($d['issuer'] ?? $this->issuer()), '/')
            || !in_array($clientId, $aud, true)
            || (int) ($idToken['exp'] ?? 0) < time() - 60
            || !hash_equals($flow['nonce'], (string) ($idToken['nonce'] ?? ''))) {
            throw new HttpError(401, 'Anmeldung fehlgeschlagen (ID-Token ungültig)');
        }

        $claims = $idToken;
        if (!empty($d['userinfo_endpoint'])) {
            $userinfo = self::json($this->http('GET', $d['userinfo_endpoint'], ['Authorization: Bearer ' . $tokens['access_token'], 'Accept: application/json']));
            if (($userinfo['sub'] ?? null) === ($idToken['sub'] ?? null)) {
                $claims = array_merge($idToken, $userinfo);
            }
        }
        return ['claims' => $claims, 'returnTo' => (string) $flow['returnTo']];
    }

    /** @param list<string> $headers */
    private function http(string $method, string $url, array $headers = [], ?string $body = null): string
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST => $method,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 15,
            ]);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            }
            $result = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $error = curl_error($ch);
            curl_close($ch);
        } else {
            $context = stream_context_create(['http' => [
                'method' => $method,
                'header' => implode("\r\n", $headers),
                'content' => $body ?? '',
                'timeout' => 15,
                'ignore_errors' => true,
            ]]);
            $result = @file_get_contents($url, false, $context);
            $status = (int) preg_replace('/^HTTP\/\S+ (\d+).*/', '$1', $http_response_header[0] ?? 'HTTP/1.1 0');
            $error = $result === false ? 'Verbindung fehlgeschlagen' : '';
        }
        if ($result === false || $status < 200 || $status >= 300) {
            error_log("OIDC $method $url -> $status $error " . substr((string) $result, 0, 500));
            throw new HttpError(502, 'Anmeldedienst nicht erreichbar');
        }
        return (string) $result;
    }

    /** @return array<string,mixed> */
    private static function json(string $body): array
    {
        $data = json_decode($body, true);
        if (!is_array($data)) {
            throw new HttpError(502, 'Ungültige Antwort vom Anmeldedienst');
        }
        return $data;
    }

    /** @return array<string,mixed> */
    private static function jwtPayload(string $jwt): array
    {
        $parts = explode('.', $jwt);
        $b64 = strtr($parts[1] ?? '', '-_', '+/');
        $payload = count($parts) === 3 ? base64_decode(str_pad($b64, strlen($b64) + (4 - strlen($b64) % 4) % 4, '='), true) : false;
        return $payload === false ? [] : self::json($payload);
    }

    private static function base64url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
