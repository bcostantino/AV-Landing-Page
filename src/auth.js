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

const findUserById = async (id) => {
  const results = await dbQuery('SELECT * FROM users WHERE id = ?', [id]);
  return (results.length) ? results[0] : null;
}

const findUserByEmail = async (email) => {
  const results = await dbQuery('SELECT * FROM users WHERE email = ?', [email]);
  return (results.length) ? results[0] : null;
}

const createUser = async (name, email, password) => {
  const existingUser = await findUserByEmail(email);
  if (existingUser) return;

  const defaultUsername = `${name.replace(' ', '_').toLowerCase()}_${Math.floor(Math.random() * 10000)}`;
  const hPr = saltNHash(password);
  const hashedPassword = toPassword(hPr);

  const results = await dbQuery('INSERT INTO users(name,username,email,password) VALUES(?,?,?,?)', [name, defaultUsername, email, hashedPassword]);
  console.log(results);
  return (await findUserById(results['insertId']));
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

module.exports = {
  dbTest,
  createUser,
  findUserByEmail,
  validateEmail,
  validateLogin
}
