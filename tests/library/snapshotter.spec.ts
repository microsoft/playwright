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

import { contextTest, expect } from '../config/browserTest';
import { InMemorySnapshotter } from '../../packages/playwright-core/lib/server/trace/test/inMemorySnapshotter';

const it = contextTest.extend<{ snapshotter: InMemorySnapshotter }>({
  snapshotter: async ({ toImpl, context }, run) => {
    const snapshotter = new InMemorySnapshotter(toImpl(context));
    await snapshotter.initialize();
    await run(snapshotter);
    await snapshotter.dispose();
  },
});

it.describe('snapshots', () => {
  it('should collect snapshot', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<button>Hello</button>');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot)).toBe('<BUTTON>Hello</BUTTON>');
  });

  it('should preserve BASE and other content on reset', async ({ page, toImpl, snapshotter, server }) => {
    await page.goto(server.EMPTY_PAGE);
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    const html1 = snapshot1.render().html;
    expect(html1).toContain(`<BASE href="${server.EMPTY_PAGE}"`);
    await snapshotter.reset();
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
    const html2 = snapshot2.render().html;
    expect(html2.replace(/call@2/g, `call@1`)).toEqual(html1);
  });

  it('should capture resources', async ({ page, toImpl, server, snapshotter }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/style.css', route => {
      route.fulfill({ body: 'button { color: red; }', }).catch(() => {});
    });
    await page.setContent('<link rel="stylesheet" href="style.css"><button>Hello</button>');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    const resource = snapshot.resourceByUrl(`http://localhost:${server.PORT}/style.css`, 'GET');
    expect(resource).toBeTruthy();
  });

  it('should collect multiple', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<button>Hello</button>');
    await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
    expect(snapshotter.snapshotCount()).toBe(2);
  });

  it('should respect inline CSSOM change', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<style>button { color: red; }</style><button>Hello</button>');
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot1)).toBe('<STYLE>button { color: red; }</STYLE><BUTTON>Hello</BUTTON>');

    await page.evaluate(() => { (document.styleSheets[0].cssRules[0] as any).style.color = 'blue'; });
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
    expect(distillSnapshot(snapshot2)).toBe('<STYLE>button { color: blue; }</STYLE><BUTTON>Hello</BUTTON>');
  });

  it('should respect CSSOM change through CSSGroupingRule', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<style>@media { button { color: red; } }</style><button>Hello</button>');
    await page.evaluate(() => {
      window['rule'] = document.styleSheets[0].cssRules[0];
      void 0;
    });
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot1)).toBe('<STYLE>@media  {\n  button { color: red; }\n}</STYLE><BUTTON>Hello</BUTTON>');

    await page.evaluate(() => { window['rule'].cssRules[0].style.color = 'blue'; });
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
    expect(distillSnapshot(snapshot2)).toBe('<STYLE>@media  {\n  button { color: blue; }\n}</STYLE><BUTTON>Hello</BUTTON>');

    await page.evaluate(() => { window['rule'].insertRule('button { color: green; }', 1); });
    const snapshot3 = await snapshotter.captureSnapshot(toImpl(page), 'call@3', 'snapshot@call@3');
    expect(distillSnapshot(snapshot3)).toBe('<STYLE>@media  {\n  button { color: blue; }\n  button { color: green; }\n}</STYLE><BUTTON>Hello</BUTTON>');
  });

  it('should respect node removal', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<div><button id="button1"></button><button id="button2"></button></div>');
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot1)).toBe('<DIV><BUTTON id=\"button1\"></BUTTON><BUTTON id=\"button2\"></BUTTON></DIV>');
    await page.evaluate(() => document.getElementById('button2').remove());
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
    expect(distillSnapshot(snapshot2)).toBe('<DIV><BUTTON id=\"button1\"></BUTTON></DIV>');
  });

  it('should respect attr removal', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<div id="div" attr1="1" attr2="2"></div>');
    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot1)).toBe('<DIV id=\"div\" attr1=\"1\" attr2=\"2\"></DIV>');
    await page.evaluate(() => document.getElementById('div').removeAttribute('attr2'));
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
    expect(distillSnapshot(snapshot2)).toBe('<DIV id=\"div\" attr1=\"1\"></DIV>');
  });

  it('should have a custom doctype', async ({ page, server, toImpl, snapshotter }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<!DOCTYPE foo><body>hi</body>');

    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot)).toBe('<!DOCTYPE foo>hi');
  });

  it('should replace meta charset attr that specifies charset', async ({ page, server, toImpl, snapshotter }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<meta charset="shift-jis" />');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot)).toBe('<META charset="utf-8">');
  });

  it('should replace meta content attr that specifies charset', async ({ page, server, toImpl, snapshotter }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot)).toBe('<META http-equiv="Content-Type" content="text/html; charset=utf-8">');
  });

  it('should respect subresource CSSOM change', async ({ page, server, toImpl, snapshotter }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/style.css', route => {
      route.fulfill({ body: 'button { color: red; }', }).catch(() => {});
    });
    await page.setContent('<link rel="stylesheet" href="style.css"><button>Hello</button>');

    const snapshot1 = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot1)).toBe('<LINK rel=\"stylesheet\" href=\"style.css\"><BUTTON>Hello</BUTTON>');

    await page.evaluate(() => { (document.styleSheets[0].cssRules[0] as any).style.color = 'blue'; });
    const snapshot2 = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
    const resource = snapshot2.resourceByUrl(`http://localhost:${server.PORT}/style.css`, 'GET');
    expect((await snapshotter.resourceContentForTest(resource.response.content._sha1)).toString()).toBe('button { color: blue; }');
  });

  it('should capture frame', async ({ page, server, toImpl, snapshotter }) => {
    await page.route('**/empty.html', route => {
      route.fulfill({
        body: '<frameset><frame src="frame.html"></frameset>',
        contentType: 'text/html'
      }).catch(() => {});
    });
    await page.route('**/frame.html', route => {
      route.fulfill({
        body: '<html><button>Hello iframe</button></html>',
        contentType: 'text/html'
      }).catch(() => {});
    });
    await page.goto(server.EMPTY_PAGE);

    for (let counter = 0; ; ++counter) {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@' + counter, 'snapshot@call@' + counter);
      const text = distillSnapshot(snapshot).replace(/frame@[^"]+["]/, '<id>"');
      if (text === '<FRAMESET><FRAME __playwright_src__=\"/snapshot/<id>\"></FRAME></FRAMESET>')
        break;
      await page.waitForTimeout(250);
    }
  });

  it('should capture iframe', async ({ page, server, toImpl, snapshotter }) => {
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
    for (let counter = 0; ; ++counter) {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@' + counter, 'snapshot@call@' + counter);
      const text = distillSnapshot(snapshot).replace(/frame@[^"]+["]/, '<id>"');
      if (text === '<IFRAME __playwright_src__=\"/snapshot/<id>\"></IFRAME>')
        break;
      await page.waitForTimeout(250);
    }
  });


  it('should capture iframe with srcdoc', async ({ page, server, toImpl, snapshotter }) => {
    await page.route('**/empty.html', route => {
      route.fulfill({
        body: '<iframe srcdoc="&lt;html>&lt;button>Hello iframe&lt;/button>&lt;/html>"></iframe>',
        contentType: 'text/html'
      }).catch(() => {});
    });
    await page.goto(server.EMPTY_PAGE);

    // Marking iframe hierarchy is racy, do not expect snapshot, wait for it.
    for (let counter = 0; ; ++counter) {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@' + counter, 'snapshot@call@' + counter);
      const text = distillSnapshot(snapshot).replace(/frame@[^"]+["]/, '<id>"');
      if (text === '<IFRAME __playwright_src__=\"/snapshot/<id>\"></IFRAME>')
        break;
      await page.waitForTimeout(250);
    }
  });

  it('should capture snapshot target', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<button>Hello</button><button>World</button>');
    {
      const handle = await page.$('text=Hello');
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1', toImpl(handle));
      expect(distillSnapshot(snapshot, false /* distillTarget */)).toBe('<BUTTON __playwright_target__=\"call@1\">Hello</BUTTON><BUTTON>World</BUTTON>');
    }
    {
      const handle = await page.$('text=World');
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2', toImpl(handle));
      expect(distillSnapshot(snapshot, false /* distillTarget */)).toBe('<BUTTON __playwright_target__=\"call@1\">Hello</BUTTON><BUTTON __playwright_target__=\"call@2\">World</BUTTON>');
    }
  });

  it('should collect on attribute change', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<button>Hello</button>');
    {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
      expect(distillSnapshot(snapshot)).toBe('<BUTTON>Hello</BUTTON>');
    }
    const handle = await page.$('text=Hello')!;
    await handle.evaluate(element => element.setAttribute('data', 'one'));
    {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
      expect(distillSnapshot(snapshot)).toBe('<BUTTON data="one">Hello</BUTTON>');
    }
    await handle.evaluate(element => element.setAttribute('data', 'two'));
    {
      const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@3', 'snapshot@call@3');
      expect(distillSnapshot(snapshot)).toBe('<BUTTON data="two">Hello</BUTTON>');
    }
  });

  it('empty adopted style sheets should not prevent node refs', async ({ page, toImpl, snapshotter, browserName }) => {
    await page.setContent('<button>Hello</button>');
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [sheet];

      const sheet2 = new CSSStyleSheet();
      for (const element of [document.createElement('div'), document.createElement('span')]) {
        const root = element.attachShadow({
          mode: 'open'
        });
        root.append('foo');
        root.adoptedStyleSheets = [sheet2];
        document.body.appendChild(element);
      }
    });

    const renderer1 = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    // Expect some adopted style sheets.
    expect(distillSnapshot(renderer1)).toContain('__playwright_style_sheet_');

    const renderer2 = await snapshotter.captureSnapshot(toImpl(page), 'call@2', 'snapshot@call@2');
    const snapshot2 = renderer2.snapshot();
    // Second snapshot should be just a copy of the first one.
    expect(snapshot2.html).toEqual([[1, 13]]);
  });

  it('should not navigate on anchor clicks', async ({ page, toImpl, snapshotter }) => {
    await page.setContent('<a href="https://example.com">example.com</a>');
    const snapshot = await snapshotter.captureSnapshot(toImpl(page), 'call@1', 'snapshot@call@1');
    expect(distillSnapshot(snapshot)).toBe('<A href="link://https://example.com">example.com</A>');
  });
});

function distillSnapshot(snapshot, distillTarget = true) {
  let { html } = snapshot.render();
  if (distillTarget)
    html = html.replace(/\s__playwright_target__="[^"]+"/g, '');
  return html
      .replace(/<style>\*,\*::before,\*::after { visibility: hidden }<\/style>/, '')
      .replace(/<script>[.\s\S]+<\/script>/, '')
      .replace(/<style>.*__playwright_target__.*?<\/style>/, '')
      .replace(/<BASE href="about:blank">/, '')
      .replace(/<BASE href="http:\/\/localhost:[\d]+\/empty.html">/, '')
      .replace(/<HTML>/, '')
      .replace(/<\/HTML>/, '')
      .replace(/<HEAD>/, '')
      .replace(/<\/HEAD>/, '')
      .replace(/<BODY>/, '')
      .replace(/<\/BODY>/, '').trim();
}
