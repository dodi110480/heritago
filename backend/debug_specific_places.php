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

$ids = [17, 18];
$stmt = $pdo->query("SELECT p_id, p_place FROM wt_places WHERE p_id IN (" . implode(',', $ids) . ")");
while ($r = $stmt->fetch()) {
    echo "ID: " . $r['p_id'] . " Name: " . $r['p_place'] . "\n";
}
