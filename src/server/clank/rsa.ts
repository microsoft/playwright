/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';

const kRSANumWords = 64;

function generateKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'der'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  return { privateKey, publicKey: formatPublicKey(publicKey) };
}

function formatPublicKey(publicKey: Buffer): string {
  const modulus = publicKey.slice(33, 33 + kRSANumWords * 4);
  const n0 = BigInt.asUintN(64, BigInt('0x' + modulus.slice(modulus.length - 8).toString('hex')));
  const n0inv = BigInt('0x100000000') - modInverse(n0, BigInt('0x100000000'));
  const r = BigInt('0x1' + '0'.repeat(kRSANumWords * 4 * 4));
  const n = BigInt('0x' + modulus.toString('hex'));
  const rr = r % n;

  const prefix = Buffer.alloc(8);
  prefix.writeUInt32LE(64, 0);
  prefix.writeUInt32LE(Number(n0inv), 4);
  const suffix = Buffer.alloc(4);
  suffix.writeUInt32LE(65537, 0);
  const result = Buffer.concat([
    prefix,
    Buffer.from(n.toString(16), 'hex').reverse(),
    Buffer.from(rr.toString(16), 'hex').reverse(),
    suffix
  ]);
  return result.toString('base64');
}

function extendedGcd(a: bigint, b: bigint) {
  let x = 0n;
  let y = 1n;
  let u = 1n;
  let v = 0n;

  while (a !== 0n) {
    const q = b / a;
    const r = b % a;
    const m = x - (u * q);
    const n = y - (v * q);
    b = a;
    a = r;
    x = u;
    y = v;
    u = m;
    v = n;
  }
  return { g: b, x: x, y: y };
}

function modInverse(a: bigint, n: bigint): bigint {
  const { x } = extendedGcd(toZn(a, n), n);
  return toZn(x, n);
}

function toZn(a: bigint, n: bigint): bigint {
  a = a % n;
  return (a < 0) ? a + n : a;
}

export function rsaSign(privateKey: string, data: Buffer): Buffer {
  const sha1Prefix = Buffer.from('3021300906052b0e03021a05000414', 'hex');
  const message = Buffer.concat([sha1Prefix, data]);
  return crypto.privateEncrypt(privateKey, message);
}

export function loadOrGenerateKeys(): { privateKey: string, publicKey: string } {
  try {
    const privateKey = fs.readFileSync('.key/adbkey').toString();
    const publicKey = fs.readFileSync('.key/adbkey.pub').toString();
    return { privateKey, publicKey };
  } catch (e) {
    // Generate them.
  }

  const { privateKey, publicKey } = generateKeys();
  fs.mkdirSync('.key', { recursive: true });
  fs.writeFileSync('.key/adbkey', privateKey);
  fs.writeFileSync('.key/adbkey.pub', publicKey);
  return { privateKey, publicKey };
}
