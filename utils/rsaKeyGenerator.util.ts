import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const __rootDir = path.resolve(__dirname, '..');

function rsaKeyGenerator() {
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
  });
  const { publicKey, privateKey } = keyPair;
  return { publicKey, privateKey };
}
function writeTokenAccessKeyInEnvFile(
  publicKeyPropertyName: string,
  privateKeyPropertyName: string,
) {
  const { publicKey, privateKey } = rsaKeyGenerator();
  const envPath = `${__rootDir}/.env`;
  const envFile = fs.readFileSync(envPath, 'utf8');

  let newEnvFile = replaceOrAppend(
    envFile,
    escapeNewLines(publicKeyPropertyName),
    publicKey,
  );
  newEnvFile = replaceOrAppend(
    newEnvFile,
    escapeNewLines(privateKeyPropertyName),
    privateKey,
  );

  fs.writeFileSync(envPath, newEnvFile);
}

function replaceOrAppend(
  fileContent: string,
  propertyName: string,
  propertyValue: string,
) {
  const propertyRegex = new RegExp(`^${propertyName}="[^]*?"`, 'ms');
  const newPropertyLine = `${propertyName}="${propertyValue}"`;

  if (fileContent.match(propertyRegex)) {
    return fileContent.replace(propertyRegex, newPropertyLine);
  } else {
    return fileContent.trim() + '\n' + newPropertyLine;
  }
}
function escapeNewLines(str: string) {
  return str.replace(/\n/g, '\\n');
}

writeTokenAccessKeyInEnvFile('ACCESS_TOKEN_PUBLIC', 'ACCESS_TOKEN_SECRET');
writeTokenAccessKeyInEnvFile('REFRESH_TOKEN_PUBLIC', 'REFRESH_TOKEN_SECRET');
