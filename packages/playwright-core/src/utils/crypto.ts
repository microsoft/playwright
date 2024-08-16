/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import crypto from 'crypto';

export function createGuid(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function calculateSha1(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}

const encodeBase128 = (value: number) => {
  const bytes = new Uint8Array(calculateBase128BytesNeeded(value));
  const lastPos = bytes.byteLength - 1;
  let pos = lastPos;
  do {
    let byte = value & 0x7f; // Take the last 7 bits
    value >>>= 7; // Shift right, unsigned
    if (pos !== lastPos) {
      byte |= 0x80; // Set the continuation bit on all but the first byte
    }
    bytes[pos--] = byte; // Insert the byte at the start of the array
  } while (value > 0);
  return bytes;
};

const calculateBase128BytesNeeded = (num: number) => {
  // Start at 6 and not 0 to account for overflow and to ensure that the
  // division below always gives a value equal to or greater than 1.
  // For example, consider the following 'real' bits needed:
  // 0: 6 (initial value) + 1 (real) => 7 / 7 = 1
  // 7: 6 (initial value) + 7 (real) => 13 / 7 = 1
  // 8: 6 (initial value) + 8 (real) => 14 / 7 = 2
  let bitsNeeded = 6;

  do {
    bitsNeeded++;
    num >>>= 1;
  } while (num > 0);

  return (bitsNeeded / 7) >>> 0;
};

class ASN1 {
  static toSequence(data: Buffer[]): Buffer {
    return this._encode(0x30, Buffer.concat(data));
  }
  static toInteger(data: number): Buffer {
    return this._encode(0x02, Buffer.from([data]));
  }
  static toObject(oid: string): Buffer {
    const parts = oid.split('.').map((v) => Number(v));
    // Encode the second part, which could be large, using base-128 encoding if necessary
    const output = [encodeBase128(40 * parts[0] + parts[1])];

    for (let i = 2; i < parts.length; i++) {
      output.push(encodeBase128(parts[i]));
    }

    return this._encode(0x06, Buffer.concat(output));
  }
  static toNull(): Buffer {
    return Buffer.from([0x05, 0x00]);
  }
  static toSet(data: Buffer[]): Buffer {
    return this._encode(0x31, Buffer.concat(data));
  }
  static toContextSpecific(tag: number, data: Buffer): Buffer {
    return this._encode(0xa0 + tag, data);
  }
  static toPrintableString(data: string): Buffer {
    return this._encode(0x13, Buffer.from(data));
  }
  static toBitString(data: Buffer): Buffer {
    // The first byte of the content is the number of unused bits at the end
    const unusedBits = 0; // Assuming all bits are used
    const content = Buffer.concat([Buffer.from([unusedBits]), data]);
    return this._encode(0x03, content);
  }
  static toUtcTime(date: Date): Buffer {
    const parts = [
      date.getUTCFullYear().toString().slice(-2),
      (date.getUTCMonth() + 1).toString().padStart(2, '0'),
      date.getUTCDate().toString().padStart(2, '0'),
      date.getUTCHours().toString().padStart(2, '0'),
      date.getUTCMinutes().toString().padStart(2, '0'),
      date.getUTCSeconds().toString().padStart(2, '0')
    ];
    return this._encode(0x17, Buffer.from(parts.join('') + 'Z'));
  }
  private static _encode(tag: number, data: Buffer): Buffer {
    const lengthBytes = this._encodeLength(data.length);
    return Buffer.concat([Buffer.from([tag]), lengthBytes, data]);
  }
  private static _encodeLength(length: number): Buffer {
    if (length < 128) {
      return Buffer.from([length]);
    } else {
      const lengthBytes = [];
      while (length > 0) {
        lengthBytes.unshift(length & 0xFF);
        length >>= 8;
      }
      return Buffer.from([0x80 | lengthBytes.length, ...lengthBytes]);
    }
  }
}

export function generateSelfSignedCertificate(commonName: string) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyDer = publicKey.export({ type: 'pkcs1', format: 'der' });

  const tbsCertificate = ASN1.toSequence([
    ASN1.toContextSpecific(0, ASN1.toInteger(1)), // version
    ASN1.toInteger(1), // serialNumber
    ASN1.toSequence([
      ASN1.toObject('1.2.840.113549.1.1.11'),
      ASN1.toNull()
    ]), // signature
    ASN1.toSequence([
      ASN1.toSet([
        ASN1.toSequence([
          ASN1.toObject('2.5.4.3'),
          ASN1.toPrintableString(commonName)
        ]),
        ASN1.toSequence([
          ASN1.toObject('2.5.4.10'),
          ASN1.toPrintableString('Client Certificate Demo')
        ])
      ])
    ]), // issuer
    ASN1.toSequence([
      ASN1.toUtcTime(new Date()),
      ASN1.toUtcTime(new Date()),
    ]), // validity
    ASN1.toSequence([
      ASN1.toSet([
        ASN1.toSequence([
          ASN1.toObject('2.5.4.3'),
          ASN1.toPrintableString(commonName)
        ]),
        ASN1.toSequence([
          ASN1.toObject('2.5.4.10'),
          ASN1.toPrintableString('Client Certificate Demo')
        ])
      ])
    ]), // subject
    ASN1.toSequence([
      ASN1.toSequence([
        ASN1.toObject('1.2.840.113549.1.1.1'),
        ASN1.toNull()
      ]),
      ASN1.toBitString(publicKeyDer)
    ]), // SubjectPublicKeyInfo
  ]);

  const signature = crypto.sign('sha256', tbsCertificate, privateKey);

  const certificate = ASN1.toSequence([
    tbsCertificate,
    ASN1.toSequence([
      ASN1.toObject('1.2.840.113549.1.1.11'),
      ASN1.toNull()
    ]),
    ASN1.toBitString(signature)
  ]);

  const certPem = [
      '-----BEGIN CERTIFICATE-----',
      certificate.toString('base64').match(/.{1,64}/g)!.join('\n'),
      '-----END CERTIFICATE-----'
  ].join('\n');

  return {
    cert: certPem,
    key: privateKey.export({ type: 'pkcs1', format: 'pem' }),
  };
}
