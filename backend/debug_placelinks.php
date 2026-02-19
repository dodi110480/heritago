<?php
$host = 'localhost'; $db = 'heritago'; $user = 'heritago'; $pass = 'heritago'; $charset = 'utf8mb4'; $port = 3306;
$pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset;port=$port", $user, $pass);
$stmt = $pdo->prepare("describe wt_placelinks");
$stmt->execute();
foreach($stmt->fetchAll() as $row) { echo $row['Field']." "; }

