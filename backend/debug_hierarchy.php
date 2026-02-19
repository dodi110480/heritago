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

echo "Maroldsweisach Hierarchy:\n";
$stmt = $pdo->query("SELECT p_id, p_place, p_parent_id FROM wt_places WHERE p_place LIKE '%Maroldsweisach%' ORDER BY p_id");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID: {$row['p_id']} | Parent: {$row['p_parent_id']} | Name: {$row['p_place']}\n";
}
