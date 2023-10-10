import { contextTest as it, expect } from '../config/browserTest';

it.describe('disable JS', () => {
  it.use({ javaScriptEnabled: false });
  it('noscript (disabled)', async ({ server, page }) => {
    await page.goto(server.PREFIX + '/noscript.html');

    await expect(page.locator('#id1'),
      "Elements within 'noscript' should be accessible").toHaveCount(1);;
    await expect(page.locator('#id1'),
      "Text within 'noscript' tag should be shown").toHaveText("JS Disabled (1)");
    await expect(page.getByText('JS Disabled (1)'),
      "Noscript Text should be found").toBeVisible();
    await expect(page.locator('#id2')).toHaveText("JS Disabled (2)");
  });
});

it('noscript (enabled)', async ({ server, page }) => {
  await page.goto(server.PREFIX + '/noscript.html');

  await expect(page.locator('#id1')).toHaveCount(0);;
  await expect(page.locator('#id2')).toBeHidden();
});
