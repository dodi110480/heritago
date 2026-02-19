<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$port = '3306';
$charset = 'utf8mb4';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset;port=$port", $user, $pass);
} catch (\PDOException $e) {
    die("DB Error: " . $e->getMessage());
}

echo "Checking for 'Maroldsweisach, Maroldsweisach':\n";
$stmt = $pdo->prepare("SELECT p_id, p_place FROM wt_places WHERE p_place LIKE :s");
$stmt->execute(['s' => '%Maroldsweisach, Maroldsweisach%']);
while ($r = $stmt->fetch()) {
    echo "ID: " . $r['p_id'] . " | Name: " . $r['p_place'] . "\n";
}

echo "Done.\n";
