/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { contextTest as it, expect } from './config/browserTest';

declare const renderComponent;
declare const e;
declare const MaterialUI;

it('should block all events when hit target is wrong', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => {
    const blocker = document.createElement('div');
    blocker.style.position = 'absolute';
    blocker.style.width = '400px';
    blocker.style.height = '400px';
    blocker.style.left = '0';
    blocker.style.top = '0';
    document.body.appendChild(blocker);

    const allEvents = [];
    (window as any).allEvents = allEvents;
    for (const name of ['mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'pointerdown', 'pointerup']) {
      window.addEventListener(name, e => allEvents.push(e.type));
      blocker.addEventListener(name, e => allEvents.push(e.type));
    }
  });

  const error = await page.click('button', { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('page.click: Timeout 1000ms exceeded.');

  // Give it some time, just in case.
  await page.waitForTimeout(1000);
  const allEvents = await page.evaluate(() => (window as any).allEvents);
  expect(allEvents).toEqual([]);
});

it('should block click when mousedown fails', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => {
    button.addEventListener('mousemove', () => {
      button.style.marginLeft = '100px';
    });

    const allEvents = [];
    (window as any).allEvents = allEvents;
    for (const name of ['mousemove', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'pointerdown', 'pointerup'])
      button.addEventListener(name, e => allEvents.push(e.type));
  });

  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
  const allEvents = await page.evaluate(() => (window as any).allEvents);
  expect(allEvents).toEqual([
    // First attempt failed.
    'mousemove',
    // Second attempt succeeded.
    'mousemove', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click',
  ]);
});

it('should click when element detaches in mousedown', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => {
    button.addEventListener('mousedown', () => {
      (window as any).result = 'Mousedown';
      button.remove();
    });
  });

  await page.click('button', { timeout: 1000 });
  expect(await page.evaluate('result')).toBe('Mousedown');
});

it('should block all events when hit target is wrong and element detaches', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => {
    const blocker = document.createElement('div');
    blocker.style.position = 'absolute';
    blocker.style.width = '400px';
    blocker.style.height = '400px';
    blocker.style.left = '0';
    blocker.style.top = '0';
    document.body.appendChild(blocker);

    window.addEventListener('mousemove', () => button.remove());

    const allEvents = [];
    (window as any).allEvents = allEvents;
    for (const name of ['mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'pointerdown', 'pointerup']) {
      window.addEventListener(name, e => allEvents.push(e.type));
      blocker.addEventListener(name, e => allEvents.push(e.type));
    }
  });

  const error = await page.click('button', { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('page.click: Timeout 1000ms exceeded.');

  // Give it some time, just in case.
  await page.waitForTimeout(1000);
  const allEvents = await page.evaluate(() => (window as any).allEvents);
  expect(allEvents).toEqual([]);
});

it('should not block programmatic events', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => {
    button.addEventListener('mousemove', () => {
      button.style.marginLeft = '100px';
      button.dispatchEvent(new MouseEvent('click'));
    });

    const allEvents = [];
    (window as any).allEvents = allEvents;
    button.addEventListener('click', e => {
      if (!e.isTrusted)
        allEvents.push(e.type);
    });
  });

  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
  const allEvents = await page.evaluate(() => (window as any).allEvents);
  // We should get one programmatic click on each attempt.
  expect(allEvents).toEqual([
    'click', 'click',
  ]);
});

it('should click the button again after document.write', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');

  await page.evaluate(() => {
    document.open();
    document.write('<button onclick="window.result2 = true"></button>');
    document.close();
  });
  await page.click('button');
  expect(await page.evaluate('result2')).toBe(true);
});

it('should work with mui select', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/mui.html');
  await page.evaluate(() => {
    renderComponent(e(MaterialUI.FormControl, { fullWidth: true }, [
      e(MaterialUI.InputLabel, { id: 'demo-simple-select-label' }, ['Age']),
      e(MaterialUI.Select, {
        labelId: 'demo-simple-select-label',
        id: 'demo-simple-select',
        value: 10,
        label: 'Age',
      }, [
        e(MaterialUI.MenuItem, { value: 10 }, ['Ten']),
        e(MaterialUI.MenuItem, { value: 20 }, ['Twenty']),
        e(MaterialUI.MenuItem, { value: 30 }, ['Thirty']),
      ]),
    ]));
  });
  await page.click('div.MuiFormControl-root:has-text("Age")');
  await expect(page.locator('text=Thirty')).toBeVisible();
});

it('should work with drag and drop that moves the element under cursor', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/drag-n-drop-manual.html');
  await page.dragAndDrop('#from', '#to');
  await expect(page.locator('#to')).toHaveText('Dropped');
});

it('should work with block inside inline', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <div>
      <span>
        <div id="target" onclick="window._clicked=true">
          Romimine
        </div>
      </span>
    </div>
  `);
  await page.locator('#target').click();
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should work with block-block-block inside inline-inline', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <div>
      <a href="#ney">
        <div>
          <span>
            <a href="#yay">
              <div>
                <h3 id="target">
                  Romimine
                </h3>
              </div>
            </a>
          </span>
        </div>
      </a>
    </div>
  `);
  await page.locator('#target').click();
  await expect(page).toHaveURL(server.EMPTY_PAGE + '#yay');
});

it('should work with block inside inline in shadow dom', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <div>
    </div>
    <script>
      const root = document.querySelector('div');
      const shadowRoot = root.attachShadow({ mode: 'open' });
      const span = document.createElement('span');
      shadowRoot.appendChild(span);
      const div = document.createElement('div');
      span.appendChild(div);
      div.id = 'target';
      div.addEventListener('click', () => window._clicked = true);
      div.textContent = 'Hello';
    </script>
  `);
  await page.locator('#target').click();
  expect(await page.evaluate('window._clicked')).toBe(true);
});
