//const crypto = require('crypto');
//const mysql  = require('mysql');
import * as crypto from 'crypto';

import * as nodemailer from 'nodemailer';
import { dbQuery } from './db';
import { User } from './models/auth';
/*import * as mysql from 'mysql';
const config = {
  host    : 'localhost',
  user    : 'av_business',
  password: 'YWanqz3imyfJ@8w#BUpC',
  database: 'autoviz_business'
};
const connection = mysql.createConnection(config);

 see https://darifnemma.medium.com/how-to-interact-with-mysql-database-using-async-await-promises-in-node-js-9e6c81b683da 
const dbQuery = (query: string, params?: any[]): Promise<any[]> => {
  return new Promise((resolve,reject) => {
    connection.query(query, params, function(err, results) {
      if (err) {
        return reject(err);
      }
      return resolve(results);
    });
  });
}*/

const getRandomString = (len = 20) => {
  const pwdChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array(len).fill(pwdChars).map((x) => { return x[Math.floor(Math.random() * x.length)] }).join('');
}

function generateUUID() { // Public Domain/MIT
  var d = new Date().getTime();//Timestamp
  var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16;//random number between 0 and 16
      if(d > 0){//Use timestamp until depleted
          r = (d + r)%16 | 0;
          d = Math.floor(d/16);
      } else {//Use microseconds since page-load if supported
          r = (d2 + r)%16 | 0;
          d2 = Math.floor(d2/16);
      }
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const convertToSeconds = (timeString: string): number => {
  let seconds = 0;
  if (timeString.endsWith('s')) {
    seconds = parseInt(timeString);
  } else if (timeString.endsWith('m')) {
    seconds = parseInt(timeString) * 60;
  } else if (timeString.endsWith('h')) {
    seconds = parseInt(timeString) * 60 * 60;
  } else if (timeString.endsWith('d')) {
    seconds = parseInt(timeString) * 60 * 60 * 24;
  }
  return seconds;
}

const SALT_LENGTH = 20;

const _hash_sha512 = (text) => {
  return crypto.createHash('sha512').update(text);
}

const saltNHash = (rawText, hash = '') => {
  const salt = (hash) ? hash : getRandomString(SALT_LENGTH); //DEFAULT_SALT;
  const saltedText = salt + rawText;
  const sha = _hash_sha512(saltedText);
  return {
    value: sha.digest('hex'),
    salt: salt
  };
}

const toPassword = (saltHash) => {
  const salt = saltHash.salt;
  const partOne = salt.slice(0, SALT_LENGTH / 2);
  const partTwo = salt.slice(SALT_LENGTH / 2, SALT_LENGTH);
  return `${partOne}${saltHash.value}${partTwo}`;
}

const fromPassword = (pwd) => {
  const salt = pwd.slice(0, SALT_LENGTH / 2) + pwd.slice(pwd.length - (SALT_LENGTH / 2), pwd.length);
  const hashedPassword = pwd.slice(SALT_LENGTH / 2, pwd.length - (SALT_LENGTH / 2));
  return {
    value: hashedPassword,
    salt: salt
  };
}

const userFromDbResult = (result: any) => {
  return <User> {
    id: result['id'],
    name: result['name'],
    email: result['email'],
    password: result['password'],
    emailVerified: result['email_verified']
  };
}

const findUserById = async (id) => {
  const results = await dbQuery('SELECT * FROM users WHERE id = ?', [id]);
  return (results.length) ? userFromDbResult(results[0]) : null;
}

const findUserByEmail = async (email) => {
  const results = await dbQuery('SELECT * FROM users WHERE email = ?', [email]);
  return (results.length) ? userFromDbResult(results[0]) : null;
}

const createUser = async (name: string, email: string, password: string) => {
  const existingUser = await findUserByEmail(email);
  if (existingUser) return;

  const defaultUsername = `${name.replace(' ', '_').toLowerCase()}_${Math.floor(Math.random() * 10000)}`;
  const hPr = saltNHash(password);
  const hashedPassword = toPassword(hPr);

  const results = await dbQuery('INSERT INTO users(name,username,email,password) VALUES(?,?,?,?)', [name, defaultUsername, email, hashedPassword]);
  console.log(results);
  return (await findUserById(results['insertId']));
}

const setUserEmailVerifiedById = async (id: number) => {
  const results = await dbQuery('UPDATE users SET email_verified = TRUE WHERE id', [id]);
}

const findUserEmailVerificationById = async (id: number) => {
  const results = await dbQuery('SELECT * FROM user_email_verification WHERE id = ?', [id]);
  return (results.length) ? results[0] : null;
}

const findActiveUserEmailVerificationByKey = async (key: string) => {
  const results = await dbQuery('SELECT * FROM user_email_verification WHERE _key = ? AND active = TRUE', [key]);
  return (results.length) ? results[0] : null;
}

const findActiveEmailVerificationByUserId = async (userId: number) => {
  const results = await dbQuery('SELECT * FROM user_email_verification WHERE user_id = ? AND active = TRUE', [userId]);
  return (results.length) ? results[0] : null;
}

const deactivateUserEmailVerificationById = async (id: number) => {
  await dbQuery('UPDATE user_email_verification SET active = FALSE WHERE id = ?', [id]);
}

const createUserEmailVerification = async (userId: number, expiration: Date) => {
  const existingUserEmailVerification = await findActiveEmailVerificationByUserId(userId);
  if (existingUserEmailVerification) {
    console.log('user email verification already exists');
    await deactivateUserEmailVerificationById(existingUserEmailVerification['id']);
  }
  
  const results = await dbQuery('INSERT INTO user_email_verification(user_id, _key, expires_at) VALUES(?,?,?)', [userId, getRandomString(128), expiration]);
  return (await findUserEmailVerificationById(results['insertId']));
}

const validateLogin = async (user, password) => {
  const pwd = fromPassword(user['password']);

  return pwd.value === saltNHash(password, pwd.salt).value;

  console.log('password decoded from db: ', pwd);
  console.log('password from user: ', password);
  console.log('password salted and hashed', saltNHash(password, pwd.salt));
  console.log('result: ', pwd.value === saltNHash(password, pwd.salt).value);
}

const dbTest = async () => {
  const results = await dbQuery('SELECT * FROM users');
  console.log(results);
}

const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};
const addMinutes = (date: Date, minutes: number) => {
  return new Date(date.getTime() + minutes*60000);
}



