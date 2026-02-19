<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;dbname=heritago', 'heritago', 'heritago');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Checking for dangling references in tree 2...\n";

    // 1. Check f_husb
    $stmt = $pdo->query("SELECT f_id, f_husb FROM wt_families WHERE f_file = 2 AND f_husb != ''");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $check = $pdo->prepare("SELECT COUNT(*) FROM wt_individuals WHERE i_id = ? AND i_file = 2");
        $check->execute([$row['f_husb']]);
        if ($check->fetchColumn() == 0) {
            echo "Family {$row['f_id']} points to non-existent husband: {$row['f_husb']}\n";
        }
    }

    // 2. Check f_wife
    $stmt = $pdo->query("SELECT f_id, f_wife FROM wt_families WHERE f_file = 2 AND f_wife != ''");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $check = $pdo->prepare("SELECT COUNT(*) FROM wt_individuals WHERE i_id = ? AND i_file = 2");
        $check->execute([$row['f_wife']]);
        if ($check->fetchColumn() == 0) {
            echo "Family {$row['f_id']} points to non-existent wife: {$row['f_wife']}\n";
        }
    }

    // 3. Check CHIL in f_gedcom
    $stmt = $pdo->query("SELECT f_id, f_gedcom FROM wt_families WHERE f_file = 2");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        preg_match_all('/1 CHIL @([^@]+)@/', $row['f_gedcom'], $matches);
        foreach ($matches[1] as $childId) {
            $check = $pdo->prepare("SELECT COUNT(*) FROM wt_individuals WHERE i_id = ? AND i_file = 2");
            $check->execute([$childId]);
            if ($check->fetchColumn() == 0) {
                echo "Family {$row['f_id']} points to non-existent child: $childId\n";
            }
        }
    }

    echo "Check complete.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
