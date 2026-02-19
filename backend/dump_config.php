<?php

namespace Fisharebest\Webtrees;

require __DIR__ . '/vendor/autoload.php';

$webtrees = Webtrees::new();

echo "Config File Path: " . Webtrees::CONFIG_FILE . "\n";

if (file_exists(Webtrees::CONFIG_FILE)) {
    echo "Config file exists!\n";
    include Webtrees::CONFIG_FILE;

    echo "DB Type: " . ($dbtype ?? 'N/A') . "\n";
    echo "DB Host: " . ($dbhost ?? 'N/A') . "\n";
    echo "DB Port: " . ($dbport ?? 'N/A') . "\n";
    echo "DB User: " . ($dbuser ?? 'N/A') . "\n";
    echo "DB Pass: " . ($dbpass ?? 'N/A') . "\n";
    echo "DB Name: " . ($dbname ?? 'N/A') . "\n";
    echo "DB Prefix: " . ($tblpfx ?? 'N/A') . "\n";
} else {
    echo "Config file NOT found.\n";
}
