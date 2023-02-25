<?php
// Check if any of the fields are empty
if (empty($_POST['name']) || empty($_POST['email']) || empty($_POST['subject']) || empty($_POST['message']))
  { echo 'You haven\'t filled out all fields correctly. Please go back and try again.'; }

//$con = mysqli_connect('localhost','id20357689_root','?1Ftr5Qntz%|MF3T','id20357689_autoviz');
//$con = new PDO("mysql:host=localhost;dbname=id20357689_autoviz", "id20357689_root", "?1Ftr5Qntz%|MF3T");
// set the PDO error mode to exception
//$con->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$mysqli = new mysqli('localhost','id20357689_root','?1Ftr5Qntz%|MF3T','id20357689_autoviz');

$name = $_POST['name'];
$email = $_POST['email'];
$subject = $_POST['subject'];
$msg = $_POST['message'];

//$query = "SELECT * FROM users WHERE name = ?";
$query = "INSERT INTO dtbl_av_contacts (name, email, subject, message) 
            VALUES (?,?,?,?)";
$stmt = $mysqli -> prepare($query);
$stmt -> bind_param("ssss", $name, $email, $subject, $msg);
$stmt -> execute();

$mysqli -> close();

header("Location: /");

?>