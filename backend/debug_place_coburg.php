<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$port = '3306';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset;port=$port";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    throw new \PDOException($e->getMessage(), (int) $e->getCode());
}

$stmt = $pdo->prepare("SELECT p_id, p_place, p_std_lat, p_std_long FROM wt_places WHERE p_place LIKE :place");
$stmt->execute(['place' => '%Coburg%']);
$results = $stmt->fetchAll();

if (empty($results)) {
    echo "No places found matching 'Coburg'.\n";
} else {
    foreach ($results as $row) {
        echo "Place: " . $row['p_place'] . "\n";
        echo "ID: " . $row['p_id'] . "\n";
        echo "Latitude: " . ($row['p_std_lat'] ?? 'NULL') . "\n";
        echo "Longitude: " . ($row['p_std_long'] ?? 'NULL') . "\n";
        echo "--------------------------\n";
    }
}
