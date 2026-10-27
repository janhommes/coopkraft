<?php
declare(strict_types=1);

namespace CoopKraft;

use CoopKraft\Auth\User;

/**
 * Serverseitige Berechtigungen für die generische Daten-API (Phase 1).
 *
 * - Admin: alles.
 * - Verwaltung (jede Rolle außer "mitglied"): liest und schreibt die Fachdaten; Einstellungen,
 *   Workflows, Felder, Benutzer und Systemdaten schreibt nur der Admin. Feinere Regeln je Rolle
 *   (wer darf freigeben, Self-Approval …) folgen in Phase 2 als Server-Befehle.
 * - Mitglied: sieht nur eigene Datensätze und darf nur Selbstbedienungs-Aktionen ausführen
 *   (Stammdaten ändern, Anteile zeichnen, Übertragung/Kündigung beantragen, eigene ausstehende
 *   Kündigung zurückziehen).
 * - Anonym: öffentliche Einstellungen (Branding, Anmeldeformular), Felddefinitionen,
 *   öffentliche Dokumente.
 */
final class Acl
{
    /** Schreiben nur durch Admin. */
    private const ADMIN_ONLY = ['settings', 'workflowConfig', 'customFields', 'meta', 'users'];

    /** Löschen durch die Verwaltung erlaubt; alles andere löscht nur der Admin (z. B. deleteMember). */
    private const STAFF_DELETE = ['documents', 'documentFiles', 'campaigns', 'dividends'];

    /** Felder, die ein Mitglied an seinem eigenen Datensatz nicht ändern darf. */
    private const MEMBER_PROTECTED = ['id', 'mitgliedsnummer', 'status', 'email', 'beitrittDatum', 'austrittDatum', 'kuendigungsgrund', 'createdAt'];

    /** Felder anderer Mitglieder, die ein Mitglied sieht (Mitgliederliste, § 31 GenG; z. B. Empfänger einer Übertragung). */
    private const MEMBER_LIST_FIELDS = ['id', 'mitgliedsnummer', 'status', 'typ', 'anrede', 'vorname', 'nachname', 'firma'];

    /** Einstellungen, die ohne Anmeldung lesbar sind (Branding, Anmeldeformular). */
    private const PUBLIC_SETTINGS = [
        'genossenschaftsName', 'logoDataUrl', 'primary', 'accent', 'background', 'sidebarBackground',
        'foreground', 'sidebarForeground', 'anteilsWert', 'minAnteile', 'maxAnteile',
        'laenderReihenfolge', 'defaultLand', 'fiscalYearEndMonth', 'signup',
    ];

    public function __construct(private ?User $user, private Repo $repo)
    {
    }

    public function user(): ?User
    {
        return $this->user;
    }

    public function requireUser(): User
    {
        return $this->user ?? throw new HttpError(401, 'Nicht angemeldet');
    }

    public function requireAdmin(): User
    {
        $user = $this->requireUser();
        if (!$user->isAdmin()) {
            throw HttpError::forbidden();
        }
        return $user;
    }

    /** Sichtbare Fassung eines Datensatzes oder null, wenn er verborgen bleibt. */
    public function read(string $store, object $row): ?object
    {
        $u = $this->user;
        if ($u?->isAdmin()) {
            return $row;
        }
        switch ($store) {
            case 'settings':
                if (($row->id ?? null) !== 'singleton') {
                    return null; // 'sso' nur für Admin
                }
                return $u !== null ? $row : $this->publicSettings($row);
            case 'customFields':
                return $row;
            case 'workflowConfig':
                return $u !== null ? $row : null;
            case 'meta':
            case 'users':
                return null;
            case 'documents':
                return $this->canSeeDocument($row) ? $row : null;
        }
        if ($u === null) {
            return null;
        }
        if ($u->isStaff()) {
            return $row;
        }
        if (!$u->isMember()) {
            return null;
        }
        $mid = $u->memberId;
        return match ($store) {
            'members' => $row->id === $mid ? $row : $this->memberListEntry($row),
            'shareLots', 'terminations', 'approvals', 'paymentConfirmations', 'auditLog' => ($row->memberId ?? null) === $mid ? $row : null,
            'shareTransfers' => (($row->fromMemberId ?? null) === $mid || ($row->toMemberId ?? null) === $mid) ? $row : null,
            'dividends' => $this->ownDividendRun($row, $mid),
            default => null,
        };
    }

