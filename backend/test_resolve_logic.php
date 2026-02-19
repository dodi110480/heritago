<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$charset = 'utf8mb4';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_OBJ
    ]);
} catch (\PDOException $e) {
    die($e->getMessage());
}

function resolvePlaceId($pdo, $treeId, $fullName)
{
    $parts = array_map('trim', explode(',', $fullName));
    $parts = array_reverse($parts);

    echo "Parts (reversed): " . implode(' | ', $parts) . "\n";

    $parentId = 0;
    $lastId = null;

    foreach ($parts as $part) {
        echo "Looking for: '$part' with parent: $parentId ... ";
        $stmt = $pdo->prepare("SELECT p_id, p_place FROM wt_places WHERE p_file = ? AND p_place = ? AND p_parent_id = ?");
        $stmt->execute([$treeId, $part, $parentId]);
        $row = $stmt->fetch();

        if (!$row) {
            echo "NOT FOUND\n";
            return null;
        }

        echo "FOUND ID: " . $row->p_id . "\n";
        $parentId = $row->p_id;
        $lastId = $row->p_id;
    }

    return $lastId;
}

$treeId = 2; // Assuming tree ID 2 as seen in check_gedcom_compliance
$searchName = "Rathaus, Maroldsweisach, Maroldsweisach, Bayern, Deutschland";

echo "Testing resolvePlaceId for: '$searchName' in Tree $treeId\n";
$id = resolvePlaceId($pdo, $treeId, $searchName);
echo "Result ID: " . ($id ?? "NULL") . "\n";

echo "\nTesting for name with empty parts if applicable...\n";
// Let's check what names we actually have in the DB again
$stmt = $pdo->query("SELECT p_id, p_place FROM wt_places WHERE p_file = 2");
while ($r = $stmt->fetch()) {
    echo "ID: " . $r->p_id . " Name: '" . $r->p_place . "'\n";
}
