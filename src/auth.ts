//const crypto = require('crypto');
//const mysql  = require('mysql');
import * as crypto from 'crypto';
import * as encryption from './crypto';

import * as nodemailer from 'nodemailer';
import { dbQuery } from './db';
import { PublicUser, User, UserUpdate } from './models/auth';
import { findLicenseByUserId, toPublicLicense } from './licensing';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
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

const EMAIL_BLACKLIST = ["*@gmail.com", "example@blacklist.com", "test@spammy.net"];

function isEmailBlacklisted(email: string): boolean {
  const domain = email.split("@")[1];
  return EMAIL_BLACKLIST.some(blacklistedDomain =>
    blacklistedDomain.includes("*")
      ? domain.endsWith(blacklistedDomain.split("@")[1].replace("*", ""))
      : domain === blacklistedDomain.split("@")[1]
  );
}

const camelToUnderscore = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

/*
const email1 = "user1@gmail.com";
const email2 = "user2@spammy.net";

console.log(isEmailBlacklisted(email1)); // true
console.log(isEmailBlacklisted(email2)); // true
*/

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
    stripeCustomerId: result['stripe_customer_id'],
    emailVerified: !(!result['email_verified']),
    active: !(!result['active']),
    createdAt: result['created_at'],
    updatedAt: result['updated_at']
  };
}

const toPublicUser = async (user: User): Promise<PublicUser> => {
  return <PublicUser> {
    id: encryption.encrypt(user.id.toString()),
    name: user.name,
    email: user.email,
    stripeCustomerId: encryption.encrypt(user.stripeCustomerId),
    emailVerified: user.emailVerified,
    license: toPublicLicense(await findLicenseByUserId(user.id))
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

const findUserByCustomerId = async (customerId: string) => {
  const results = await dbQuery('SELECT * FROM users WHERE stripe_customer_id = ?', [customerId]);
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

const setUserCustomerIdById = async (id: number, customerId: string) => {
  const results = await dbQuery("UPDATE users SET stripe_customer_id = ? WHERE id = ?", [customerId, id]);
}



async function updateUserById(
  id: number,
  userUpdate: UserUpdate
): Promise<User> {
  const query = `UPDATE users SET ${
                Object.entries(userUpdate).filter(([key]) => userUpdate[key] !== undefined).map(([key]) => `${camelToUnderscore(key)} = ?`).join(',')
              } WHERE id = ?;`;

  const params = Object.values(userUpdate).filter((value) => value !== undefined);
  params.push(id);

  const results = await dbQuery(query, params);
  return (await findUserById(id));
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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

const sendEmail = async (recipientEmail: string, bodyContent: string, fromEmail = 'noreply@autoviz.net') => {

  const mailOptions = {
    from: fromEmail, //'noreply@autoviz.net',
    to: recipientEmail, //user['email'],
    subject: 'Please verify your email address',
    html: bodyContent
  
  };

  return new Promise<SMTPTransport.SentMessageInfo>((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info);
      }
    });
  });

}



const sendEmailVerification = async (user: User) => {
  const existingVerification = await findUserEmailVerificationById(user.id);
  if (existingVerification)
    await deactivateUserEmailVerificationById(existingVerification['id']);
  const verification = await createUserEmailVerification(user.id, addMinutes(new Date(), 15));
  //console.log('insert email verification: ', verification);
  const verificationUrl = `http://127.0.0.1:4242/verify-email/${verification['_key']}`;

  const info = await sendEmail(user['email'], `
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
        To secure your AutoViz account, we just need to verify your email address: ${user.email}. <a href="${verificationUrl}">Verify email address</a>
      </body>
    </hmtl>
  `);
  console.log('Email sent: ' + info.response);
}

const verifyEmail = async (key: string): Promise<string> => {
  const verification = await findActiveUserEmailVerificationByKey(key);

  if (!verification)
    return 'inactive'; // res.status(410).send('Verification link inactive');
  
  if (new Date() > verification['expires_at']) {
    await deactivateUserEmailVerificationById(verification['id']);
    return 'expired'; // res.status(498).send('Verification link expired');
  }

  await setUserEmailVerifiedById(verification['user_id']);
  await deactivateUserEmailVerificationById(verification['id']);
  console.log(key, verification);
  return 'success';
}



/*module.exports = {
  dbTest,
  createUser,
  findUserByEmail,
  validateEmail,
  validateLogin
}*/
export {
  toPublicUser,
  dbTest,
  createUser,
  updateUserById,
  findUserById,
  findUserByEmail,
  findUserByCustomerId,
  validateEmail,
  validateLogin,
  setUserEmailVerifiedById,
  setUserCustomerIdById,

  sendEmailVerification,
  verifyEmail,

  findActiveUserEmailVerificationByKey,
  deactivateUserEmailVerificationById,

  convertToSeconds,
  camelToUnderscore,

  getRandomString,
  generateUUID
}