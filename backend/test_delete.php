<?php

namespace Fisharebest\Webtrees;

use Fisharebest\Webtrees\Services\GedcomImportService;
use Fisharebest\Webtrees\Services\TreeService;

require __DIR__ . '/vendor/autoload.php';

// Bootstrap Webtrees
$webtrees = Webtrees::new();
$webtrees->bootstrap();

$tree_service = Registry::container()->get(TreeService::class);
$gedcom_import_service = Registry::container()->get(GedcomImportService::class);

$tree = $tree_service->all()->get('sperlich');
if (!$tree) {
    die("Tree 'sperlich' not found\n");
}

$id = 'I30';
$xref = "@$id@";
$indi = "0 $xref INDI\n";

echo "Attempting to delete $id in tree " . $tree->id() . "...\n";

try {
    $gedcom_import_service->updateRecord($indi, $tree, true);
    echo "Success!\n";
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
