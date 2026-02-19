<?php
// Simple repair script using PDO to avoid DI issues
try {
    $pdo = new PDO('mysql:host=127.0.0.1;dbname=heritago', 'heritago', 'heritago');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Repairing links for tree 2 (Sperlich)...\n";

    // Get all families
    $stmt = $pdo->query("SELECT f_id, f_husb, f_wife, f_gedcom FROM wt_families WHERE f_file = 2");
    $families = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($families as $fam) {
        $famXref = "@{$fam['f_id']}@";

        // Husb
        if ($fam['f_husb'])
            fixIndi($fam['f_husb'], 'FAMS', $famXref, $pdo);
        // Wife
        if ($fam['f_wife'])
            fixIndi($fam['f_wife'], 'FAMS', $famXref, $pdo);

        // Children
        preg_match_all('/1 CHIL @([^@]+)@/', $fam['f_gedcom'], $matches);
        foreach ($matches[1] as $childId) {
            fixIndi($childId, 'FAMC', $famXref, $pdo);
        }
    }

    echo "Done!\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

function fixIndi($id, $tag, $famXref, $pdo)
{
    $stmt = $pdo->prepare("SELECT i_gedcom FROM wt_individuals WHERE i_id = ? AND i_file = 2");
    $stmt->execute([$id]);
    $rec = $stmt->fetchColumn();
    if (!$rec)
        return;

    // Use \n as line ending
    $normalized = str_replace(["\r\n", "\r"], "\n", $rec);

    if (!str_contains($normalized, "1 $tag $famXref")) {
        echo "  -> Adding 1 $tag $famXref to $id\n";
        $new = rtrim($normalized) . "\n1 $tag $famXref\n";
        $upd = $pdo->prepare("UPDATE wt_individuals SET i_gedcom = ? WHERE i_id = ? AND i_file = 2");
        $upd->execute([$new, $id]);
    }
}
