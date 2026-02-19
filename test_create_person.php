<?php
namespace Fisharebest\Webtrees;

require 'backend/vendor/autoload.php';

use Fisharebest\Webtrees\Services\GedcomImportService;
use Fisharebest\Webtrees\Services\TreeService;

// Bootstrap
$app = new Webtrees();
Registry::container(new Container());

DB::connect(
    'mysql',
    'localhost',
    '3306',
    'heritago',
    'heritago',
    'heritago',
    'wt_',
    '',
    '',
    '',
    '',
    false
);

// Manual setup of factories usually done in bootstrap()
$app->bootstrap();
I18N::init('en-US'); // ADDED THIS

$treeService = Registry::container()->get(TreeService::class);
$tree = $treeService->all()->get('sperlich');

$out = "";

if (!$tree) {
    $out .= "Tree 'sperlich' not found\n";
} else {
    $gedcomImportService = new GedcomImportService();
    $nextXref = $treeService->nextXref($tree, 'INDI');
    $xref = '@' . $nextXref . '@';
    $indi = "0 $xref INDI\n1 NAME Annelie /Sperlich/\n1 SEX F\n1 BIRT\n2 PLAC Coburg\n";

    $out .= "Attempting to create person with XREF $xref\n";
    try {
        $gedcomImportService->updateRecord($indi, $tree, false);
        $out .= "Success! Person created.\n";
    } catch (\Throwable $e) {
        $out .= "FAILED: " . $e->getMessage() . "\n";
        $out .= $e->getTraceAsString() . "\n";
    }
}

file_put_contents('test_out.txt', $out);
echo "Done. Check test_out.txt\n";
