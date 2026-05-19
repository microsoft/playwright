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

import * as rawWebAuthnSource from '../generated/webAuthnSource';
import { nullProgress } from './progress';

import type { BrowserContext } from './browserContext';
import type { InitScript } from './page';
import type { Progress } from '@protocol/progress';

const kBindingName = '__pwWebAuthnBinding';
const kAuthenticatorAAGUID = Buffer.alloc(16); // All-zero AAGUID for the virtual authenticator.

export type VirtualCredential = {
  id: string;          // base64url credentialId
  rpId: string;
  userHandle: string;  // base64url
  privateKey: string;  // base64url(DER PKCS#8)
  publicKey: string;   // base64url(DER SPKI)
};

type CredentialRecord = VirtualCredential & {
  signCount: number;
  isResident: boolean;
};

export class Credentials {
  private _browserContext: BrowserContext;
  private _initScripts: InitScript[] = [];
  private _installed = false;
  private _registry = new Map<string, CredentialRecord>();
  private _userVerified = true;

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  async create(options: {
    rpId: string,
    id?: string,
    userHandle?: string,
    privateKey?: string,
    publicKey?: string,
  }): Promise<VirtualCredential> {
    let privateKey = options.privateKey;
    let publicKey = options.publicKey;
    if (!privateKey || !publicKey) {
      const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
      privateKey = bufToB64Url(pair.privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer);
      publicKey = bufToB64Url(pair.publicKey.export({ format: 'der', type: 'spki' }) as Buffer);
    }
    const record: CredentialRecord = {
      id: options.id || randomBase64Url(16),
      rpId: options.rpId,
      userHandle: options.userHandle || randomBase64Url(16),
      privateKey,
      publicKey,
      signCount: 0,
      isResident: true,
    };
    this._registry.set(record.id, record);
    return toPublic(record);
  }

  async get(filter?: { rpId?: string, id?: string }): Promise<VirtualCredential[]> {
    return [...this._registry.values()].filter(c => {
      if (filter?.rpId && c.rpId !== filter.rpId)
        return false;
      if (filter?.id && c.id !== filter.id)
        return false;
      return true;
    }).map(toPublic);
  }

  async delete(id: string): Promise<void> {
    this._registry.delete(id);
  }

  setUserVerified(value: boolean) {
    this._userVerified = value;
  }

  async dispose(progress: Progress) {
    await progress.race(Promise.all(this._initScripts.map(s => s.dispose())));
    this._initScripts = [];
    this._installed = false;
    this._registry.clear();
  }

  async install(progress: Progress) {
    if (this._installed)
      return;
    this._installed = true;
    await this._browserContext.exposeBinding(progress, kBindingName, async (_source, payload: any) => {
      try {
        if (payload?.type === 'create')
          return await this._handleCreate(payload);
        if (payload?.type === 'get')
          return this._handleGet(payload);
      } catch (e) {
        return { ok: false, name: 'NotAllowedError', message: (e as Error).message };
      }
      return { ok: false, name: 'NotAllowedError', message: 'Unknown WebAuthn request' };
    });
    const script = `(() => {
      const module = {};
      ${rawWebAuthnSource.source}
      module.exports.inject()(globalThis);
    })();`;
    const initScript = await this._browserContext.addInitScript(nullProgress, script);
    this._initScripts.push(initScript);
    await progress.race(this._browserContext.safeNonStallingEvaluateInAllFrames(script, 'main', { throwOnJSErrors: false }));
  }

  private async _handleCreate(req: any) {
    const rpId = req.rp?.id || new URL(req.origin).hostname;
    const userHandle = req.user.id; // base64url
    // Check exclude list: if a credential matches, refuse.
    if (req.excludeCredentials?.length) {
      for (const desc of req.excludeCredentials) {
        if (this._registry.has(desc.id))
          return { ok: false, name: 'InvalidStateError', message: 'Credential excluded' };
      }
    }
    const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateKey = bufToB64Url(pair.privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer);
    const publicKey = bufToB64Url(pair.publicKey.export({ format: 'der', type: 'spki' }) as Buffer);
    const credentialId = crypto.randomBytes(16);
    const credentialIdB64 = bufToB64Url(credentialId);
    const record: CredentialRecord = {
      id: credentialIdB64,
      rpId,
      userHandle,
      privateKey,
      publicKey,
      signCount: 0,
      isResident: req.residentKey === 'required' || req.residentKey === 'preferred',
    };
    this._registry.set(credentialIdB64, record);

    const clientDataJSON = Buffer.from(JSON.stringify({
      type: 'webauthn.create',
      challenge: req.challenge,
      origin: req.origin,
      crossOrigin: false,
    }));
    const rpIdHash = crypto.createHash('sha256').update(rpId).digest();
    const flags = 0x01 | (this._userVerified ? 0x04 : 0) | 0x40; // UP | UV? | AT
    const signCountBuf = u32ToBytes(record.signCount);
    const cosePublicKey = encodeCoseEs256PublicKey(pair.publicKey);
    const credIdLenBuf = Buffer.from([(credentialId.length >> 8) & 0xff, credentialId.length & 0xff]);
    const attestedCredentialData = Buffer.concat([kAuthenticatorAAGUID, credIdLenBuf, credentialId, cosePublicKey]);
    const authData = Buffer.concat([rpIdHash, Buffer.from([flags]), signCountBuf, attestedCredentialData]);
    const attestationObject = encodeAttestationObjectNone(authData);
    return {
      ok: true,
      id: credentialIdB64,
      clientDataJSON: bufToB64Url(clientDataJSON),
      attestationObject: bufToB64Url(attestationObject),
    };
  }