const sendEmailVerification = async (user: object) => {
  const verification = await createUserEmailVerification(user['id'], addMinutes(new Date(), 15));
  console.log('insert email verification: ', verification);
  const verificationUrl = `http://127.0.0.1:4242/verify-email/${verification['_key']}`;

  var transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, //"live.smtp.mailtrap.io",
    port: parseInt(process.env.SMTP_PORT), //587,
    auth: {
      user: process.env.SMTP_USER, //'api',
      pass: process.env.SMTP_PASSWORD //'04d8901bbd373b55066a415dfda99302'
    }
  });
  const mailOptions = {
    from: 'noreply@autoviz.net',
    to: user['email'],
    subject: 'Please verify your email address',
    html: `
<!DOCTYPE html>
<html>
  <head>
  <meta charset="utf-8">
    <title></title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  </head>
  <body>
    To secure your AutoViz account, we just need to verify your email address: ${user['email']}. <a href="${verificationUrl}">Verify email address</a>
  </body>
</hmtl>
    `
  
  };

  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}



/*module.exports = {
  dbTest,
  createUser,
  findUserByEmail,
  validateEmail,
  validateLogin
}*/
export {
  dbTest,
  createUser,
  findUserByEmail,
  validateEmail,
  validateLogin,
  setUserEmailVerifiedById,
  sendEmailVerification,
  findActiveUserEmailVerificationByKey,
  deactivateUserEmailVerificationById,

  convertToSeconds,

  getRandomString,
  generateUUID
}