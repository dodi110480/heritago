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

echo "Checking Used Places:\n";
$stmt = $pdo->query("SELECT pl_p_id, COUNT(*) as cnt FROM wt_placelinks GROUP BY pl_p_id LIMIT 10");
while ($r = $stmt->fetch()) {
    echo "Place ID: " . $r['pl_p_id'] . " Usage: " . $r['cnt'] . "\n";
    // Get name
    $stmtName = $pdo->prepare("SELECT p_place FROM wt_places WHERE p_id = :id");
    $stmtName->execute(['id' => $r['pl_p_id']]);
    $name = $stmtName->fetchColumn();
    echo "  Name: $name\n";
}
