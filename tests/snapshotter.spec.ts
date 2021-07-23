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

import { contextTest, expect } from './config/browserTest';
import { InMemorySnapshotter } from '../lib/server/snapshot/inMemorySnapshotter';
import { HttpServer } from '../lib/utils/httpServer';
import { SnapshotServer } from '../lib/server/snapshot/snapshotServer';

const it = contextTest.extend<{ snapshotPort: number, snapshotter: InMemorySnapshotter }>({
  snapshotPort: async ({}, run, testInfo) => {
    await run(11000 + testInfo.workerIndex);
  },

  snapshotter: async ({ mode, toImpl, context, snapshotPort }, run, testInfo) => {
    testInfo.skip(mode !== 'default');
    const snapshotter = new InMemorySnapshotter(toImpl(context));
    await snapshotter.initialize();
    const httpServer = new HttpServer();
    new SnapshotServer(httpServer, snapshotter);
    await httpServer.start(snapshotPort);
    await run(snapshotter);
    await snapshotter.dispose();
    await httpServer.stop();
  },
});

it.describe('snapshots', () => {
  it('should collect snapshot', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<button>Hello</button>');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot');
    expect(distillSnapshot(snapshot)).toBe('<BUTTON>Hello</BUTTON>');
  });

  it('should capture resources', async ({ page, toImpl, server, snapshotter }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/style.css', route => {
      route.fulfill({ body: 'button { color: red; }', }).catch(() => {});
    });
    await page.setContent('<link rel="stylesheet" href="style.css"><button>Hello</button>');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot');
    const { resources } = snapshot.render();
    const cssHref = `http://localhost:${server.PORT}/style.css`;
    expect(resources[cssHref]).toBeTruthy();
  });

  it('should collect multiple', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<button>Hello</button>');
    const snapshots = [];
    snapshotter.on('snapshot', snapshot => snapshots.push(snapshot));
    await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
    expect(snapshots.length).toBe(2);
  });

  it('should respect inline CSSOM change', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<style>button { color: red; }</style><button>Hello</button>');
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    expect(distillSnapshot(snapshot1)).toBe('<style>button { color: red; }</style><BUTTON>Hello</BUTTON>');

    await page.evaluate(() => { (document.styleSheets[0].cssRules[0] as any).style.color = 'blue'; });
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
    expect(distillSnapshot(snapshot2)).toBe('<style>button { color: blue; }</style><BUTTON>Hello</BUTTON>');
  });

  it('should respect node removal', async ({ page, toImpl, snapshotter }) => {
    page.on('console', console.log);
    await page.setContent('<div><button id="button1"></button><button id="button2"></button></div>');
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    expect(distillSnapshot(snapshot1)).toBe('<DIV><BUTTON id=\"button1\"></BUTTON><BUTTON id=\"button2\"></BUTTON></DIV>');
    await page.evaluate(() => document.getElementById('button2').remove());
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
    expect(distillSnapshot(snapshot2)).toBe('<DIV><BUTTON id=\"button1\"></BUTTON></DIV>');
  });

  it('should respect attr removal', async ({ page, toImpl, snapshotter }) => {
    page.on('console', console.log);
    await page.setContent('<div id="div" attr1="1" attr2="2"></div>');
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    expect(distillSnapshot(snapshot1)).toBe('<DIV id=\"div\" attr1=\"1\" attr2=\"2\"></DIV>');
    await page.evaluate(() => document.getElementById('div').removeAttribute('attr2'));
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
    expect(distillSnapshot(snapshot2)).toBe('<DIV id=\"div\" attr1=\"1\"></DIV>');
  });

  it('should have a custom doctype', async ({page, server, toImpl, snapshotter}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<!DOCTYPE foo><body>hi</body>');

    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot');
    expect(distillSnapshot(snapshot)).toBe('<!DOCTYPE foo>hi');
  });

  it('should respect subresource CSSOM change', async ({ page, server, toImpl, snapshotter }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/style.css', route => {
      route.fulfill({ body: 'button { color: red; }', }).catch(() => {});
    });
    await page.setContent('<link rel="stylesheet" href="style.css"><button>Hello</button>');

    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    expect(distillSnapshot(snapshot1)).toBe('<LINK rel=\"stylesheet\" href=\"style.css\"><BUTTON>Hello</BUTTON>');

    await page.evaluate(() => { (document.styleSheets[0].cssRules[0] as any).style.color = 'blue'; });
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    const { resources } = snapshot2.render();
    const cssHref = `http://localhost:${server.PORT}/style.css`;
    const { sha1 } = resources[cssHref];
    expect(snapshotter.resourceContent(sha1).toString()).toBe('button { color: blue; }');
  });

  it('should capture iframe', async ({ page, contextFactory, server, toImpl, browserName, snapshotter, snapshotPort }) => {
    it.skip(browserName === 'firefox');

    await page.route('**/empty.html', route => {
      route.fulfill({
        body: '<iframe src="iframe.html"></iframe>',
        contentType: 'text/html'
      }).catch(() => {});
    });
    await page.route('**/iframe.html', route => {
      route.fulfill({
        body: '<html><button>Hello iframe</button></html>',
        contentType: 'text/html'
      }).catch(() => {});
    });
    await page.goto(server.EMPTY_PAGE);

    // Marking iframe hierarchy is racy, do not expect snapshot, wait for it.
    let counter = 0;
    let snapshot: any;
    for (; ; ++counter) {
      snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot' + counter);
      const text = distillSnapshot(snapshot).replace(/frame@[^"]+["]/, '<id>"');
      if (text === '<IFRAME src=\"/snapshot/<id>\"></IFRAME>')
        break;
      await page.waitForTimeout(250);
    }

    // Render snapshot, check expectations.
    const previewContext = await contextFactory();
    const previewPage = await previewContext.newPage();
    await previewPage.goto(`http://localhost:${snapshotPort}/snapshot/`);
    await previewPage.evaluate(snapshotId => {
      (window as any).showSnapshot(snapshotId);
    }, `${snapshot.snapshot().pageId}?name=snapshot${counter}`);
    while (previewPage.frames().length < 3)
      await new Promise(f => previewPage.once('frameattached', f));
    const button = await previewPage.frames()[2].waitForSelector('button');
    expect(await button.textContent()).toBe('Hello iframe');
  });

  it('should capture snapshot target', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<button>Hello</button><button>World</button>');
    {
      const handle = await page.$('text=Hello');
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot', toImpl(handle));
      expect(distillSnapshot(snapshot)).toBe('<BUTTON __playwright_target__=\"snapshot\">Hello</BUTTON><BUTTON>World</BUTTON>');
    }
    {
      const handle = await page.$('text=World');
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot2', toImpl(handle));
      expect(distillSnapshot(snapshot)).toBe('<BUTTON __playwright_target__=\"snapshot\">Hello</BUTTON><BUTTON __playwright_target__=\"snapshot2\">World</BUTTON>');
    }
  });

  it('should collect on attribute change', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<button>Hello</button>');
    {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot');
      expect(distillSnapshot(snapshot)).toBe('<BUTTON>Hello</BUTTON>');
    }
    const handle = await page.$('text=Hello')!;
    await handle.evaluate(element => element.setAttribute('data', 'one'));
    {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
      expect(distillSnapshot(snapshot)).toBe('<BUTTON data="one">Hello</BUTTON>');
    }
    await handle.evaluate(element => element.setAttribute('data', 'two'));
    {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
      expect(distillSnapshot(snapshot)).toBe('<BUTTON data="two">Hello</BUTTON>');
    }
  });

  it('should contain adopted style sheets', async ({ page, toImpl, contextFactory, snapshotPort, snapshotter, browserName }) => {
    it.skip(browserName !== 'chromium', 'Constructed stylesheets are only in Chromium.');
    await page.setContent('<button>Hello</button>');
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.addRule('button', 'color: red');
      (document as any).adoptedStyleSheets = [sheet];

      const div = document.createElement('div');
      const root = div.attachShadow({
        mode: 'open'
      });
      root.append('foo');
      const sheet2 = new CSSStyleSheet();
      sheet2.addRule(':host', 'color: blue');
      (root as any).adoptedStyleSheets = [sheet2];
      document.body.appendChild(div);
    });
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');

    const previewContext = await contextFactory();
    const previewPage = await previewContext.newPage();
    previewPage.on('console', console.log);
    await previewPage.goto(`http://localhost:${snapshotPort}/snapshot/`);
    await previewPage.evaluate(snapshotId => {
      (window as any).showSnapshot(snapshotId);
    }, `${snapshot1.snapshot().pageId}?name=snapshot1`);
    // wait for the render frame to load
    while (previewPage.frames().length < 2)
      await new Promise(f => previewPage.once('frameattached', f));
    // wait for it to render
    await previewPage.frames()[1].waitForSelector('button');
    const buttonColor = await previewPage.frames()[1].$eval('button', button => {
      return window.getComputedStyle(button).color;
    });
    expect(buttonColor).toBe('rgb(255, 0, 0)');
    const divColor = await previewPage.frames()[1].$eval('div', div => {
      return window.getComputedStyle(div).color;
    });
    expect(divColor).toBe('rgb(0, 0, 255)');
    await previewContext.close();
  });

  it('should restore scroll positions', async ({ page, contextFactory, toImpl, snapshotter, snapshotPort, browserName }) => {
    it.skip(browserName === 'firefox');

    await page.setContent(`
      <style>
        li { height: 20px; margin: 0; padding: 0; }
        div { height: 60px; overflow-x: hidden; overflow-y: scroll; background: green; padding: 0; margin: 0; }
      </style>
      <div>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
          <li>Item 4</li>
          <li>Item 5</li>
          <li>Item 6</li>
          <li>Item 7</li>
          <li>Item 8</li>
          <li>Item 9</li>
          <li>Item 10</li>
        </ul>
      </div>
    `);

    await (await page.$('text=Item 8')).scrollIntoViewIfNeeded();
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'scrolled');

    // Render snapshot, check expectations.
    const previewContext = await contextFactory();
    const previewPage = await previewContext.newPage();
    await previewPage.goto(`http://localhost:${snapshotPort}/snapshot/`);
    await previewPage.evaluate(snapshotId => {
      (window as any).showSnapshot(snapshotId);
    }, `${snapshot.snapshot().pageId}?name=scrolled`);
    const div = await previewPage.frames()[1].waitForSelector('div');
    await previewPage.frames()[1].waitForLoadState();
    expect(await div.evaluate(div => div.scrollTop)).toBe(136);
  });
});

function distillSnapshot(snapshot) {
  const { html } = snapshot.render();
  return html
      .replace(/<script>[.\s\S]+<\/script>/, '')
      .replace(/<style>.*__playwright_target__.*<\/style>/, '')
      .replace(/<BASE href="about:blank">/, '')
      .replace(/<BASE href="http:\/\/localhost:[\d]+\/empty.html">/, '')
      .replace(/<HTML>/, '')
      .replace(/<\/HTML>/, '')
      .replace(/<HEAD>/, '')
      .replace(/<\/HEAD>/, '')
      .replace(/<BODY>/, '')
      .replace(/<\/BODY>/, '').trim();
}
