<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
$charset = 'utf8mb4';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset", $user, $pass);
} catch (\PDOException $e) {
    die($e->getMessage());
}

echo "Checking wt_places Hierarchy (Parent Links):\n";
echo "-------------------------------------------\n";

$sql = "SELECT p_id, p_place, p_parent_id FROM wt_places ORDER BY p_id DESC LIMIT 20";
$stmt = $pdo->query($sql);

$places = [];
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $places[$row['p_id']] = $row;
}

foreach ($places as $id => $p) {
    $fullName = $p['p_place'];
    $parentId = $p['p_parent_id'];
    $visited = [$id];

    while ($parentId != 0) {
        $stmtParent = $pdo->prepare("SELECT p_id, p_place, p_parent_id FROM wt_places WHERE p_id = ?");
        $stmtParent->execute([$parentId]);
        $parent = $stmtParent->fetch(PDO::FETCH_ASSOC);

        if (!$parent || in_array($parent['p_id'], $visited))
            break;

        $fullName .= ", " . $parent['p_place'];
        $parentId = $parent['p_parent_id'];
        $visited[] = $parent['p_id'];
    }

    $commaCount = substr_count($fullName, ',');
    echo "ID: $id | Full Reconstructed: '$fullName' | Commas: $commaCount\n";
}
