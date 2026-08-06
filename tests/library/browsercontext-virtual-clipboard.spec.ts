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

import type { Page } from 'playwright-core';

// Use innerHTML rather than page.setContent(), whose document.open() would wipe the virtual clipboard's native-event listeners.
async function setBody(page: Page, html: string) {
  await page.evaluate(content => { document.body.innerHTML = content; }, html);
}

it('should virtualize navigator.clipboard without permissions', async ({ context, server }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE); // localhost is a secure context, so navigator.clipboard exists to be virtualized
  await page.evaluate(() => navigator.clipboard.writeText('from page'));
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('from page');
  expect(await context.clipboard.readText()).toBe('from page');
});

it('should expose context.clipboard writes to a page', async ({ context, server }) => {
  await context.clipboard.writeText('context value');
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('context value');
});

it('should virtualize document.execCommand copy, and paste where the browser supports it', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await page.setContent(`<div id="src">execCommand text</div><textarea id="dst"></textarea>`);
  await page.locator('#src').selectText();
  expect(await page.evaluate(() => document.execCommand('copy'))).toBe(true);
  await page.locator('#dst').focus();
  const pasteSupported = await page.evaluate(() => document.queryCommandSupported('paste'));
  expect(await page.evaluate(() => document.execCommand('paste'))).toBe(pasteSupported);
  await expect(page.locator('#dst')).toHaveValue(pasteSupported ? 'execCommand text' : '');
});

it('should virtualize document.execCommand copy from a form control', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await page.setContent(`<input id="src" value="input field text">`);
  await page.locator('#src').selectText();
  expect(await page.evaluate(() => document.execCommand('copy'))).toBe(true);
  expect(await context.clipboard.readText()).toBe('input field text');
});

it('should support rich text via ClipboardItem', async ({ context, server }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const roundtrip = await page.evaluate(async () => {
    await navigator.clipboard.write([new ClipboardItem({
      'text/plain': new Blob(['plain'], { type: 'text/plain' }),
      'text/html': new Blob(['<b>rich</b>'], { type: 'text/html' }),
    })]);
    const items = await navigator.clipboard.read();
    const out: Record<string, string> = {};
    for (const item of items) {
      for (const type of item.types)
        out[type] = await (await item.getType(type)).text();
    }
    return out;
  });
  expect(roundtrip).toEqual({ 'text/plain': 'plain', 'text/html': '<b>rich</b>' });
});

it('should round-trip binary content for image types the browser supports', async ({ context, server }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']) {
    const result = await page.evaluate(async type => {
      const supported = ClipboardItem.supports(type);
      const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 128, 64, 32]);
      try {
        await navigator.clipboard.write([new ClipboardItem({ [type]: new Blob([bytes], { type }) })]);
      } catch (e) {
        return { supported, error: (e as Error).name };
      }
      const [item] = await navigator.clipboard.read();
      const out = new Uint8Array(await (await item.getType(type)).arrayBuffer());
      return { supported, outType: item.types[0], roundTrip: out.join(',') === bytes.join(',') };
    }, type);
    if (result.supported) {
      expect(result.roundTrip, `${type} should round-trip byte-accurately`).toBe(true);
      expect(result.outType).toBe(type);
    } else {
      expect(result.error, `${type} should reject like the real browser`).toBe('NotAllowedError');
    }
  }
});

it('should share the clipboard across pages', async ({ context, server }) => {
  await context.clipboard.install();
  const page1 = await context.newPage();
  await page1.goto(server.EMPTY_PAGE);
  await page1.evaluate(() => navigator.clipboard.writeText('cross page'));
  const page2 = await context.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(() => navigator.clipboard.readText())).toBe('cross page');
});

it('should paste context.clipboard content via native Ctrl+V', async ({ context }) => {
  await context.clipboard.writeText('native pasted');
  const page = await context.newPage();
  await setBody(page, `<input id="dst">`);
  await page.locator('#dst').focus();
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('#dst')).toHaveValue('native pasted');
});

it('should paste into a non-text input without throwing', async ({ context }) => {
  await context.clipboard.writeText('someone@example.com');
  const page = await context.newPage();
  await setBody(page, `<input id="dst" type="email">`);
  await page.locator('#dst').focus();
  await page.evaluate(() => {
    (window as any).__inputEvents = 0;
    document.addEventListener('input', () => (window as any).__inputEvents++);
  });
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('#dst')).toHaveValue('someone@example.com');
  expect(await page.evaluate(() => (window as any).__inputEvents)).toBeGreaterThan(0);
});

it('should capture native Ctrl+C into context.clipboard', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await setBody(page, `<div id="src">copied natively</div>`);
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+c');
  await expect.poll(() => context.clipboard.readText()).toBe('copied natively');
});

