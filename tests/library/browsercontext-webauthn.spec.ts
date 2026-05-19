/**
 * Copyright (c) Microsoft Corporation.
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

import { browserTest as it, expect } from '../config/browserTest';

it.skip(({ mode }) => mode.startsWith('service'));

// WebAuthn requires a secure context (HTTPS or localhost). The test server's default
// `same_origin = 'localhost'` satisfies this for HTTP.

it('should seed a credential @smoke', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const cred = await context.credentials.create({ rpId: server.HOSTNAME });
  expect(cred.id).toBeTruthy();
  expect(cred.rpId).toBe(server.HOSTNAME);
  expect(cred.userHandle).toBeTruthy();
  // base64url has no padding and no +/ chars
  expect(cred.privateKey).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(cred.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);

  const all = await context.credentials.get();
  expect(all).toHaveLength(1);
  expect(all[0].id).toBe(cred.id);

  await context.credentials.delete(cred.id);
  expect(await context.credentials.get()).toHaveLength(0);
});

it('should not intercept navigator.credentials without install()', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  // Seed a credential, but do not install the interceptor.
  await context.credentials.create({ rpId: server.HOSTNAME });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const intercepted = await page.evaluate(() => (globalThis as any).__pwWebAuthnInstalled === true);
  expect(intercepted).toBe(false);
});

it('should authenticate with a seeded credential', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  await context.credentials.install();
  const seeded = await context.credentials.create({ rpId: server.HOSTNAME });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const result = await page.evaluate(async ({ rpId, credentialId }) => {
    const b64UrlToBytes = (s: string) => {
      let str = s.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4)
        str += '=';
      const bin = atob(str);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++)
        u8[i] = bin.charCodeAt(i);
      return u8;
    };
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId,
        allowCredentials: [{ type: 'public-key', id: b64UrlToBytes(credentialId) }],
        userVerification: 'preferred',
      },
    }) as PublicKeyCredential;
    const resp = cred.response as AuthenticatorAssertionResponse;
    return {
      id: cred.id,
      type: cred.type,
      hasClientData: resp.clientDataJSON.byteLength > 0,
      hasAuthData: resp.authenticatorData.byteLength > 0,
      hasSignature: resp.signature.byteLength > 0,
      authDataFlags: new Uint8Array(resp.authenticatorData)[32],
    };
  }, { rpId: server.HOSTNAME, credentialId: seeded.id });

  expect(result.id).toBe(seeded.id);
  expect(result.type).toBe('public-key');
  expect(result.hasClientData).toBe(true);
  expect(result.hasAuthData).toBe(true);
  expect(result.hasSignature).toBe(true);
  // UP (0x01) | UV (0x04) = 0x05
  expect(result.authDataFlags & 0x05).toBe(0x05);
});

it('should round-trip create then get in the page', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  await context.credentials.install();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const result = await page.evaluate(async ({ rpId }) => {
    const challenge1 = crypto.getRandomValues(new Uint8Array(32));
    const created = await navigator.credentials.create({
      publicKey: {
        challenge: challenge1,
        rp: { id: rpId, name: 'Test RP' },
        user: { id: new Uint8Array([1, 2, 3, 4]), name: 'u', displayName: 'User' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      },
    }) as PublicKeyCredential;
    const challenge2 = crypto.getRandomValues(new Uint8Array(32));
    const got = await navigator.credentials.get({
      publicKey: { challenge: challenge2, rpId, userVerification: 'preferred' },
    }) as PublicKeyCredential;
    return { createdId: created.id, gotId: got.id };
  }, { rpId: server.HOSTNAME });

  expect(result.createdId).toBe(result.gotId);
  const stored = await context.credentials.get();
  expect(stored.map(c => c.id)).toContain(result.createdId);
});

it('should toggle user-verified flag', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  await context.credentials.install();
  const seeded = await context.credentials.create({ rpId: server.HOSTNAME });
  await context.credentials.setUserVerified(false);
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const flagsByte = await page.evaluate(async ({ rpId, credentialId }) => {
    const b64UrlToBytes = (s: string) => {
      let str = s.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4)
        str += '=';
      const bin = atob(str);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++)
        u8[i] = bin.charCodeAt(i);
      return u8;
    };
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32),
        rpId,
        allowCredentials: [{ type: 'public-key', id: b64UrlToBytes(credentialId) }],
      },
    }) as PublicKeyCredential;
    const resp = cred.response as AuthenticatorAssertionResponse;
    return new Uint8Array(resp.authenticatorData)[32];
  }, { rpId: server.HOSTNAME, credentialId: seeded.id });

  // UV bit (0x04) should be unset; UP bit (0x01) still set.
  expect(flagsByte & 0x04).toBe(0);
  expect(flagsByte & 0x01).toBe(0x01);
});

it('should reject when no credential matches', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  await context.credentials.install();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const error = await page.evaluate(async ({ rpId }) => {
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          rpId,
          allowCredentials: [{ type: 'public-key', id: new Uint8Array([9, 9, 9, 9]) }],
        },
      });
      return 'no-error';
    } catch (e) {
      return (e as DOMException).name;
    }
  }, { rpId: server.HOSTNAME });

  expect(error).toBe('NotAllowedError');
});
