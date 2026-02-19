<?php
require __DIR__ . '/vendor/autoload.php';

use Fisharebest\Webtrees\DB;
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

// Initialize Dotenv
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Setup Database
$capsule = new Capsule;
$capsule->addConnection([
    'driver' => 'pgsql',
    'host' => $_ENV['DB_HOST'],
    'database' => $_ENV['DB_DATABASE'],
    'username' => $_ENV['DB_USERNAME'],
    'password' => $_ENV['DB_PASSWORD'],
    'charset' => 'utf8',
    'collation' => 'utf8_unicode_ci',
    'prefix' => 'wt_',
]);

$capsule->setAsGlobal();
$capsule->bootEloquent();

echo "Searching for 'Coburg' in 'wt_places'...\n";
$places = DB::table('places')
    ->where('p_place', 'ILIKE', '%Coburg%')
    ->get();

foreach ($places as $p) {
    echo "ID: " . $p->p_id . "\n";
    echo "Name: " . $p->p_place . "\n";
    echo "Lat: " . var_export($p->p_std_lat, true) . "\n";
    echo "Long: " . var_export($p->p_std_long, true) . "\n";
    echo "-------------------\n";
}

echo "Done.\n";
