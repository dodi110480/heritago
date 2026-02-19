<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$port = '3306';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset;port=$port";
try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
} catch (\PDOException $e) {
    die("DB Error: " . $e->getMessage());
}

echo "All Places (checking for hidden chars):\n";
echo "---------------------------------------\n";

$stmt = $pdo->query("SELECT p_id, p_place FROM wt_places WHERE p_file = 1 LIMIT 50");
while ($row = $stmt->fetch()) {
    $name = $row['p_place'];
    $hex = bin2hex($name);
    echo "ID: " . $row['p_id'] . " | Name: '" . $name . "' | Hex: " . $hex . "\n";
}
