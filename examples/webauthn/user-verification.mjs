// Demonstrates `context.credentials.setUserVerified()` — simulating a user
// refusing biometric verification (e.g. a wrong fingerprint).
//
// We configure webauthn.io to require user verification, then flip the
// authenticator's UV flag off and try to log in. The relying party sees
// UV=0 in the assertion flags and rejects the login. Flipping UV back on
// makes the next attempt succeed.

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext();
  await context.credentials.install();
  const page = await context.newPage();
  await page.goto('https://webauthn.io/');

  // Force the relying party to require user verification at both ends.
  await page.locator('button:has-text("Advanced Settings")').click();
  await page.locator('#optRegUserVerification').selectOption('required');
  await page.locator('#optAuthUserVerification').selectOption('required');

  await page.locator('#input-email').fill(`pw-demo-${Date.now()}`);
  await page.locator('#register-button').click();
  await page.getByText(/success!.*try to authenticate/i).waitFor();
  console.log(`  ✓ registered (UV=required)`);

  // Simulate failed biometric — UV bit will be 0 in the next assertion.
  await context.credentials.setUserVerified(false);
  await page.locator('#login-button').click();
  await page.getByText(/authentication failed/i).waitFor();
  console.log(`  ✓ login rejected: server got UV=0 but required UV=1`);

  // Recovery: biometric succeeds, UV=1 in the assertion.
  await context.credentials.setUserVerified(true);
  await page.locator('#login-button').click();
  await page.getByText(/you're logged in/i).waitFor();
  console.log(`  ✓ login succeeded after UV restored`);

  await browser.close();
})();