  private _handleGet(req: any) {
    const rpId = req.rpId || new URL(req.origin).hostname;
    let candidate: CredentialRecord | undefined;
    if (req.allowCredentials?.length) {
      for (const desc of req.allowCredentials) {
        const c = this._registry.get(desc.id);
        if (c && c.rpId === rpId) {
          candidate = c;
          break;
        }
      }
    } else {
      // Resident credential lookup by rpId.
      for (const c of this._registry.values()) {
        if (c.rpId === rpId && c.isResident) {
          candidate = c;
          break;
        }
      }
    }
    if (!candidate)
      return { ok: false, name: 'NotAllowedError', message: 'No matching credential' };

    const clientDataJSON = Buffer.from(JSON.stringify({
      type: 'webauthn.get',
      challenge: req.challenge,
      origin: req.origin,
      crossOrigin: false,
    }));
    const rpIdHash = crypto.createHash('sha256').update(rpId).digest();
    const flags = 0x01 | (this._userVerified ? 0x04 : 0); // UP | UV?
    candidate.signCount += 1;
    const signCountBuf = u32ToBytes(candidate.signCount);
    const authData = Buffer.concat([rpIdHash, Buffer.from([flags]), signCountBuf]);
    const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
    const toSign = Buffer.concat([authData, clientDataHash]);
    const privateKey = crypto.createPrivateKey({ key: b64UrlToBuf(candidate.privateKey), format: 'der', type: 'pkcs8' });
    const signature = crypto.sign('sha256', toSign, privateKey);
    return {
      ok: true,
      id: candidate.id,
      clientDataJSON: bufToB64Url(clientDataJSON),
      authenticatorData: bufToB64Url(authData),
      signature: bufToB64Url(signature),
      userHandle: candidate.userHandle || null,
    };
  }
}

function toPublic(r: CredentialRecord): VirtualCredential {
  return { id: r.id, rpId: r.rpId, userHandle: r.userHandle, privateKey: r.privateKey, publicKey: r.publicKey };
}

function randomBase64Url(bytes: number): string {
  return bufToB64Url(crypto.randomBytes(bytes));
}

function bufToB64Url(b: Buffer): string {
  return b.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64UrlToBuf(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

function u32ToBytes(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

// Minimal CBOR encoder — only the subset we need for COSE keys and the attestation object.
function cborHead(major: number, value: number): Buffer {
  const m = major << 5;
  if (value < 24)
    return Buffer.from([m | value]);
  if (value < 0x100)
    return Buffer.from([m | 24, value]);
  if (value < 0x10000)
    return Buffer.from([m | 25, (value >> 8) & 0xff, value & 0xff]);
  return Buffer.from([m | 26, (value >>> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);
}

function cborUint(v: number): Buffer { return cborHead(0, v); }
function cborNint(v: number): Buffer { return cborHead(1, -1 - v); } // v must be negative
function cborBytes(b: Buffer): Buffer { return Buffer.concat([cborHead(2, b.length), b]); }
function cborText(s: string): Buffer {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([cborHead(3, b.length), b]);
}
function cborMap(entries: [Buffer, Buffer][]): Buffer {
  return Buffer.concat([cborHead(5, entries.length), ...entries.flatMap(([k, v]) => [k, v])]);
}

function encodeCoseEs256PublicKey(publicKey: crypto.KeyObject): Buffer {
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string, y: string };
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');
  return cborMap([
    [cborUint(1), cborUint(2)],     // kty = EC2
    [cborUint(3), cborNint(-7)],    // alg = ES256
    [cborNint(-1), cborUint(1)],    // crv = P-256
    [cborNint(-2), cborBytes(x)],
    [cborNint(-3), cborBytes(y)],
  ]);
}

function encodeAttestationObjectNone(authData: Buffer): Buffer {
  return cborMap([
    [cborText('fmt'), cborText('none')],
    [cborText('attStmt'), cborMap([])],
    [cborText('authData'), cborBytes(authData)],
  ]);
}
