<?php
declare(strict_types=1);

namespace CoopKraft;

use PDO;

final class Db
{
    public static function connect(Config $config): PDO
    {
        $dsn = $config->get('DB_DSN') ?? sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $config->get('DB_HOST', 'localhost'),
            $config->get('DB_PORT', '3306'),
            $config->require('DB_NAME'),
        );
        $pdo = new PDO($dsn, $config->get('DB_USER'), $config->get('DB_PASSWORD'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            // UPDATE meldet gefundene statt geänderter Zeilen (Repo::upsert)
            PDO::MYSQL_ATTR_FOUND_ROWS => true,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
        return $pdo;
    }
}
