<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$charset = 'utf8mb4';
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$pdo = new PDO($dsn, $user, $pass);

// 1. Delete Family F15 (Single parent Lenox)
echo "Deleting F15...\n";
$pdo->exec("DELETE FROM wt_families WHERE f_id='F15'");

// 2. Remove FAMS @F15@ from Lenox (I16)
echo "Cleaning I16 GEDCOM...\n";
$row = $pdo->query("SELECT i_gedcom FROM wt_individuals WHERE i_id='I16'")->fetch(PDO::FETCH_ASSOC);
if ($row) {
    $ged = $row['i_gedcom'];
    $newGed = preg_replace('/(?:^|[\r\n])1 FAMS @F15@(?:\r?\n|$)/', "\n", $ged);
    if (trim($newGed) !== trim($ged)) {
        $pdo->prepare("UPDATE wt_individuals SET i_gedcom=? WHERE i_id='I16'")->execute([trim($newGed) . "\n"]);
        echo "  Updated I16.\n";
    }
}

// 3. Ensure Miranda (I17) only has FAMC @F16@
echo "Cleaning I17 GEDCOM...\n";
$row = $pdo->query("SELECT i_gedcom FROM wt_individuals WHERE i_id='I17'")->fetch(PDO::FETCH_ASSOC);
if ($row) {
    $ged = $row['i_gedcom'];
    $newGed = preg_replace('/(?:^|[\r\n])1 FAMC @F15@(?:\r?\n|$)/', "\n", $ged);
    if (trim($newGed) !== trim($ged)) {
        $pdo->prepare("UPDATE wt_individuals SET i_gedcom=? WHERE i_id='I17'")->execute([trim($newGed) . "\n"]);
        echo "  Updated I17.\n";
    }
}

echo "Cleanup DONE.\n";
