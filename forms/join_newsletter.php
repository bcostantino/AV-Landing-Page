<?php
// Check if any of the fields are empty
if (empty($_POST['email']))
  { echo 'You haven\'t filled out all fields correctly. Please go back and try again.'; }

$mysqli = new mysqli('localhost','id20357689_root','?1Ftr5Qntz%|MF3T','id20357689_autoviz');

$email = $_POST['email'];
echo $email;

$query = "INSERT INTO dtbl_av_newsletter (email) 
            VALUES (?)";
$stmt = $mysqli -> prepare($query);
$stmt -> bind_param("s", $email);
$stmt -> execute();

$mysqli -> close();

header("Location: /");

?>