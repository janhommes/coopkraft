<?php
declare(strict_types=1);

namespace CoopKraft\Tests;

use CoopKraft\Auth\RoleResolver;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Gleichverhalten mit resolveRoles() in src/lib/sso.ts (gleiche Fixture prüft scripts/check-contract.mjs). */
final class RoleResolverTest extends TestCase
{
    private static function fixture(): array
    {
        return json_decode((string) file_get_contents(__DIR__ . '/fixtures/resolve-roles.json'), true);
    }

    public static function cases(): iterable
    {
        $fixture = self::fixture();
        foreach ($fixture['cases'] as $case) {
            yield $case['name'] => [$case, $fixture['members']];
        }
    }

    #[DataProvider('cases')]
    public function testMatchesTypeScript(array $case, array $members): void
    {
        $result = RoleResolver::resolve($case['identity'], $case['config'], $members, $case['overrides']);
        self::assertSame($case['expected'], $result);
    }

    public function testDefaultConfigMatchesFrontend(): void
    {
        $frontend = json_decode((string) file_get_contents(__DIR__ . '/fixtures/sso-default.json'), true);
        self::assertSame($frontend, RoleResolver::DEFAULT_CONFIG);
    }

    public function testGroupsFromClaimAcceptsListsAndStrings(): void
    {
        self::assertSame(['a', 'b'], RoleResolver::groupsFromClaim([' a ', 'b', '']));
        self::assertSame(['a', 'b', 'c'], RoleResolver::groupsFromClaim('a, b c'));
        self::assertSame([], RoleResolver::groupsFromClaim(null));
    }
}
