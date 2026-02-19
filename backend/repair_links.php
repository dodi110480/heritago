<?php

namespace Fisharebest\Webtrees;

use Illuminate\Database\Capsule\Manager as Capsule;
use Fisharebest\Webtrees\Services\GedcomImportService;
use Fisharebest\Webtrees\Services\TreeService;

require __DIR__ . '/vendor/autoload.php';

// Manual DB setup
$capsule = new Capsule;
$capsule->addConnection([
    'driver' => 'mysql',
    'host' => '127.0.0.1',
    'database' => 'heritago',
    'username' => 'heritago',
    'password' => 'heritago',
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix' => 'wt_',
]);
$capsule->setAsGlobal();
$capsule->bootEloquent();

// Mock Registry to return our Capsule
class Registry
{
    public static function container()
    {
        return new class {
            public function get($class)
            {
                if ($class === \Fisharebest\Webtrees\Services\TreeService::class)
                    return new \Fisharebest\Webtrees\Services\TreeService();
                if ($class === \Fisharebest\Webtrees\Services\GedcomImportService::class)
                    return new \Fisharebest\Webtrees\Services\GedcomImportService();
                return null;
            }
        };
    }
}

// Minimal Boot
$tree_service = new TreeService();
$gedcom_import_service = new GedcomImportService();

$trees = $tree_service->all();
foreach ($trees as $tree) {
    if ($tree->id() !== 2)
        continue; // Only Sperlich
    echo "Processing tree: " . $tree->id() . "...\n";

    $families = \Illuminate\Support\Facades\DB::table('families')->where('f_file', $tree->id())->get();

    foreach ($families as $family) {
        $famXref = '@' . $family->f_id . '@';
        $husbId = $family->f_husb;
        $wifeId = $family->f_wife;

        echo "Family $famXref: Husb=$husbId, Wife=$wifeId\n";

        if ($husbId)
            checkAndFixLink($husbId, 'FAMS', $famXref, $tree, $gedcom_import_service);
        if ($wifeId)
            checkAndFixLink($wifeId, 'FAMS', $famXref, $tree, $gedcom_import_service);

        preg_match_all('/1 CHIL @(.+)@/', $family->f_gedcom, $matches);
        foreach ($matches[1] as $childId) {
            checkAndFixLink($childId, 'FAMC', $famXref, $tree, $gedcom_import_service);
        }
    }
}

function checkAndFixLink($id, $tag, $famXref, $tree, $gedcom_import_service)
{
    $rec = \Illuminate\Support\Facades\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $id)->value('i_gedcom');
    if (!$rec)
        return;

    if (!str_contains($rec, "1 $tag $famXref")) {
        echo "  -> Adding $tag $famXref to $id\n";
        $new = rtrim($rec) . "\n1 $tag $famXref\n";
        // Manual SQL update to avoid complexity of updateRecord side effects in mock environment
        \Illuminate\Support\Facades\DB::table('individuals')
            ->where('i_file', $tree->id())
            ->where('i_id', $id)
            ->update(['i_gedcom' => $new]);
    }
}

echo "Done!\n";
