<?php
require 'vendor/autoload.php';
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Webtrees;

define('WT_ROOT', __DIR__ . '/');
require 'app/Webtrees.php';

// Mock some things to get DB working
$driver = 'mysql';
$host = 'localhost';
$port = '3306';
$database = 'heritago';
$username = 'heritago';
$password = 'heritago';
$prefix = 'wt_';

DB::connect($driver, $host, $port, $database, $username, $password, $prefix, '', '', '', false);

$tables = ['wt_places', 'wt_place_location'];
foreach ($tables as $table) {
    echo "Table: $table\n";
    $columns = DB::select("SHOW COLUMNS FROM $table");
    foreach ($columns as $column) {
        echo "  {$column->Field} ({$column->Type})\n";
    }
    echo "\n";
}