    /** Prüft einen Schreibzugriff und liefert den zu speichernden Datensatz. */
    public function write(string $store, string $id, object $new, ?object $stored): object
    {
        $u = $this->requireUser();
        if (($new->id ?? null) !== $id) {
            throw HttpError::badRequest('Die ID im Datensatz passt nicht zur Adresse');
        }
        if ($store === 'auditLog') {
            return $this->auditEntry($new, $stored, $u);
        }
        if ($u->isAdmin()) {
            return $new;
        }
        if (in_array($store, self::ADMIN_ONLY, true)) {
            throw HttpError::forbidden();
        }
        if ($u->isStaff()) {
            return $new;
        }
        if (!$u->isMember()) {
            throw HttpError::forbidden();
        }
        $mid = $u->memberId;
        switch ($store) {
            case 'members':
                if ($stored === null || $id !== $mid) {
                    throw HttpError::forbidden();
                }
                foreach (self::MEMBER_PROTECTED as $field) {
                    if (property_exists($stored, $field)) {
                        $new->$field = $stored->$field;
                    } else {
                        unset($new->$field);
                    }
                }
                return $new;

            case 'shareLots':
                // Anteile zeichnen: neuer, noch unbezahlter Lot für sich selbst
                if ($stored !== null || ($new->memberId ?? null) !== $mid || ($new->status ?? null) !== 'pending_payment' || isset($new->paidAt)) {
                    throw HttpError::forbidden();
                }
                return $new;

            case 'shareTransfers':
                if ($stored !== null || ($new->fromMemberId ?? null) !== $mid || ($new->status ?? null) !== 'pending'
                    || !$this->ownsLot((string) ($new->fromLotId ?? ''), $mid)) {
                    throw HttpError::forbidden();
                }
                return $new;

            case 'terminations':
                if ($stored === null) {
                    if (($new->memberId ?? null) !== $mid || ($new->status ?? null) !== 'pending' || !empty($new->approvals)
                        || (isset($new->lotId) && !$this->ownsLot((string) $new->lotId, $mid))) {
                        throw HttpError::forbidden();
                    }
                    return $new;
                }
                // Eigene, noch ausstehende Kündigung zurückziehen – nur der Status ändert sich
                if (($stored->memberId ?? null) !== $mid || ($stored->status ?? null) !== 'pending' || ($new->status ?? null) !== 'cancelled') {
                    throw HttpError::forbidden();
                }
                $stored->status = 'cancelled';
                return $stored;
        }
        throw HttpError::forbidden();
    }

    public function delete(string $store): void
    {
        $u = $this->requireUser();
        if ($u->isAdmin() || ($u->isStaff() && in_array($store, self::STAFF_DELETE, true))) {
            return;
        }
        throw HttpError::forbidden();
    }

    /** Dateiinhalt lesen: wie das zugehörige Dokument. */
    public function canReadFile(string $id): bool
    {
        if ($this->user?->isStaff()) {
            return true;
        }
        $doc = $this->repo->get('documents', $id);
        return $doc !== null && $this->canSeeDocument($doc);
    }

    public function requireFileWrite(): void
    {
        if (!$this->requireUser()->isStaff()) {
            throw HttpError::forbidden();
        }
    }

    private function canSeeDocument(object $doc): bool
    {
        $u = $this->user;
        if ($u?->isStaff()) {
            return true;
        }
        $memberId = $doc->memberId ?? null;
        $visibility = $doc->visibility ?? null;
        if ($memberId === null) {
            return $visibility === 'public' || ($visibility === 'members' && $u?->isMember());
        }
        return $u?->isMember() === true && $memberId === $u->memberId && ($doc->visibleToMember ?? false) === true;
    }

    private function publicSettings(object $row): object
    {
        $public = new \stdClass();
        foreach (self::PUBLIC_SETTINGS as $field) {
            if (isset($row->data) && property_exists($row->data, $field)) {
                $public->$field = $row->data->$field;
            }
        }
        return (object) ['id' => $row->id, 'data' => $public];
    }

    private function memberListEntry(object $row): ?object
    {
        if (!in_array($row->status ?? null, ['active', 'terminating'], true)) {
            return null;
        }
        $entry = new \stdClass();
        foreach (self::MEMBER_LIST_FIELDS as $field) {
            if (property_exists($row, $field)) {
                $entry->$field = $row->$field;
            }
        }
        $entry->customFields = new \stdClass();
        return $entry;
    }

    private function ownDividendRun(object $run, string $memberId): ?object
    {
        $items = array_values(array_filter((array) ($run->items ?? []), fn ($i) => ($i->memberId ?? null) === $memberId));
        if ($items === []) {
            return null;
        }
        $own = clone $run;
        $own->items = $items;
        $own->totalAmount = round(array_sum(array_map(fn ($i) => (float) ($i->amount ?? 0), $items)), 2);
        unset($own->totals);
        $certificates = new \stdClass();
        if (isset($run->certificates->$memberId)) {
            $certificates->$memberId = $run->certificates->$memberId;
        }
        $own->certificates = $certificates;
        return $own;
    }

    /** Protokolleinträge: nur anlegen; Benutzer und Zeit setzt der Server. */
    private function auditEntry(object $new, ?object $stored, User $u): object
    {
        if ($stored !== null && !$u->isAdmin()) {
            throw HttpError::forbidden('Protokolleinträge können nicht geändert werden');
        }
        if (!$u->isStaff() && (!$u->isMember() || (isset($new->memberId) && $new->memberId !== $u->memberId))) {
            throw HttpError::forbidden();
        }
        $new->userId = $u->id;
        $new->userName = $u->name;
        $new->at = Json::now();
        return $new;
    }

    private function ownsLot(string $lotId, string $memberId): bool
    {
        $lot = $this->repo->get('shareLots', $lotId);
        return $lot !== null && ($lot->memberId ?? null) === $memberId;
    }
}
