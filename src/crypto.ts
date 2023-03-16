import * as libCrypto from 'crypto';

const algo = 'aes-256-cbc';
const key = libCrypto.randomBytes(32);
const initVector = libCrypto.randomBytes(16);

const encrypt = (text: string): string => {
  var cipher = libCrypto.createCipheriv(algo, key, initVector);
  return Buffer.concat([
    cipher.update(text),
    cipher.final()
  ]).toString('hex'); // Output hex string
}
  
const decrypt = (text: string): string => {
  if (text === null || typeof text === 'undefined' || text === '') throw new Error("Invalid encrypted string provided as 'text' parameter");
  var decipher = libCrypto.createDecipheriv(algo, key, initVector);
  return Buffer.concat([
    decipher.update(text, 'hex'), // Expect `text` to be a hex string
    decipher.final()
  ]).toString();
}

export {
  encrypt,
  decrypt
}