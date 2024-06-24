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

import { contextTest as it, expect } from '../config/browserTest';
import type { ElementHandle } from 'playwright-core';

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

it('should not click iframe overlaying the target', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <button style="position: absolute; left: 250px;bottom: 0;height: 40px;width: 200px;" onclick="window._clicked=1">
      click-me
    </button>
    <div style="background: transparent; bottom: 0px; left: 0px; margin: 0px; padding: 0px; position: fixed; z-index: 2147483647;">
      <iframe srcdoc="<body onclick='window.top._clicked=2' style='background-color:red;height:40px;'></body>" style="display: block; border: 0px; width: 100vw; height: 48px;"></iframe>
    </div>
  `);
  const error = await page.click('text=click-me', { timeout: 1000 }).catch(e => e);
  expect(await page.evaluate('window._clicked')).toBe(undefined);
  expect(error.message).toContain(`<iframe srcdoc=\"<body onclick='window.top._clicked=2' style='background-color:red;height:40px;'></body>\"></iframe> from <div>…</div> subtree intercepts pointer events`);
});

it('should not click an element overlaying iframe with the target', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <div onclick='window.top._clicked=1'>padding</div>
    <iframe width=600 height=600 srcdoc="<iframe srcdoc='<div onclick=&quot;window.top._clicked=2&quot;>padding</div><div onclick=&quot;window.top._clicked=3&quot;>inner</div>'></iframe><div onclick='window.top._clicked=4'>outer</div>"></iframe>
    <div onclick='window.top._clicked=5' style="position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: rgba(255, 0, 0, 0.1); padding: 200px;">PINK OVERLAY</div>
  `);

  const target = page.frameLocator('iframe').frameLocator('iframe').locator('text=inner');
  const error = await target.click({ timeout: 3000 }).catch(e => e);
  expect(await page.evaluate('window._clicked')).toBe(undefined);
  expect(error.message).toContain(`<div onclick="window.top._clicked=5">PINK OVERLAY</div> intercepts pointer events`);

  await page.locator('text=overlay').evaluate(e => e.style.display = 'none');

  await target.click();
  expect(await page.evaluate('window._clicked')).toBe(3);
});

it('should click into frame inside closed shadow root', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <div id=framecontainer>
    </div>
    <script>
      const iframe = document.createElement('iframe');
      iframe.setAttribute('name', 'myframe');
      iframe.setAttribute('srcdoc', '<div onclick="window.top.__clicked = true">click me</div>');
      const div = document.getElementById('framecontainer');
      const host = div.attachShadow({ mode: 'closed' });
      host.appendChild(iframe);
    </script>
  `);

  const frame = page.frame({ name: 'myframe' });
  await frame.locator('text=click me').click();
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should click an element inside closed shadow root', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <div id=container>
    </div>
    <script>
      const span = document.createElement('span');
      span.textContent = 'click me';
      span.addEventListener('click', () => window.__clicked = true);
      const div = document.getElementById('container');
      const host = div.attachShadow({ mode: 'closed' });
      host.appendChild(span);
      window.__target = span;
    </script>
  `);

  const handle = await page.evaluateHandle('window.__target');
  await (handle as any as ElementHandle).click();
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should detect overlay from another shadow root', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <style>
      div > div {
        position: absolute;
        top: 0;
        left: 0;
        width: 10px;
        height: 10px;
      }
      span {
        display: block;
        position: absolute;
        left: 0;
        top: 0;
        width: 300px;
        height: 300px;
      }
    </style>
    <div style="position:relative; width:300px; height:300px">
      <div id=container1></div>
      <div id=container2></div>
    </div>
    <script>
      for (const id of ['container1', 'container2']) {
        const span = document.createElement('span');
        span.id = id + '-span';
        span.textContent = 'click me';
        span.style.display = 'block';
        span.style.position = 'absolute';
        span.style.left = '20px';
        span.style.top = '20px';
        span.style.width = '300px';
        span.style.height = '300px';
        span.addEventListener('click', () => window.__clicked = id);
        const div = document.getElementById(id);
        const host = div.attachShadow({ mode: 'open' });
        host.appendChild(span);
      }
    </script>
  `);

  const error = await page.locator('#container1 >> text=click me').click({ timeout: 2000 }).catch(e => e);
  expect(error.message).toContain(`<div id="container2"></div> intercepts pointer events`);
});

it('should detect overlaid element in a transformed iframe', async ({ page }) => {
  await page.setContent(`
    <style>
      body, html, iframe { margin: 0; padding: 0; border: none; }
      iframe {
        border: 4px solid black;
        background: gray;
        margin-left: 33px;
        margin-top: 24px;
        width: 400px;
        height: 400px;
        transform: scale(1.2);
      }
    </style>
    <iframe srcdoc="
      <style>
        body, html { margin: 0; padding: 0; }
        div { margin-left: 10px; margin-top: 20px; width: 2px; height: 2px; }
        section { position: absolute; top: 0; left: 0; bottom: 0; right: 0; }
      </style>
      <div>Target</div>
      <section>Overlay</section>
      <script>
        document.querySelector('div').addEventListener('click', () => window.top._clicked = true);
      </script>
    "></iframe>
  `);
  const locator = page.frameLocator('iframe').locator('div');
  const error = await locator.click({ timeout: 2000 }).catch(e => e);
  expect(error.message).toContain('<section>Overlay</section> intercepts pointer events');
});

it('should click in iframe with padding', async ({ page }) => {
  await page.setContent(`
    <style>
      body, html, iframe { margin: 0; padding: 0; border: none; box-sizing: border-box; }
      iframe { background: gray; width: 200px; height: 200px; padding-top: 100px; }
    </style>
    <iframe srcdoc="
      <style>
        body, html { margin: 0; padding: 0; }
        div { height: 100px; }
      </style>
      <div>Non-target</div>
      <div id=target>Target</div>
      <div>Non-target</div>
      <script>
        document.querySelector('#target').addEventListener('click', () => window.top._clicked = true);
      </script>
    "></iframe>
  `);
  const locator = page.frameLocator('iframe').locator('#target');
  await locator.click();
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should click in iframe with padding 2', async ({ page }) => {
  await page.setContent(`
    <style>
      body, html, iframe { margin: 0; padding: 0; border: none; box-sizing: content-box; }
      iframe { background: gray; width: 200px; height: 200px; padding-top: 100px; }
    </style>
    <iframe srcdoc="
      <style>
        body, html { margin: 0; padding: 0; }
        div { height: 100px; }
      </style>
      <div>Non-target</div>
      <div id=target>Target</div>
      <div>Non-target</div>
      <script>
        document.querySelector('#target').addEventListener('click', () => window.top._clicked = true);
      </script>
    "></iframe>
  `);
  const locator = page.frameLocator('iframe').locator('#target');
  await locator.click();
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should click in custom element', async ({ page }) => {
  await page.setContent(`
    <html>
      <body>
        <my-input></my-input>
        <script>
          class MyInput extends HTMLElement {
            connectedCallback() {
              this.attachShadow({mode:'open'});
              this.shadowRoot.innerHTML = '<div><span><input type="text" /></span></div>';
              this.shadowRoot.querySelector('input').addEventListener('click', () => window.__clicked = true);
            }
          }
          customElements.define('my-input', MyInput);
        </script>
      </body>
    </html>
  `);
  await page.locator('input').click();
  expect(await page.evaluate('window.__clicked')).toBe(true);
});
