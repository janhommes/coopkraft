<?php
declare(strict_types=1);

namespace CoopKraft\Http;

use CoopKraft\Context;
use CoopKraft\HttpError;
use CoopKraft\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** Öffentliche Befehle ohne Anmeldung. */
final class PublicController
{
    /** Felder, die das Anmeldeformular setzen darf (Rest vergibt der Server). */
    private const MEMBER_FIELDS = [
        'typ', 'anrede', 'titel', 'bevorzugteAnrede', 'vorname', 'nachname', 'firma', 'geburtsdatum',
        'email', 'telefon', 'strasse', 'hausnummer', 'plz', 'ort', 'land', 'iban', 'bic', 'kontoinhaber',
        'newsletter', 'freistellung', 'konfession', 'bundesland', 'steuerId', 'customFields',
    ];

    private const REQUIRED = ['vorname', 'nachname', 'email', 'strasse', 'hausnummer', 'plz', 'ort'];

    public function __construct(private Context $ctx)
    {
    }

    /**
     * Beitrittsantrag (wie submitAnmeldung() im IndexedDB-Modus): Mitglied "pending",
     * nächste Mitgliedsnummer, unbezahlter Anteils-Lot zum aktuellen Anteilswert, Protokoll.
     */
    public function anmeldung(Request $request, Response $response): Response
    {
        $input = Json::decodeObject((string) $request->getBody());
        foreach (self::REQUIRED as $field) {
            if (trim((string) ($input->$field ?? '')) === '') {
                throw HttpError::badRequest("Pflichtfeld fehlt: $field");
            }
        }
        if (!filter_var(trim((string) $input->email), FILTER_VALIDATE_EMAIL)) {
            throw HttpError::badRequest('Ungültige E-Mail-Adresse');
        }

        $repo = $this->ctx->repo();
        $settings = $repo->get('settings', 'singleton')?->data
            ?? throw new HttpError(503, 'Die Genossenschaft ist noch nicht eingerichtet');
        $anteile = (int) ($input->anteile ?? 0);
        if ($anteile < (int) ($settings->minAnteile ?? 1) || $anteile > (int) ($settings->maxAnteile ?? PHP_INT_MAX)) {
            throw HttpError::badRequest('Ungültige Anzahl Anteile');
        }

        $now = Json::now();
        $member = new \stdClass();
        foreach (self::MEMBER_FIELDS as $field) {
            if (property_exists($input, $field)) {
                $member->$field = $input->$field;
            }
        }
        $member->email = trim((string) $member->email);
        $member->customFields = is_object($member->customFields ?? null) ? $member->customFields : new \stdClass();
        $member->id = Json::uuid();
        $member->status = 'pending';
        $member->createdAt = $now;
        $member->updatedAt = $now;

        $value = $settings->anteilsWert ?? 0;
        $lot = (object) [
            'id' => Json::uuid(),
            'memberId' => $member->id,
            'count' => $anteile,
            'valuePerShare' => $value,
            'signedAt' => substr($now, 0, 10),
            'status' => 'pending_payment',
        ];

        // Mitgliedsnummer = höchste + 1 (mind. 1001); bei gleichzeitigen Anträgen greift der UNIQUE-Index
        for ($attempt = 0; ; $attempt++) {
            try {
                $repo->transaction(function () use ($repo, $member, $lot, $now, $value, $anteile) {
                    $member->mitgliedsnummer = max(1000, $repo->maxMitgliedsnummer()) + 1;
                    $repo->upsert('members', $member);
                    $repo->upsert('shareLots', $lot);
                    foreach ([
                        ['Mitglied angelegt', "{$member->vorname} {$member->nachname}"],
                        ['Anteile gezeichnet', "$anteile × $value €"],
                    ] as [$action, $details]) {
                        $repo->upsert('auditLog', (object) [
                            'id' => Json::uuid(), 'memberId' => $member->id, 'userId' => 'system',
                            'userName' => 'System', 'action' => $action, 'details' => $details, 'at' => $now,
                        ]);
                    }
                });
                break;
            } catch (\PDOException $e) {
                if ($attempt >= 2 || $e->getCode() !== '23000') {
                    throw $e;
                }
            }
        }
        return Json::respond($response, $member, 201);
    }
}