it('should round-trip rich content via native Ctrl+C/V in contenteditable', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await setBody(page, `<div id="src" contenteditable><b>bold</b> and <i>italic</i></div><div id="dst" contenteditable></div>`);
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+c');
  await page.locator('#dst').focus();
  await page.keyboard.press('ControlOrMeta+v');
  expect(await page.locator('#dst').innerHTML()).toContain('<b>bold</b>');
  expect(await page.locator('#dst').innerHTML()).toContain('<i>italic</i>');
});

it('should native-paste in one page what another page set', async ({ context }) => {
  const page1 = await context.newPage();
  await setBody(page1, `<div>page 1</div>`);
  await context.clipboard.writeText('from another page');
  const page2 = await context.newPage();
  await setBody(page2, `<textarea id="dst"></textarea>`);
  await page2.locator('#dst').focus();
  await page2.keyboard.press('ControlOrMeta+v');
  await expect(page2.locator('#dst')).toHaveValue('from another page');
});

it('should install into an already-open page', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await context.clipboard.writeText('late install');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('late install');
});

it('should capture native Ctrl+X (cut)', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await setBody(page, `<div id="src" contenteditable>cut me</div>`);
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+x');
  await expect.poll(() => context.clipboard.readText()).toBe('cut me');
  await expect(page.locator('#src')).toHaveText('');
});

it('should delete a form control selection on native Ctrl+X (cut)', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await setBody(page, `<textarea id="src">cut this field</textarea>`);
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+x');
  await expect.poll(() => context.clipboard.readText()).toBe('cut this field');
  await expect(page.locator('#src')).toHaveValue('');
});

it('should read and write binary content via the context.clipboard API', async ({ context, server }) => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 250, 255]);
  await context.clipboard.write([{ mimeType: 'image/png', buffer: png }]);
  expect(await context.clipboard.read()).toEqual([{ mimeType: 'image/png', buffer: png }]);
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const fromPage = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const buffer = await (await item.getType(item.types[0])).arrayBuffer();
    return { type: item.types[0], bytes: [...new Uint8Array(buffer)] };
  });
  expect(fromPage).toEqual({ type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 250, 255] });
});

it('should not fail when concurrent operations trigger the first install', async ({ context }) => {
  const [, text] = await Promise.all([
    context.clipboard.writeText('concurrent'),
    context.clipboard.readText(),
  ]);
  expect(typeof text).toBe('string');
  expect(await context.clipboard.readText()).toBe('concurrent');
});

it('should install the virtual clipboard via install()', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await setBody(page, `<div id="src">explicit install</div>`);
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+c');
  await expect.poll(() => context.clipboard.readText()).toBe('explicit install');
});

it('should not install the virtual clipboard when only reading', async ({ context }) => {
  // Reading must not install the shim, so a native copy on a page that loaded without it is not captured.
  expect(await context.clipboard.readText()).toBe('');
  expect(await context.clipboard.read()).toEqual([]);
  const page = await context.newPage();
  await setBody(page, `<div id="src">only reading</div>`);
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+c');
  expect(await context.clipboard.readText()).toBe('');
});

it('should let a page copy handler override the copied content', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await setBody(page, `<div id="src">original selection</div>`);
  await page.locator('#src').selectText();
  await page.evaluate(() => document.addEventListener('copy', e => {
    e.clipboardData.setData('text/plain', 'overridden by handler');
    e.preventDefault();
  }));
  await page.keyboard.press('ControlOrMeta+c');
  await expect.poll(() => context.clipboard.readText()).toBe('overridden by handler');
});

it('should let a page cut handler override the content and suppress the delete', async ({ context }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await setBody(page, `<div id="src" contenteditable>cut original</div>`);
  await page.locator('#src').selectText();
  await page.evaluate(() => document.addEventListener('cut', e => {
    e.clipboardData.setData('text/plain', 'cut override');
    e.preventDefault();
  }));
  await page.keyboard.press('ControlOrMeta+x');
  await expect.poll(() => context.clipboard.readText()).toBe('cut override');
  await expect(page.locator('#src')).toHaveText('cut original');
});

it('should expose clipboardData to a page paste handler', async ({ context, browserName }) => {
  await context.clipboard.writeText('handler reads this');
  const page = await context.newPage();
  await setBody(page, `<input id="dst">`);
  await page.locator('#dst').focus();
  await page.evaluate(() => {
    (window as any).__pasted = null;
    document.addEventListener('paste', e => (window as any).__pasted = e.clipboardData.getData('text/plain'));
  });
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('#dst')).toHaveValue('handler reads this');
  // Firefox does not expose clipboardData on a synthesized paste event, but other browsers do.
  expect(await page.evaluate(() => (window as any).__pasted)).toBe(browserName === 'firefox' ? '' : 'handler reads this');
});

