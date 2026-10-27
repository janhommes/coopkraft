<?php
declare(strict_types=1);

namespace CoopKraft;

/** Fehler mit HTTP-Status; die Meldung geht als `{ "error": "..." }` an die App. */
final class HttpError extends \RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message, $status);
    }

    public static function forbidden(string $message = 'Keine Berechtigung'): self
    {
        return new self(403, $message);
    }

    public static function notFound(string $message = 'Nicht gefunden'): self
    {
        return new self(404, $message);
    }

    public static function badRequest(string $message): self
    {
        return new self(400, $message);
    }
}
