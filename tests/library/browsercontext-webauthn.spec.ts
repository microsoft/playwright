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

import type { Page } from 'playwright-core';

// Runs an assertion ceremony with a discoverable credential, returns the signature counter from the authenticator data.
async function assertAndGetSignCount(page: Page, rpId: string) {
  return await page.evaluate(async ({ rpId }) => {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.get({
      publicKey: { challenge, rpId, userVerification: 'preferred' },
    }) as PublicKeyCredential;
    const resp = cred.response as AuthenticatorAssertionResponse;
    return new DataView(resp.authenticatorData).getUint32(33);
  }, { rpId });
}

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

it('should reuse a page-created credential via the storageState option', async ({ contextFactory, server }) => {
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

  // Capture the passkey as part of the storage state.
  const storageState = await setupContext.storageState({ credentials: true });

  // A context created from the storage state has the authenticator installed and signs in with
  // the captured passkey — without calling install() again.
  const context = await contextFactory({ storageState });
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

it('should seed and report signCount', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const fresh = await context.credentials.create('fresh.example.com');
  expect(fresh.signCount).toBe(0);

  const seeded = await context.credentials.create(server.HOSTNAME, { signCount: 41 });
  expect(seeded.signCount).toBe(41);
  await context.credentials.install();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  // Each assertion increments the counter and reports the new value to the page.
  expect(await assertAndGetSignCount(page, server.HOSTNAME)).toBe(42);
  expect(await assertAndGetSignCount(page, server.HOSTNAME)).toBe(43);
  expect(await context.credentials.get({ id: seeded.id })).toEqual([{ ...seeded, signCount: 43 }]);
  expect(await context.credentials.get({ id: fresh.id })).toEqual([fresh]);

  // A captured credential continues from the same counter in another context.
  const [captured] = await context.credentials.get({ id: seeded.id });
  const context2 = await contextFactory();
  await context2.credentials.create(captured.rpId, captured);
  await context2.credentials.install();
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await assertAndGetSignCount(page2, server.HOSTNAME)).toBe(44);
});

it('should reject invalid signCount', async ({ contextFactory }) => {
  const context = await contextFactory();
  const error = await context.credentials.create('example.com', { signCount: -1 }).catch(e => e);
  expect(error.message).toContain('signCount must be between 0 and 4294967295, got -1');
  expect(await context.credentials.get()).toEqual([]);
});

it('should preserve signCount via the storageState option', async ({ contextFactory, server }) => {
  const setupContext = await contextFactory();
  await setupContext.credentials.create(server.HOSTNAME);
  await setupContext.credentials.install();
  const setupPage = await setupContext.newPage();
  await setupPage.goto(server.EMPTY_PAGE);
  expect(await assertAndGetSignCount(setupPage, server.HOSTNAME)).toBe(1);

  const storageState = await setupContext.storageState({ credentials: true });
  const [captured] = await setupContext.credentials.get();
  expect(captured.signCount).toBe(1);
  expect(storageState).toEqual({ cookies: [], origins: [], credentials: [captured] });

  const context = await contextFactory({ storageState });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  expect(await assertAndGetSignCount(page, server.HOSTNAME)).toBe(2);

  // Storage state saved by older versions has no signCount, the counter starts from zero.
  const legacyCredential: Partial<typeof captured> = { ...captured };
  delete legacyCredential.signCount;
  const legacyStorageState = { ...storageState, credentials: [legacyCredential] };
  const legacyContext = await contextFactory({ storageState: legacyStorageState });
  const legacyPage = await legacyContext.newPage();
  await legacyPage.goto(server.EMPTY_PAGE);
  expect(await assertAndGetSignCount(legacyPage, server.HOSTNAME)).toBe(1);
});
