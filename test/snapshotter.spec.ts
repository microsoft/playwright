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

import { folio as baseFolio } from './fixtures';
import { InMemorySnapshotter } from '../lib/server/snapshot/inMemorySnapshotter';

type TestFixtures = {
  snapshotter: any;
};

export const fixtures = baseFolio.extend<TestFixtures>();
fixtures.snapshotter.init(async ({ context, toImpl }, runTest) => {
  const snapshotter = new InMemorySnapshotter(toImpl(context));
  await snapshotter.initialize();
  await runTest(snapshotter);
  await snapshotter.dispose();
});

const { it, describe, expect } = fixtures.build();

describe('snapshots', (suite, { mode }) => {
  suite.skip(mode !== 'default');
}, () => {

  it('should collect snapshot', async ({ snapshotter, page, toImpl }) => {
    await page.setContent('<button>Hello</button>');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'snapshot');
    expect(distillSnapshot(snapshot)).toBe('<BUTTON>Hello</BUTTON>');
  });

  it('should capture resources', async ({ snapshotter, page, toImpl, server }) => {
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

  it('should collect multiple', async ({ snapshotter, page, toImpl }) => {
    await page.setContent('<button>Hello</button>');
    const snapshots = [];
    snapshotter.on('snapshot', snapshot => snapshots.push(snapshot));
    await snapshotter.captureSnapshot(toImpl(page), 'snapshot1');
    await snapshotter.captureSnapshot(toImpl(page), 'snapshot2');
    expect(snapshots.length).toBe(2);
  });

  it('should only collect on change', async ({ snapshotter, page }) => {
    await page.setContent('<button>Hello</button>');
    const snapshots = [];
    snapshotter.on('snapshot', snapshot => snapshots.push(snapshot));
    await Promise.all([
      new Promise(f => snapshotter.once('snapshot', f)),
      snapshotter.setAutoSnapshotInterval(25),
    ]);
    await Promise.all([
      new Promise(f => snapshotter.once('snapshot', f)),
      page.setContent('<button>Hello 2</button>')
    ]);
    expect(snapshots.length).toBe(2);
  });

  it('should respect inline CSSOM change', async ({ snapshotter, page }) => {
    await page.setContent('<style>button { color: red; }</style><button>Hello</button>');
    const snapshots = [];
    snapshotter.on('snapshot', snapshot => snapshots.push(snapshot));
    await Promise.all([
      new Promise(f => snapshotter.once('snapshot', f)),
      snapshotter.setAutoSnapshotInterval(25),
    ]);
    expect(distillSnapshot(snapshots[0])).toBe('<style>button { color: red; }</style><BUTTON>Hello</BUTTON>');

    await Promise.all([
      new Promise(f => snapshotter.once('snapshot', f)),
      page.evaluate(() => {
        (document.styleSheets[0].cssRules[0] as any).style.color = 'blue';
      })
    ]);
    expect(distillSnapshot(snapshots[1])).toBe('<style>button { color: blue; }</style><BUTTON>Hello</BUTTON>');
  });

  it('should respect subresource CSSOM change', async ({ snapshotter, page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/style.css', route => {
      route.fulfill({ body: 'button { color: red; }', }).catch(() => {});
    });
    await page.setContent('<link rel="stylesheet" href="style.css"><button>Hello</button>');

    const snapshots = [];
    snapshotter.on('snapshot', snapshot => snapshots.push(snapshot));
    await Promise.all([
      new Promise(f => snapshotter.once('snapshot', f)),
      snapshotter.setAutoSnapshotInterval(25),
    ]);
    expect(distillSnapshot(snapshots[0])).toBe('<LINK rel=\"stylesheet\" href=\"style.css\"><BUTTON>Hello</BUTTON>');

    await Promise.all([
      new Promise(f => snapshotter.once('snapshot', f)),
      page.evaluate(() => {
        (document.styleSheets[0].cssRules[0] as any).style.color = 'blue';
      })
    ]);
    const { resources } = snapshots[1].render();
    const cssHref = `http://localhost:${server.PORT}/style.css`;
    const { sha1 } = resources[cssHref];
    expect(snapshotter.resourceContent(sha1).toString()).toBe('button { color: blue; }');
  });
});

function distillSnapshot(snapshot) {
  const { html } = snapshot.render();
  return html
      .replace(/<script>function snapshotScript[.\s\S]*/, '')
      .replace(/<BASE href="about:blank">/, '')
      .replace(/<BASE href="http:\/\/localhost:[\d]+\/empty.html">/, '')
      .replace(/<HTML>/, '')
      .replace(/<\/HTML>/, '')
      .replace(/<HEAD>/, '')
      .replace(/<\/HEAD>/, '')
      .replace(/<BODY>/, '')
      .replace(/<\/BODY>/, '');
}
