const crypto = require('crypto');
const mysql  = require('mysql');
const config = {
  host    : 'localhost',
  user    : 'av_business',
  password: 'YWanqz3imyfJ@8w#BUpC',
  database: 'autoviz_business'
};
const connection = mysql.createConnection(config);

/** see https://darifnemma.medium.com/how-to-interact-with-mysql-database-using-async-await-promises-in-node-js-9e6c81b683da */
const dbQuery = (query, params) => {
  return new Promise((resolve,reject) => {
    connection.query(query, params, function(err, results) {
      if (err) {
        return reject(err);
      }
      return resolve(results);
    });
  });
}

const getRandomString = (len = 20) => {
  const pwdChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array(len).fill(pwdChars).map((x) => { return x[Math.floor(Math.random() * x.length)] }).join('');
}

const DEFAULT_SALT = '3x4m1n3w4171n6';
const saltNHash = (rawText) => {
  const salt = getRandomString(); //DEFAULT_SALT;
  const saltedText = salt + rawText;
  const sha = crypto.createHash('sha512').update(saltedText);
  return {
    value: sha.digest('hex'),
    salt: salt
  };
}

const toPassword = (saltHash) => {
  const salt = saltHash.salt;
  const partOne = salt.slice(0, salt / 2);
  const partTwo = salt.slice(salt / 2, salt);
  return `${partOne}${saltHash.value}${partTwo}`;
}

const getUserById = async (id) => {
  const results = await dbQuery('SELECT * FROM users WHERE id = ?', [id]);
  return (results.length) ? results[0] : null;
}

const getUserByEmail = async (email) => {
  const results = await dbQuery('SELECT * FROM users WHERE email = ?', [email]);
  return (results.length) ? results[0] : null;
}

const createUser = async (name, email, password) => {
  const existingUser = await getUserByEmail(email);
  if (existingUser) return;

  const defaultUsername = `${name.replace(' ', '_').toLowerCase()}_${Math.floor(Math.random() * 10000)}`;
  const hPr = saltNHash(password);
  const hashedPassword = toPassword(hPr);

  const results = await dbQuery('INSERT INTO users(name,username,email,password) VALUES(?,?,?,?)', [name, defaultUsername, email, hashedPassword]);
  console.log(results);
  return (await getUserById(results['insertId']));
}

const dbTest = async () => {
  const results = await dbQuery('SELECT * FROM users');
  console.log(results);
}

module.exports = {
  dbTest,
  createUser,
  getUserByEmail
}
