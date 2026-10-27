<?php
declare(strict_types=1);

use CoopKraft\App;
use CoopKraft\Config;
use CoopKraft\Context;

require __DIR__ . '/../vendor/autoload.php';

App::create(new Context(Config::load(__DIR__ . '/../.env')))->run();
