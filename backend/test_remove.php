<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$charset = 'utf8mb4';
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$pdo = new PDO($dsn, $user, $pass);

$famId = 'F15';
$childXref = '@I17@';

$row = $pdo->query("SELECT f_gedcom FROM wt_families WHERE f_id='$famId'")->fetch(PDO::FETCH_ASSOC);
if ($row) {
    $famGedcom = $row['f_gedcom'];
    echo "Original F15 GEDCOM: " . addcslashes($famGedcom, "\r\n") . "\n";

    // Replicate logic
    $pattern = "/\n?1 CHIL $childXref/";
    $newFamGedcom = preg_replace($pattern, '', $famGedcom);
    echo "After first preg_replace: " . addcslashes($newFamGedcom, "\r\n") . "\n";

    if ($newFamGedcom === $famGedcom) {
        echo "No change, trying second regex...\n";
        $newFamGedcom = preg_replace("/^1 CHIL $childXref\n?/m", '', $famGedcom);
        echo "After second preg_replace: " . addcslashes($newFamGedcom, "\r\n") . "\n";
    }

    if ($newFamGedcom !== $famGedcom) {
        echo "SUCCESS: Pattern matched and changed.\n";
    } else {
        echo "FAILURE: Path not matched.\n";
    }
}
