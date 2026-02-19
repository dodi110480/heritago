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

$stmt = $pdo->query("SELECT log_time, SUBSTRING(log_message, 1, 1000) as msg FROM wt_log ORDER BY log_id DESC LIMIT 5");
while ($row = $stmt->fetch()) {
    echo "Time: " . $row['log_time'] . "\n";
    echo "Message: " . $row['msg'] . "\n";
    echo "------------------\n";
}
