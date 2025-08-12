import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const __rootDir = path.resolve(__dirname, '..');
const keysDir = path.join(__rootDir, 'keys');

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir);
}

function rsaKeyGenerator() {
  return crypto.generateKeyPairSync('rsa', {
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
}

function writeKeyFiles(baseName: string) {
  const { publicKey, privateKey } = rsaKeyGenerator();

  const publicPath = path.join(keysDir, `${baseName}_public.pem`);
  const privatePath = path.join(keysDir, `${baseName}_private.pem`);

  fs.writeFileSync(publicPath, publicKey);
  fs.writeFileSync(privatePath, privateKey);

  console.log(`✅ Keys written: ${publicPath}, ${privatePath}`);
}

writeKeyFiles('access_token');
writeKeyFiles('refresh_token');
