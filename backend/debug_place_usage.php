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

// 1. Find the places related to the user's issue
$search = "%Maroldsweisach%";
echo "Searching for '$search'...\n";

$stmt = $pdo->prepare("SELECT p_id, p_place FROM wt_places WHERE p_place LIKE :s");
$stmt->execute(['s' => $search]);
$places = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($places as $p) {
    echo "ID: " . $p['p_id'] . " | Name: " . $p['p_place'] . "\n";

    // Check usage in placelinks
    $stmtLink = $pdo->prepare("SELECT COUNT(*) as cnt FROM wt_placelinks WHERE pl_p_id = :pid");
    $stmtLink->execute(['pid' => $p['p_id']]);
    $count = $stmtLink->fetchColumn();
    echo "    -> Usage in placelinks: $count\n";
    echo "------------------------------------------------\n";
}

// 2. Also check 'Deutschland' and 'Bayern, Deutschland'
$extras = ['Deutschland', 'Bayern, Deutschland'];
foreach ($extras as $name) {
    $stmt = $pdo->prepare("SELECT p_id, p_place FROM wt_places WHERE p_place = :s");
    $stmt->execute(['s' => $name]);
    $p = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($p) {
        echo "ID: " . $p['p_id'] . " | Name: " . $p['p_place'] . "\n";
        $stmtLink = $pdo->prepare("SELECT COUNT(*) as cnt FROM wt_placelinks WHERE pl_p_id = :pid");
        $stmtLink->execute(['pid' => $p['p_id']]);
        $count = $stmtLink->fetchColumn();
        echo "    -> Usage in placelinks: $count\n";
        echo "------------------------------------------------\n";
    }
}
