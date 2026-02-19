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

echo "Trees in Database:\n";
$stmt = $pdo->query("SELECT gedcom_id, gedcom_name FROM wt_gedcom");
while ($row = $stmt->fetch()) {
    echo "ID: " . $row['gedcom_id'] . " | Name: '" . $row['gedcom_name'] . "'\n";
}
