<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$charset = 'utf8mb4';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset", $user, $pass);
} catch (\PDOException $e) {
    die($e->getMessage());
}

echo "Checking wt_places for GEDCOM compliance (5 levels, 4 commas):\n";
echo "------------------------------------------------------------\n";

$stmt = $pdo->query("SELECT p_id, p_place FROM wt_places ORDER BY p_id DESC LIMIT 20");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $name = $row['p_place'];
    $commaCount = substr_count($name, ',');
    $isCompliant = ($commaCount === 4);

    echo "ID: {$row['p_id']} | ";
    echo "Commas: {$commaCount} | ";
    echo "Status: " . ($isCompliant ? "[COMPLIANT] " : "[INVALID]   ") . " | ";
    echo "Name: '{$name}'\n";
}
