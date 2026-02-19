<?php
require 'backend/vendor/autoload.php';
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Webtrees;

define('WT_ROOT', __DIR__ . '/backend/');

// Mock some things if needed, but let's try to just connect
$env = parse_ini_file('backend/.env');

DB::connect(
    $env['DB_TYPE'],
    $env['DB_HOST'],
    $env['DB_PORT'],
    $env['DB_NAME'],
    $env['DB_USER'],
    $env['DB_PASS'],
    $env['DB_PREFIX'],
    '',
    '',
    '',
    false
);

$count = DB::table('individuals')->count();
echo "Total individuals: " . $count . "\n";

$trees = DB::table('tree')->get();
foreach ($trees as $tree) {
    $treeCount = DB::table('individuals')->where('i_file', $tree->t_id)->count();
    echo "Tree " . $tree->t_name . " (ID " . $tree->t_id . "): " . $treeCount . " individuals\n";
}
