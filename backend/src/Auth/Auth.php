<?php
declare(strict_types=1);

namespace CoopKraft\Auth;

use CoopKraft\Config;
use CoopKraft\Json;
use CoopKraft\Repo;

/**
 * Angemeldete Identität (aus dem SSO) -> Benutzer mit Rollen. Die Rollen werden bei jedem
 * Request neu aufgelöst, damit geänderte Gruppen-Zuordnungen oder Mitgliedsstatus sofort wirken.
 */
final class Auth
{
    private ?User $user = null;
    private bool $resolved = false;

    public function __construct(private Session $session, private Repo $repo, private Config $config)
    {
    }

    public function session(): Session
    {
        return $this->session;
    }

    /** SSO-Konfiguration aus settings('sso'), sonst die Vorgabe (wie getSsoConfig()). */
    public function ssoConfig(): array
    {
        $row = $this->repo->get('settings', 'sso');
        return $row !== null && isset($row->data) ? Json::toArray($row->data) : RoleResolver::DEFAULT_CONFIG;
    }

    /**
     * Nach erfolgreichem SSO-Login: Identität in die Session, users-Datensatz anlegen/aktualisieren
     * (gespeicherte Rollen bleiben als Overrides erhalten).
     * @param array{sub: string, email: string, name: string, groups: list<string>} $identity
     */
    public function login(array $identity): void
    {
        $identity['email'] = strtolower(trim($identity['email']));
        $this->session->regenerate();
        $this->session->set('identity', $identity);

        $record = $this->repo->findBy('users', 'email', $identity['email'])[0] ?? null;
        $record ??= (object) ['id' => Json::uuid(), 'email' => $identity['email'], 'roles' => []];
        $record->name = $identity['name'] !== '' ? $identity['name'] : ($record->name ?? $identity['email']);
        $record->groups = $identity['groups'];
        $record->lastLoginAt = Json::now();
        $this->repo->upsert('users', $record);
        $this->resolved = false;
    }

    public function logout(): void
    {
        $this->session->destroy();
        $this->user = null;
        $this->resolved = true;
    }

    public function user(): ?User
    {
        if (!$this->resolved) {
            $this->user = $this->resolve();
            $this->resolved = true;
        }
        return $this->user;
    }

    private function resolve(): ?User
    {
        $identity = $this->session->get('identity');
        if (!is_array($identity) || empty($identity['email'])) {
            return null;
        }
        $email = (string) $identity['email'];
        $groups = array_values($identity['groups'] ?? []);
        $record = $this->repo->findBy('users', 'email', $email)[0] ?? null;
        $overrides = array_values((array) ($record->roles ?? []));
        $members = $this->repo->findBy('members', 'email', $email);

        $result = RoleResolver::resolve(['email' => $email, 'groups' => $groups], $this->ssoConfig(), $members, $overrides);
        $roles = $result['roles'];
        // Notfall-Zugang, z. B. erster Admin bevor SSO-Gruppen gepflegt sind
        if (in_array($email, $this->config->list('ADMIN_EMAILS'), true) && !in_array('admin', $roles, true)) {
            $roles[] = 'admin';
        }

        return new User(
            id: (string) ($record->id ?? $identity['sub']),
            name: (string) ($record->name ?? $identity['name'] ?? $email),
            email: $email,
            roles: $roles,
            groups: $groups,
            memberId: isset($record->memberId) ? (string) $record->memberId : $result['memberId'],
        );
    }
}
