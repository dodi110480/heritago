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

$stmt = $pdo->prepare("SELECT * FROM wt_place_location LIMIT 5");
$stmt->execute();
$results = $stmt->fetchAll();

foreach ($results as $row) {
    print_r($row);
}

$stmt = $pdo->prepare("describe wt_place_location");
$stmt->execute();
foreach ($stmt->fetchAll() as $row) {
    echo $row['Field'] . " (" . $row['Type'] . ")\n";
}
