<?php
$host = 'localhost';
$db = 'heritago';
$user = 'heritago';
$pass = 'heritago';
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $stmt = $pdo->query("SELECT user_name, user_email FROM wt_user");
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "Username: " . $r['user_name'] . "\n";
    }
} catch (Exception $e) {
    echo $e->getMessage();
}