it('should read one ClipboardItem containing all types', async ({ context, server }) => {
  await context.clipboard.write([
    { mimeType: 'text/plain', buffer: Buffer.from('plain') },
    { mimeType: 'text/html', buffer: Buffer.from('<b>rich</b>') },
  ]);
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const result = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return { count: items.length, types: items[0].types };
  });
  expect(result.count).toBe(1);
  expect(result.types).toContain('text/plain');
  expect(result.types).toContain('text/html');
});

it('should expose pasted binary content via clipboardData files', async ({ context, browserName }) => {
  it.skip(browserName === 'firefox', 'Firefox does not expose clipboardData on a synthesized paste event');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 5, 6, 7, 8]);
  await context.clipboard.write([{ mimeType: 'image/png', buffer: png }]);
  const page = await context.newPage();
  await setBody(page, `<input id="dst">`);
  await page.locator('#dst').focus();
  await page.evaluate(() => {
    (window as any).__file = null;
    document.addEventListener('paste', async e => {
      const file = e.clipboardData.files[0];
      (window as any).__file = { type: file.type, bytes: [...new Uint8Array(await file.arrayBuffer())] };
    });
  });
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => page.evaluate(() => (window as any).__file)).toEqual({ type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 5, 6, 7, 8] });
});

it('should virtualize navigator.clipboard before the first inline page script', async ({ context, server }) => {
  server.setRoute('/clipboard-early.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!DOCTYPE html><script>window.__early = navigator.clipboard.readText().then(text => text, error => 'ERROR:' + error.name);</script>`);
  });
  await context.clipboard.writeText('early value');
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/clipboard-early.html');
  expect(await page.evaluate(() => (window as any).__early)).toBe('early value');
});

it('should not delete or copy on a native cut over non-editable content', async ({ context }) => {
  await context.clipboard.writeText('sentinel');
  const page = await context.newPage();
  await setBody(page, `<div id="src">static text</div>`);
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+x');
  await expect.poll(() => context.clipboard.readText()).toBe('sentinel');
  await expect(page.locator('#src')).toHaveText('static text');
});

it('should not mutate non-editable content on a native paste', async ({ context }) => {
  await context.clipboard.writeText('CLIP');
  const page = await context.newPage();
  await setBody(page, `<div id="src">static text</div>`);
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => context.clipboard.readText()).toBe('CLIP');
  await expect(page.locator('#src')).toHaveText('static text');
});

it('should not paste into a readonly input', async ({ context }) => {
  await context.clipboard.writeText('CLIP');
  const page = await context.newPage();
  await setBody(page, `<input id="dst" readonly value="ro-seed">`);
  await page.locator('#dst').focus();
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => context.clipboard.readText()).toBe('CLIP');
  await expect(page.locator('#dst')).toHaveValue('ro-seed');
});

it('should truncate a paste to the input maxlength', async ({ context }) => {
  await context.clipboard.writeText('CLIP2');
  const page = await context.newPage();
  await setBody(page, `<input id="dst" maxlength="4">`);
  await page.locator('#dst').focus();
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('#dst')).toHaveValue('CLIP');
});

it('should not copy from a password field', async ({ context }) => {
  await context.clipboard.writeText('sentinel');
  const page = await context.newPage();
  await setBody(page, `<input id="pw" type="password" value="hunter2">`);
  const returned = await page.evaluate(() => {
    const input = document.getElementById('pw') as HTMLInputElement;
    input.focus();
    input.select();
    return document.execCommand('copy');
  });
  expect(returned).toBe(true);
  await expect.poll(() => context.clipboard.readText()).toBe('sentinel');
});

it('should not delete or copy on a native cut from a password field', async ({ context }) => {
  await context.clipboard.writeText('sentinel');
  const page = await context.newPage();
  await setBody(page, `<input id="pw" type="password" value="hunter2">`);
  await page.evaluate(() => {
    const input = document.getElementById('pw') as HTMLInputElement;
    input.focus();
    input.select();
  });
  await page.keyboard.press('ControlOrMeta+x');
  await expect.poll(() => context.clipboard.readText()).toBe('sentinel');
  await expect(page.locator('#pw')).toHaveValue('hunter2');
});

