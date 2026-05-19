import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext();
  await context.credentials.install();
  const page = await context.newPage();
  await page.goto('https://webauthn.io/');
  await page.locator('#input-email').fill(`pw-demo-${Date.now()}`);
  await page.locator('#register-button').click();
  await page.getByText(/success!.*try to authenticate/i).waitFor();

  const seeded = await context.credentials.get();
  console.log(`  ✓ registered: id=${seeded[0].id.substring(0, 12)}…  rpId=${seeded[0].rpId}`);

  await page.locator('#login-button').click();
  await page.getByText(/you're logged in/i).waitFor();
  console.log(`  ✓ authenticated`);
  await browser.close();
})();
