<?php
$host = '127.0.0.1';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
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

echo "Tables:\n";
$stmt = $pdo->query("SHOW TABLES");
while ($row = $stmt->fetch()) {
    echo $row[0] . "\n";
}

echo "\nTrees (wt_gedcom presumably):\n";
try {
    $stmt = $pdo->query("SELECT * FROM wt_gedcom");
    while ($row = $stmt->fetch()) {
        print_r($row);
    }
} catch (Exception $e) {
    echo "Could not select from wt_gedcom: " . $e->getMessage() . "\n";
}

echo "\nIndividuals count per tree (i_file):\n";
try {
    $stmt = $pdo->query("SELECT i_file, COUNT(*) as count FROM wt_individuals GROUP BY i_file");
    while ($row = $stmt->fetch()) {
        print_r($row);
    }
} catch (Exception $e) {
    echo "Could not count individuals: " . $e->getMessage() . "\n";
}

echo "\nFirst 20 individuals:\n";
try {
    $stmt = $pdo->query("SELECT i_id, i_file, i_rin, i_sex, i_gedcom FROM wt_individuals LIMIT 20");
    while ($row = $stmt->fetch()) {
        // truncate gebcom for readability
        $row['i_gedcom'] = substr($row['i_gedcom'], 0, 50) . "...";
        print_r($row);
    }
} catch (Exception $e) {
    echo "Error listing individuals: " . $e->getMessage() . "\n";
}
