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

echo "All Places (limit 50, checking hex):\n";
$stmt = $pdo->query("SELECT p_id, p_place, p_file FROM wt_places LIMIT 50");
while ($row = $stmt->fetch()) {
    $name = $row['p_place'];
    $hex = bin2hex($name);
    echo "ID: " . $row['p_id'] . " (Tree " . $row['p_file'] . ") | Name: '" . $name . "' | Hex: " . $hex . "\n";
}
