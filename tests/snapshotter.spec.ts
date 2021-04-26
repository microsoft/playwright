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

import { test as it, expect } from './config/contextTest';
import { InMemorySnapshotter } from '../lib/server/snapshot/inMemorySnapshotter';
import { HttpServer } from '../lib/utils/httpServer';
import { SnapshotServer } from '../lib/server/snapshot/snapshotServer';

it.describe('snapshots', () => {
  let snapshotter: any;
  let httpServer: any;
  let snapshotPort: number;

  it.beforeEach(async ({ mode, toImpl, context }, testInfo) => {
    it.skip(mode !== 'default');

    snapshotter = new InMemorySnapshotter(toImpl(context));
    await snapshotter.initialize();
    httpServer = new HttpServer();
    new SnapshotServer(httpServer, snapshotter);
    snapshotPort = 11000 + testInfo.workerIndex;
    httpServer.start(snapshotPort);
  });

  it.afterEach(async () => {
    await snapshotter.dispose();
    httpServer.stop();
  });

  it('should collect snapshot', async ({ page, toImpl }) => {
    await page.setContent('<button>Hello</button>');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot');
    expect(distillSnapshot(snapshot)).toBe('<BUTTON>Hello</BUTTON>');
  });

  it('should capture resources', async ({ page, toImpl, server }) => {
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

  it('should collect multiple', async ({ page, toImpl }) => {
    await page.setContent('<button>Hello</button>');
    const snapshots = [];
    snapshotter.on('snapshot', snapshot => snapshots.push(snapshot));
    await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
    expect(snapshots.length).toBe(2);
  });

  it('should respect inline CSSOM change', async ({ page, toImpl }) => {
    await page.setContent('<style>button { color: red; }</style><button>Hello</button>');
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    expect(distillSnapshot(snapshot1)).toBe('<style>button { color: red; }</style><BUTTON>Hello</BUTTON>');

    await page.evaluate(() => { (document.styleSheets[0].cssRules[0] as any).style.color = 'blue'; });
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
    expect(distillSnapshot(snapshot2)).toBe('<style>button { color: blue; }</style><BUTTON>Hello</BUTTON>');
  });

  it('should respect subresource CSSOM change', async ({ page, server, toImpl }) => {
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

  it('should capture iframe', async ({ page, contextFactory, server, toImpl, browserName }) => {
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
    while (previewPage.frames().length < 4)
      await new Promise(f => previewPage.once('frameattached', f));
    const button = await previewPage.frames()[3].waitForSelector('button');
    expect(await button.textContent()).toBe('Hello iframe');
  });

  it('should capture snapshot target', async ({ page, toImpl }) => {
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

  it('should collect on attribute change', async ({ page, toImpl }) => {
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
