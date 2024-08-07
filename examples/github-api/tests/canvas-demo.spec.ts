import { test } from '@playwright/test';

test("Google Maps", async ({ page }) => {
    await page.goto("https://google.com/maps/place/Teufelsberg");

    await page.getByRole('button', { name: 'Alle akzeptieren' }).click();

    const searchBox = page.locator('.searchboxinput').first();

    await searchBox.fill('Schlachtensee');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await searchBox.fill('Griebnitzsee');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await searchBox.fill('Wannsee');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
})

test('Go JS', async ({ page }) => {
  await page.goto('https://gojs.net/latest/samples/orgChartEditor.html');
  await page.locator('canvas').click({
    position: {
      x: 396,
      y: 153
    }
  });
  await page.getByRole('cell', { name: 'Luke Warm' }).getByRole('textbox').fill('Ice Cold');
  await page.getByRole('cell', { name: 'Ice Cold' }).getByRole('textbox').press('Enter');
  await page.locator('canvas').click({
    position: {
      x: 481,
      y: 319
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 1022,
      y: 289
    }
  });
  await page.getByRole('cell', { name: 'Saul Wellingood' }).getByRole('textbox').fill('Paul Wellingood');
  await page.getByRole('cell', { name: 'Paul Wellingood' }).getByRole('textbox').press('Enter');
  await page.locator('canvas').click({
    position: {
      x: 481,
      y: 319
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 1022,
      y: 289
    }
  });
});

test('ThreeJS', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = function(id, options) { return original.call(this, id, {...options, preserveDrawingBuffer: true }) }
  });
  await page.goto('https://threejs.org/examples/webgl_animation_skinning_morph.html');
  await page.waitForTimeout(1000);
  await page.getByLabel('Surprised').fill('1');
  await page.waitForTimeout(1000);
});