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

it('should not intercept navigator.credentials without install()', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  // Seed a credential, but do not install the interceptor.
  await context.credentials.create(server.HOSTNAME);
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const intercepted = await page.evaluate(() => (globalThis as any).__pwWebAuthnInstalled === true);
  expect(intercepted).toBe(false);
});

it('should seed a known credential and authenticate', async ({ contextFactory, server }) => {
  // This is the easiest way to create credentials. In practice, this
  // probably comes from environment.
  const source = await contextFactory();
  const known = await source.credentials.create(server.HOSTNAME);

  // A fresh context imports the known credential and signs in with it.
  const context = await contextFactory();
  await context.credentials.create(known.rpId, known);
  await context.credentials.install();
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
  }, { rpId: server.HOSTNAME, credentialId: known.id });

  expect(result.id).toBe(known.id);
  expect(result.type).toBe('public-key');
  expect(result.hasClientData).toBe(true);
  expect(result.hasAuthData).toBe(true);
  expect(result.hasSignature).toBe(true);
  // UP (0x01) | UV (0x04) = 0x05
  expect(result.authDataFlags & 0x05).toBe(0x05);

  // After the credential is deleted, the page can no longer authenticate with it.
  await context.credentials.delete(known.id);
  expect(await context.credentials.get()).toHaveLength(0);

  const error = await page.evaluate(async ({ rpId, credentialId }) => {
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
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId,
          allowCredentials: [{ type: 'public-key', id: b64UrlToBytes(credentialId) }],
        },
      });
      return 'no-error';
    } catch (e) {
      return (e as DOMException).name;
    }
  }, { rpId: server.HOSTNAME, credentialId: known.id });
  expect(error).toBe('NotAllowedError');
});

it('should capture a page-created credential and reuse it in another context', async ({ contextFactory, server }) => {
  // Setup context: the app registers a passkey via navigator.credentials.create().
  const setupContext = await contextFactory();
  await setupContext.credentials.install();
  const setupPage = await setupContext.newPage();
  await setupPage.goto(server.EMPTY_PAGE);

  const createdId = await setupPage.evaluate(async ({ rpId }) => {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const created = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { id: rpId, name: 'Test RP' },
        user: { id: new Uint8Array([1, 2, 3, 4]), name: 'u', displayName: 'User' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      },
    }) as PublicKeyCredential;
    return created.id;
  }, { rpId: server.HOSTNAME });

  const [captured] = await setupContext.credentials.get({ rpId: server.HOSTNAME });
  expect(captured.id).toBe(createdId);
  expect(captured.privateKey).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(captured.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);

  // Reuse the captured passkey in a fresh context and sign in with it.
  const context = await contextFactory();
  await context.credentials.create(captured.rpId, captured);
  await context.credentials.install();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const gotId = await page.evaluate(async ({ rpId }) => {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    // No allowCredentials — relies on the re-seeded credential being discoverable.
    const cred = await navigator.credentials.get({
      publicKey: { challenge, rpId, userVerification: 'preferred' },
    }) as PublicKeyCredential;
    return cred.id;
  }, { rpId: server.HOSTNAME });

  expect(gotId).toBe(createdId);
});
