<?php
// Check if any of the fields are empty
if (empty($_POST['name']) || empty($_POST['email']) || empty($_POST['subject']) || empty($_POST['message']))
  { echo 'You haven\'t filled out all fields correctly. Please go back and try again.'; }

//$con = mysqli_connect('localhost','id20357689_root','?1Ftr5Qntz%|MF3T','id20357689_autoviz');
$con = new PDO("mysql:host=localhost;dbname=id20357689_autoviz", "id20357689_root", "?1Ftr5Qntz%|MF3T");
// set the PDO error mode to exception
$con->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// This is important to prevent injection attacks
//echo $_POST['name'];
//echo $_POST['email'];
/*$nameQuery = mysqli_real_escape_string($_POST['name']);
$emailQuery = mysqli_real_escape_string($_POST['email']);
$subjectQuery = mysqli_real_escape_string($_POST['subject']);
$messageQuery = mysqli_real_escape_string($_POST['message']);*/

$name = $_POST['name'];
$email = $_POST['email'];
$subject = $_POST['subject'];
$msg = $_POST['message'];

try {
    // The query.
    $query = "INSERT INTO dtbl_av_contacts (name, email, subject, message) 
                VALUES ('$name','$email','$subject','$msg')";
    //$sth = $con->prepare($query)
    //$sth->execute([$_POST['name'], $_POST['email'], $_POST['subject'], $_POST['message']]);
    //echo $query;
    $con->exec($query);
    echo 'Successfully registered!';
}
catch(PDOException $e) {
    echo $sql . "<br>" . $e->getMessage();
}

$conn = null;

?>