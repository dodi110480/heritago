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

echo "---- wt_places ----\n";
$stmt = $pdo->prepare("SELECT p_id, p_place FROM wt_places WHERE p_place LIKE :place LIMIT 5");
$stmt->execute(['place' => '%Coburg%']);
$results = $stmt->fetchAll();
foreach ($results as $row) {
    echo "ID: " . $row['p_id'] . ", Place: " . $row['p_place'] . "\n";
}

echo "\n---- wt_place_location ----\n";
$stmt = $pdo->prepare("SELECT id, place, latitude, longitude FROM wt_place_location WHERE place LIKE :place LIMIT 5");
$stmt->execute(['place' => '%Coburg%']);
$results = $stmt->fetchAll();
foreach ($results as $row) {
    echo "ID: " . $row['id'] . ", Place: " . $row['place'] . " (" . $row['latitude'] . ", " . $row['longitude'] . ")\n";
}
