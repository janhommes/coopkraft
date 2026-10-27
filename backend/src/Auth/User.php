<?php
declare(strict_types=1);

namespace CoopKraft\Auth;

/** Angemeldeter Benutzer mit effektiven Rollen (Form wie AppUser in src/lib/types.ts). */
final class User
{
    /** @param list<string> $roles @param list<string> $groups */
    public function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly string $email,
        public readonly array $roles,
        public readonly array $groups = [],
        public readonly ?string $memberId = null,
    ) {
    }

    public function has(string $role): bool
    {
        return in_array($role, $this->roles, true);
    }

    public function isAdmin(): bool
    {
        return $this->has('admin');
    }

    /** Jede Rolle außer "mitglied" gehört zur Verwaltung. */
    public function isStaff(): bool
    {
        return array_diff($this->roles, ['mitglied']) !== [];
    }

    /** Mitglied mit verknüpftem Mitglieds-Datensatz. */
    public function isMember(): bool
    {
        return $this->has('mitglied') && $this->memberId !== null;
    }

    public function toArray(): array
    {
        return array_filter([
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->roles,
            'groups' => $this->groups,
            'memberId' => $this->memberId,
        ], fn ($v) => $v !== null);
    }
}
