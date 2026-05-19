// Demonstrates `context.credentials.create()` — seeding a pre-existing
// credential into a fresh context.
//
// In a real test suite the keypair would live in a fixture file (saved once
// after registering a stable test user). Here we synthesise it by registering
// in context A, then importing into context B to authenticate without any
// further UI interaction.

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const username = `pw-demo-${Date.now()}`;

  // Context A: register so webauthn.io stores the credential server-side.
  const contextA = await browser.newContext();
  await contextA.credentials.install();
  const pageA = await contextA.newPage();
  await pageA.goto('https://webauthn.io/');
  await pageA.locator('#input-email').fill(username);
  await pageA.locator('#register-button').click();
  await pageA.getByText(/success!.*try to authenticate/i).waitFor();
  const [registered] = await contextA.credentials.get();
  await contextA.close();
  console.log(`  ✓ registered ${username}: id=${registered.id.substring(0, 12)}…`);

  // Context B: seed the same credential. webauthn.io's home page issues a
  // discoverable `navigator.credentials.get()` on load — the seeded credential
  // satisfies it and the site logs us in with no clicks needed.
  const contextB = await browser.newContext();
  await contextB.credentials.install();
  await contextB.credentials.create(registered);
  const pageB = await contextB.newPage();
  await pageB.goto('https://webauthn.io/');
  await pageB.getByText(/you're logged in/i).waitFor();
  console.log(`  ✓ authenticated with seeded credential (no UI)`);

  await browser.close();
})();