it('should not copy when the page cancels the copy shortcut', async ({ context }) => {
  await context.clipboard.writeText('sentinel');
  const page = await context.newPage();
  await setBody(page, `<div id="src">static text</div>`);
  await page.locator('#src').selectText();
  await page.evaluate(() => document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c')
      e.preventDefault();
  }));
  await page.keyboard.press('ControlOrMeta+c');
  await expect.poll(() => context.clipboard.readText()).toBe('sentinel');
});

it('should paste into a value-tracked (React-style) input', async ({ context }) => {
  await context.clipboard.writeText('pasted');
  const page = await context.newPage();
  await setBody(page, `<input id="dst">`);
  await page.evaluate(() => {
    const node = document.getElementById('dst') as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
    let tracked = node.value;
    Object.defineProperty(node, 'value', {
      configurable: true,
      get() { return descriptor.get!.call(this); },
      set(value) { tracked = '' + value; descriptor.set!.call(this, value); },
    });
    (window as any).__changeDetected = false;
    node.addEventListener('input', () => {
      if (node.value !== tracked)
        (window as any).__changeDetected = true;
    });
    node.focus();
  });
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('#dst')).toHaveValue('pasted');
  expect(await page.evaluate(() => (window as any).__changeDetected)).toBe(true);
});

it('should let a page cancel a form-control paste via beforeinput', async ({ context }) => {
  await context.clipboard.writeText('should not appear');
  const page = await context.newPage();
  await setBody(page, `<input id="dst" value="keep">`);
  await page.locator('#dst').focus();
  await page.evaluate(() => {
    (window as any).__beforeinput = null;
    document.getElementById('dst')!.addEventListener('beforeinput', e => {
      (window as any).__beforeinput = { inputType: (e as InputEvent).inputType, cancelable: e.cancelable };
      e.preventDefault();
    });
  });
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => page.evaluate(() => (window as any).__beforeinput)).toEqual({ inputType: 'insertFromPaste', cancelable: true });
  await expect(page.locator('#dst')).toHaveValue('keep');
});

it('should fire beforeinput and input around a native cut in contenteditable', async ({ context }) => {
  await context.clipboard.writeText('seed');
  const page = await context.newPage();
  await setBody(page, `<div id="src" contenteditable>cut me</div>`);
  await page.evaluate(() => {
    (window as any).__events = [];
    for (const type of ['beforeinput', 'input'])
      document.addEventListener(type, e => (window as any).__events.push({ type, inputType: (e as InputEvent).inputType }), true);
  });
  await page.locator('#src').selectText();
  await page.keyboard.press('ControlOrMeta+x');
  await expect(page.locator('#src')).toHaveText('');
  expect(await page.evaluate(() => (window as any).__events)).toEqual([
    { type: 'beforeinput', inputType: 'deleteByCut' },
    { type: 'input', inputType: 'deleteByCut' },
  ]);
});

it('should carry dataTransfer on the contenteditable paste beforeinput', async ({ context }) => {
  await context.clipboard.writeText('rich');
  const page = await context.newPage();
  await setBody(page, `<div id="dst" contenteditable></div>`);
  await page.evaluate(() => {
    (window as any).__beforeinput = null;
    document.getElementById('dst')!.addEventListener('beforeinput', e => {
      (window as any).__beforeinput = { inputType: (e as InputEvent).inputType, cancelable: e.cancelable, hasDataTransfer: !!(e as InputEvent).dataTransfer };
    });
    document.getElementById('dst')!.focus();
  });
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => page.evaluate(() => (window as any).__beforeinput)).toEqual({ inputType: 'insertFromPaste', cancelable: true, hasDataTransfer: true });
});

it('should not execute scripts embedded in pasted HTML', async ({ context }) => {
  await context.clipboard.write([{ mimeType: 'text/html', buffer: Buffer.from('<b>safe</b><script>window.__ran = true</script><svg><script>window.__ran = true</script></svg><img src="x" onerror="window.__ran = true">') }]);
  const page = await context.newPage();
  await setBody(page, `<div id="dst" contenteditable></div>`);
  await page.evaluate(() => { (window as any).__ran = false; });
  await page.locator('#dst').focus();
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('#dst')).toContainText('safe');
  expect(await page.evaluate(() => document.querySelector('#dst script'))).toBeFalsy();
  expect(await page.evaluate(() => (window as any).__ran)).toBe(false);
});

it('should reject writing multiple ClipboardItems like the browser', async ({ context, server }) => {
  await context.clipboard.install();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const result = await page.evaluate(async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': new Blob(['a'], { type: 'text/plain' }) }),
        new ClipboardItem({ 'text/plain': new Blob(['b'], { type: 'text/plain' }) }),
      ]);
      return 'accepted';
    } catch (e) {
      return (e as Error).name;
    }
  });
  expect(result).toBe('NotAllowedError');
});
