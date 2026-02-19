<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$charset = 'utf8mb4';
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$pdo = new PDO($dsn, $user, $pass);

$ids = ['I16', 'I17', 'I18'];
foreach ($ids as $id) {
    $row = $pdo->query("SELECT i_id, i_gedcom FROM wt_individuals WHERE i_id='$id'")->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        echo "\nIndividual $id:\n";
        echo "GEDCOM: " . addcslashes($row['i_gedcom'], "\r\n") . "\n";

        // Find families where this person is a spouse
        $stmt = $pdo->prepare("SELECT f_id, f_husb, f_wife, f_gedcom FROM wt_families WHERE f_husb=? OR f_wife=?");
        $stmt->execute([$id, $id]);
        while ($fam = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "  As Spouse in FAM {$fam['f_id']}: HUSB[{$fam['f_husb']}] WIFE[{$fam['f_wife']}] \n";
            echo "    GEDCOM: " . addcslashes($fam['f_gedcom'], "\r\n") . "\n";
        }
    }
}
