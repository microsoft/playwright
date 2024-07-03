const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('about:blank');
  await page.close();
  const page = await context.newPage();
  await page.goto('https://www.google.com/search?gs_ssp=eJzj4tTP1TcwMU02T1JgNGB0YPBiS8_PT89JBQBASQXT&q=google&oq=g&gs_lcrp=EgZjaHJvbWUqEwgBEC4YgwEYxwEYsQMY0QMYgAQyBggAEEUYPDITCAEQLhiDARjHARixAxjRAxiABDIGCAIQRRg5MgYIAxBFGDwyBggEEEUYPDIGCAUQRRg8MgYIBhBFGDwyBggHEEUYPNIBCDIxMzNqMGoyqAIAsAIA&sourceid=chrome&ie=UTF-8');
  await page.getByRole('link', { name: 'Fast.com: Internet Speed Test' }).click();
  await page.getByRole('link', { name: 'Voir plus d\'infos' }).click();
  await page.getByRole('link', { name: ' Paramètres' }).click();
  await page.locator('#min-connections-input').click();
  await page.locator('#max-connections-input').click();
  await page.locator('#min-duration-input').click();
  await page.locator('#max-duration-input').click();
  await page.getByText('Mesurer la latence de chargement pendant l\'envoi Toujours afficher les données').click();
  await page.getByLabel('Mesurer la latence de').check();
  await page.getByLabel('Enreg. la config. pour cet').check();
  await page.getByRole('link', { name: 'Enregistrer' }).click();

  // ---------------------
  await context.close();
  await browser.close();
})();
