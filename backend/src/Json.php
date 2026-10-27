<?php
declare(strict_types=1);

namespace CoopKraft;

use Psr\Http\Message\ResponseInterface;

/**
 * JSON-Helfer. Datensätze werden als stdClass-Objekte behandelt (nicht als Arrays),
 * damit leere Objekte wie `customFields: {}` beim Speichern nicht zu `[]` werden.
 */
final class Json
{
    public static function encode(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
    }

    public static function decode(string $json): mixed
    {
        return json_decode($json, false, 512, JSON_THROW_ON_ERROR);
    }

    /** Request-Body als Objekt; 400 bei ungültigem JSON. */
    public static function decodeObject(string $json): object
    {
        try {
            $value = self::decode($json);
        } catch (\JsonException) {
            throw HttpError::badRequest('Ungültiges JSON');
        }
        if (!is_object($value)) {
            throw HttpError::badRequest('JSON-Objekt erwartet');
        }
        return $value;
    }

    /** Objekt -> assoziatives Array (für Konfigurationen, die nur gelesen werden). */
    public static function toArray(mixed $value): array
    {
        return json_decode(self::encode($value), true, 512, JSON_THROW_ON_ERROR) ?? [];
    }

    public static function respond(ResponseInterface $response, mixed $data, int $status = 200): ResponseInterface
    {
        $response->getBody()->write(self::encode($data));
        return $response->withStatus($status)->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    /** Zeitstempel im Format von JavaScripts `new Date().toISOString()`. */
    public static function now(): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function uuid(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }
}
