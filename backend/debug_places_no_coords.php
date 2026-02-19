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

echo "Places without coordinates (Top 20):\n";
echo "---------------------------------\n";

// Find places in wt_places that do NOT have a corresponding entry in wt_place_location with lat/long
$sql = "
SELECT p_id, p_place,  LENGTH(p_place) as len
FROM wt_places 
WHERE p_file = 1
AND p_place NOT IN (
    SELECT place 
    FROM wt_place_location 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
)
LIMIT 20
";

$stmt = $pdo->query($sql);
while ($row = $stmt->fetch()) {
    echo "ID: " . $row['p_id'] . " | Name: '" . $row['p_place'] . "' | Length: " . $row['len'] . "\n";
}
