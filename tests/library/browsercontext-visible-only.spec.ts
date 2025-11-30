import { browserTest as it, expect } from '../config/browserTest';

it('should match both visible and hidden elements by default', async ({ page }) => {
  await page.setContent(`
    <div class="item" id="visible">Visible</div>
    <div class="item" id="hidden" style="display: none">Hidden</div>
  `);
  await expect(page.locator('.item')).toHaveCount(2);
});

it.describe('visibleOnly context mode', () => {
  it.use({
    contextOptions: async ({ contextOptions }, use) => {
      const options = { ...contextOptions, visibleOnly: true };
      await use(options);
    }
  });

  it('should only match visible elements with locator()', async ({ page }) => {
    await page.setContent(`
      <div class="item" id="visible">Visible</div>
      <div class="item" id="hidden" style="display: none">Hidden</div>
    `);
    await expect(page.locator('.item')).toHaveCount(1);
    expect(await page.locator('.item').getAttribute('id')).toBe('visible');
  });

  it('should work with getByRole', async ({ page }) => {
    await page.setContent(`
      <button id="visible-btn">Visible Button</button>
      <button id="hidden-btn" style="display: none">Hidden Button</button>
    `);
    await expect(page.getByRole('button')).toHaveCount(1);
    expect(await page.getByRole('button').getAttribute('id')).toBe('visible-btn');
  });

  it('should work with getByText', async ({ page }) => {
    await page.setContent(`
      <span id="visible-text">Hello World</span>
      <span id="hidden-text" style="display: none">Hello World</span>
    `);
    await expect(page.getByText('Hello World')).toHaveCount(1);
    expect(await page.getByText('Hello World').getAttribute('id')).toBe('visible-text');
  });

  it('should work with getByTestId', async ({ page }) => {
    await page.setContent(`
      <div data-testid="my-element" id="visible-el">Visible</div>
      <div data-testid="my-element" id="hidden-el" style="display: none">Hidden</div>
    `);
    await expect(page.getByTestId('my-element')).toHaveCount(1);
    expect(await page.getByTestId('my-element').getAttribute('id')).toBe('visible-el');
  });

  it('should allow explicit visible=false to override visibleOnly', async ({ page }) => {
    await page.setContent(`
      <div class="item" id="visible-item">Visible</div>
      <div class="item" id="hidden-item" style="display: none">Hidden</div>
    `);
    // Explicit visible=false should find hidden elements
    await expect(page.locator('.item >> visible=false')).toHaveCount(1);
    expect(await page.locator('.item >> visible=false').getAttribute('id')).toBe('hidden-item');
  });

  it('should not double-apply visible filter when explicitly set', async ({ page }) => {
    await page.setContent(`
      <div class="item" id="visible-item">Visible</div>
      <div class="item" id="hidden-item" style="display: none">Hidden</div>
    `);
    // Explicit visible=true should still work (not double-filtered)
    await expect(page.locator('.item >> visible=true')).toHaveCount(1);
    expect(await page.locator('.item >> visible=true').getAttribute('id')).toBe('visible-item');
  });

  it('should work with visibility:hidden', async ({ page }) => {
    await page.setContent(`
      <div class="item" id="visible">Visible</div>
      <div class="item" id="hidden" style="visibility: hidden">Hidden</div>
    `);
    await expect(page.locator('.item')).toHaveCount(1);
    expect(await page.locator('.item').getAttribute('id')).toBe('visible');
  });

  it('should handle React-style hidden routes (inert attribute)', async ({ page }) => {
    await page.setContent(`
      <div id="active-route">
        <button id="active-btn">Active Page Button</button>
      </div>
      <div id="hidden-route" inert hidden>
        <button id="hidden-btn">Hidden Page Button</button>
      </div>
    `);
    await expect(page.getByRole('button')).toHaveCount(1);
    expect(await page.getByRole('button').getAttribute('id')).toBe('active-btn');
  });

  it('should work with locator.click', async ({ page }) => {
    await page.setContent(`
      <button id="visible-btn" onclick="window.clicked='visible'">Visible Button</button>
      <button id="hidden-btn" style="display: none" onclick="window.clicked='hidden'">Hidden Button</button>
    `);
    await page.locator('button').click();
    expect(await page.evaluate(() => (window as any).clicked)).toBe('visible');
  });

  it('should work with locator.fill', async ({ page }) => {
    await page.setContent(`
      <input id="visible-input" />
      <input id="hidden-input" style="display: none" />
    `);
    await page.locator('input').fill('test value');
    expect(await page.locator('#visible-input').inputValue()).toBe('test value');
  });

  it('should work with locator.filter', async ({ page }) => {
    await page.setContent(`
      <div class="card" id="visible-card">
        <span class="title">Card 1</span>
      </div>
      <div class="card" id="hidden-card" style="display: none">
        <span class="title">Card 2</span>
      </div>
    `);
    await expect(page.locator('.card').filter({ hasText: 'Card' })).toHaveCount(1);
    expect(await page.locator('.card').filter({ hasText: 'Card' }).getAttribute('id')).toBe('visible-card');
  });

  it('low-level $$ is also affected by visibleOnly', async ({ page }) => {
    await page.setContent(`
      <div class="item" id="visible">Visible</div>
      <div class="item" id="hidden" style="display: none">Hidden</div>
    `);
    const elements = await page.$$('.item');
    expect(elements.length).toBe(1);
  });

  it('low-level $$eval is also affected by visibleOnly', async ({ page }) => {
    await page.setContent(`
      <div class="item" id="visible">Visible</div>
      <div class="item" id="hidden" style="display: none">Hidden</div>
    `);
    const ids = await page.$$eval('.item', els => els.map(e => e.id));
    expect(ids).toEqual(['visible']);
  });

  it('can use visible=false to access hidden elements with low-level APIs', async ({ page }) => {
    await page.setContent(`
      <div class="item" id="visible">Visible</div>
      <div class="item" id="hidden" style="display: none">Hidden</div>
    `);
    const hiddenElements = await page.$$('.item >> visible=false');
    expect(hiddenElements.length).toBe(1);
    const hiddenIds = await page.$$eval('.item >> visible=false', els => els.map(e => e.id));
    expect(hiddenIds).toEqual(['hidden']);
  });
});
