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

import { stripAnsi } from '../config/utils';
import { test, expect } from './pageTest';

test.describe('toBeChecked', () => {
  test('default', async ({ page }) => {
    await page.setContent('<input type=checkbox checked></input>');
    const locator = page.locator('input');
    await expect(locator).toBeChecked();
  });

  test('with checked:true', async ({ page }) => {
    await page.setContent('<input type=checkbox checked></input>');
    const locator = page.locator('input');
    await expect(locator).toBeChecked({ checked: true });
  });

  test('with checked:false', async ({ page }) => {
    await page.setContent('<input type=checkbox checked></input>');
    const locator = page.locator('input');
    await expect(locator).not.toBeChecked({ checked: false });
  });

  test('with indeterminate:true', async ({ page }) => {
    await page.setContent('<input type=checkbox></input>');
    await page.locator('input').evaluate((e: HTMLInputElement) => e.indeterminate = true);
    const locator = page.locator('input');
    await expect(locator).toBeChecked({ indeterminate: true });
  });

  test('with indeterminate:true and checked', async ({ page }) => {
    await page.setContent('<input type=checkbox></input>');
    await page.locator('input').evaluate((e: HTMLInputElement) => e.indeterminate = true);
    const locator = page.locator('input');
    const error = await expect(locator).toBeChecked({ indeterminate: true, checked: false }).catch(e => e);
    expect(error.message).toContain(`Can\'t assert indeterminate and checked at the same time`);
  });

  test('fail', async ({ page }) => {
    await page.setContent('<input type=checkbox></input>');
    const locator = page.locator('input');
    const error = await expect(locator).toBeChecked({ timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`expect(locator).toBeChecked() failed

Locator:  locator('input')
Expected: checked
Received: unchecked
Timeout:  1000ms`);
    expect(stripAnsi(error.message)).toContain(`- Expect "toBeChecked" with timeout 1000ms`);
  });

  test('with not', async ({ page }) => {
    await page.setContent('<input type=checkbox></input>');
    const locator = page.locator('input');
    await expect(locator).not.toBeChecked();
  });

  test('with not and checked:false', async ({ page }) => {
    await page.setContent('<input type=checkbox></input>');
    const locator = page.locator('input');
    await expect(locator).toBeChecked({ checked: false });
  });

  test('fail with not', async ({ page }) => {
    await page.setContent('<input type=checkbox checked></input>');
    const locator = page.locator('input');
    const error = await expect(locator).not.toBeChecked({ timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`expect(locator).not.toBeChecked() failed

Locator:  locator('input')
Expected: not checked
Received: checked
Timeout:  1000ms`);
    expect(stripAnsi(error.message)).toContain(`- Expect "not toBeChecked" with timeout 1000ms`);
    expect(stripAnsi(error.message)).toContain(`locator resolved to <input checked type="checkbox"/>`);
  });

  test('fail with checked:false', async ({ page }) => {
    await page.setContent('<input type=checkbox checked></input>');
    const locator = page.locator('input');
    const error = await expect(locator).toBeChecked({ checked: false, timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`expect(locator).toBeChecked({ checked: false }) failed

Locator:  locator('input')
Expected: unchecked
Received: checked
Timeout:  1000ms`);
    expect(stripAnsi(error.message)).toContain(`- Expect "toBeChecked" with timeout 1000ms`);
    expect(stripAnsi(error.message)).toContain(`locator resolved to <input checked type="checkbox"/>`);
  });

  test('fail with indeterminate: true', async ({ page }) => {
    await page.setContent('<input type=checkbox></input>');
    const locator = page.locator('input');
    const error = await expect(locator).toBeChecked({ indeterminate: true, timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`expect(locator).toBeChecked({ indeterminate: true }) failed

Locator:  locator('input')
Expected: indeterminate
Received: unchecked
Timeout:  1000ms`);
    expect(stripAnsi(error.message)).toContain(`- Expect "toBeChecked" with timeout 1000ms`);
  });

  test('fail missing', async ({ page }) => {
    await page.setContent('<div>no inputs here</div>');
    const locator2 = page.locator('input2');
    const error = await expect(locator2).not.toBeChecked({ timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`expect(locator).not.toBeChecked() failed

Locator:  locator('input2')
Expected: not checked
Received: <element(s) not found>
Timeout:  1000ms`);
    expect(stripAnsi(error.message)).toContain(`- Expect "not toBeChecked" with timeout 1000ms`);
    expect(stripAnsi(error.message)).toContain(`- waiting for locator(\'input2\')`);
  });

  test('with role', async ({ page }) => {
    for (const role of ['checkbox', 'menuitemcheckbox', 'option', 'radio', 'switch', 'menuitemradio', 'treeitem']) {
      await test.step(`role=${role}`, async () => {
        await page.setContent(`<div role=${role} aria-checked=true>I am checked</div>`);
        const locator = page.locator('div');
        await expect(locator).toBeChecked();
      });
    }
  });

  test('friendly log', async ({ page }) => {
    await page.setContent('<input type=checkbox></input>');
    const message1 = await expect(page.locator('input')).toBeChecked({ timeout: 1000 }).catch(e => e.message);
    expect(message1).toContain('unexpected value "unchecked"');

    await page.setContent('<input type=checkbox checked></input>');
    const message2 = await expect(page.locator('input')).toBeChecked({ checked: false, timeout: 1000 }).catch(e => e.message);
    expect(message2).toContain('unexpected value "checked"');
  });

  test('with impossible timeout', async ({ page }) => {
    await page.setContent('<input type=checkbox checked></input>');
    await expect(page.locator('input')).toBeChecked({ timeout: 1 });
  });

  test('with impossible timeout .not', async ({ page }) => {
    await page.setContent('<input type=checkbox></input>');
    await expect(page.locator('input')).not.toBeChecked({ timeout: 1 });
  });
});

test.describe('toBeEditable', () => {
  test('default', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    await expect(locator).toBeEditable();
  });

  test('with not', async ({ page }) => {
    await page.setContent('<input readonly></input>');
    const locator = page.locator('input');
    await expect(locator).not.toBeEditable();
  });

  test('with editable:true', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    await expect(locator).toBeEditable({ editable: true });
  });

  test('with editable:false', async ({ page }) => {
    await page.setContent('<input readonly></input>');
    const locator = page.locator('input');
    await expect(locator).toBeEditable({ editable: false });
  });

  test('with not and editable:false', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    await expect(locator).not.toBeEditable({ editable: false });
  });

  test('throws', async ({ page }) => {
    await page.setContent('<button>');
    const locator = page.locator('button');
    const error = await expect(locator).toBeEditable().catch(e => e);
    expect(error.message).toContain('Element is not an <input>, <textarea>, <select> or [contenteditable] and does not have a role allowing [aria-readonly]');
  });
});

test.describe('toBeEnabled', () => {
  test('default', async ({ page }) => {
    await page.setContent('<button>Text</button>');
    const locator = page.locator('button');
    await expect(locator).toBeEnabled();
  });

  test('with enabled:true', async ({ page }) => {
    await page.setContent('<button>Text</button>');
    const locator = page.locator('button');
    await expect(locator).toBeEnabled({ enabled: true });
  });

  test('with enabled:false', async ({ page }) => {
    await page.setContent('<button disabled>Text</button>');
    const locator = page.locator('button');
    await expect(locator).toBeEnabled({ enabled: false });
  });

  test('failed', async ({ page }) => {
    await page.setContent('<button disabled>Text</button>');
    const locator = page.locator('button');
    const error = await expect(locator).toBeEnabled({ timeout: 1000 }).catch(e => e);
    expect(error.message).toContain(`locator resolved to <button disabled>Text</button>`);
  });

  test('eventually', async ({ page }) => {
    await page.setContent('<button disabled>Text</button>');
    const locator = page.locator('button');
    setTimeout(() => {
      locator.evaluate(e => e.removeAttribute('disabled')).catch(() => {});
    }, 500);
    await expect(locator).toBeEnabled();
  });

  test('eventually with not', async ({ page }) => {
    await page.setContent('<button>Text</button>');
    const locator = page.locator('button');
    setTimeout(() => {
      locator.evaluate(e => e.setAttribute('disabled', '')).catch(() => {});
    }, 500);
    await expect(locator).not.toBeEnabled();
  });

  test('with not and enabled:false', async ({ page }) => {
    await page.setContent('<button>Text</button>');
    const locator = page.locator('button');
    await expect(locator).not.toBeEnabled({ enabled: false });
  });

  test('toBeDisabled', async ({ page }) => {
    await page.setContent('<button disabled>Text</button>');
    const locator = page.locator('button');
    await expect(locator).toBeDisabled();
  });
});

test('toBeEmpty input', async ({ page }) => {
  await page.setContent('<input></input>');
  const locator = page.locator('input');
  await expect(locator).toBeEmpty();
});

test('not.toBeEmpty', async ({ page }) => {
  await page.setContent('<input value=text></input>');
  const locator = page.locator('input');
  await expect(locator).not.toBeEmpty();
});

test('toBeEmpty div', async ({ page }) => {
  await page.setContent('<div style="width: 50; height: 50px"></div>');
  const locator = page.locator('div');
  await expect(locator).toBeEmpty();
});

test('toBeDisabled with value', async ({ page }) => {
  await page.setContent('<button disabled="yes">Text</button>');
  const locator = page.locator('button');
  await expect(locator).toBeDisabled();
});

test('toBeChecked with value', async ({ page }) => {
  await page.setContent('<input type=checkbox checked="yes"></input>');
  const locator = page.locator('input');
  await expect(locator).toBeChecked();
});

test('toBeHidden with value', async ({ page }) => {
  await page.setContent('<input type=checkbox hidden="of course"></input>');
  const locator = page.locator('input');
  await expect(locator).toBeHidden();
});

test('not.toBeDisabled div', async ({ page }) => {
  await page.setContent('<div disabled="yes"></div>');
  const locator = page.locator('div');
  await expect(locator).not.toBeDisabled();
});

test.describe('toBeVisible', () => {
  test('default', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    await expect(locator).toBeVisible();
  });

  test('with not', async ({ page }) => {
    await page.setContent('<button style="display: none">hello</button>');
    const locator = page.locator('button');
    await expect(locator).not.toBeVisible();
  });

  test('with visible:true', async ({ page }) => {
    await page.setContent('<button>hello</button>');
    const locator = page.locator('button');
    await expect(locator).toBeVisible({ visible: true });
  });

  test('with visible:false', async ({ page }) => {
    await page.setContent('<button hidden>hello</button>');
    const locator = page.locator('button');
    await expect(locator).toBeVisible({ visible: false });
  });

  test('with not and visible:false', async ({ page }) => {
    await page.setContent('<button>hello</button>');
    const locator = page.locator('button');
    await expect(locator).not.toBeVisible({ visible: false });
  });

  test('eventually', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('span');
    setTimeout(() => {
      page.$eval('div', div => div.innerHTML = '<span>Hello</span>').catch(() => {});
    }, 0);
    await expect(locator).toBeVisible();
  });

  test('eventually with not', async ({ page }) => {
    await page.setContent('<div><span>Hello</span></div>');
    const locator = page.locator('span');
    setTimeout(() => {
      page.$eval('span', span => span.textContent = '').catch(() => {});
    }, 0);
    await expect(locator).not.toBeVisible();
  });

  test('fail', async ({ page }) => {
    await page.setContent('<button style="display: none"></button>');
    const locator = page.locator('button');
    const error = await expect(locator).toBeVisible({ timeout: 1000 }).catch(e => e);
    expect(error.message).toContain(`locator resolved to <button></button>`);
  });

  test('fail with not', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    const error = await expect(locator).not.toBeVisible({ timeout: 1000 }).catch(e => e);
    expect(error.message).toContain(`locator resolved to <input/>`);
  });

  test('with impossible timeout', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    await expect(page.locator('#node')).toBeVisible({ timeout: 1 });
  });

  test('with impossible timeout .not', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    await expect(page.locator('no-such-thing')).not.toBeVisible({ timeout: 1 });
  });

  test('with frameLocator', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.frameLocator('iframe').locator('input');
    let done = false;
    const promise = expect(locator).toBeVisible().then(() => done = true);
    await page.waitForTimeout(1000);
    expect(done).toBe(false);
    await page.setContent('<iframe srcdoc="<input>"></iframe>');
    await promise;
    expect(done).toBe(true);
  });

  test('with frameLocator 2', async ({ page }) => {
    await page.setContent('<iframe></iframe>');
    const locator = page.frameLocator('iframe').locator('input');
    let done = false;
    const promise = expect(locator).toBeVisible().then(() => done = true);
    await page.waitForTimeout(1000);
    expect(done).toBe(false);
    await page.setContent('<iframe srcdoc="<input>"></iframe>');
    await promise;
    expect(done).toBe(true);
  });

  test('over navigation', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    let done = false;
    const promise = expect(page.locator('input')).toBeVisible().then(() => done = true);
    await page.waitForTimeout(1000);
    expect(done).toBe(false);
    await page.goto(server.PREFIX + '/input/checkbox.html');
    await promise;
    expect(done).toBe(true);
  });
});

test.describe('toBeHidden', () => {
  test('default', async ({ page }) => {
    await page.setContent('<button style="display: none"></button>');
    const locator = page.locator('button');
    await expect(locator).toBeHidden();
  });

  test('when nothing matches', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('button');
    await expect(locator).toBeHidden();
  });

  test('with not', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    await expect(locator).not.toBeHidden();
  });

  test('eventually with not', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('span');
    setTimeout(() => {
      page.$eval('div', div => div.innerHTML = '<span>Hello</span>').catch(() => {});
    }, 0);
    await expect(locator).not.toBeHidden();
  });

  test('eventually', async ({ page }) => {
    await page.setContent('<div><span>Hello</span></div>');
    const locator = page.locator('span');
    setTimeout(() => {
      page.$eval('span', span => span.textContent = '').catch(() => {});
    }, 0);
    await expect(locator).toBeHidden();
  });

  test('fail', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    const error = await expect(locator).toBeHidden({ timeout: 1000 }).catch(e => e);
    expect(error.message).toContain(`locator resolved to <input/>`);
  });

  test('fail with not', async ({ page }) => {
    await page.setContent('<button style="display: none"></button>');
    const locator = page.locator('button');
    const error = await expect(locator).not.toBeHidden({ timeout: 1000 }).catch(e => e);
    expect(error.message).toContain(`locator resolved to <button></button>`);
  });

  test('fail with not when nothing matching', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('button');
    const error = await expect(locator).not.toBeHidden({ timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`expect(locator).not.toBeHidden() failed

Locator:  locator('button')
Expected: not hidden
Received: <element(s) not found>
Timeout:  1000ms`);
    expect(stripAnsi(error.message)).toContain(`- Expect "not toBeHidden" with timeout 1000ms`);
  });

  test('with impossible timeout .not', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    await expect(page.locator('#node')).not.toBeHidden({ timeout: 1 });
  });

  test('with impossible timeout', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    await expect(page.locator('no-such-thing')).toBeHidden({ timeout: 1 });
  });
});

test('toBeFocused', async ({ page }) => {
  await page.setContent('<input></input>');
  const locator = page.locator('input');
  await locator.focus();
  await expect(locator).toBeFocused();
});

test('toBeFocused with shadow elements', async ({ page }) => {
  await page.setContent(`
    <div id="app">
    </div>
    <script>
      const root = document.querySelector('div');
      const shadowRoot = root.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      input.id = "my-input"
      shadowRoot.appendChild(input);
    </script>
  `);

  await page.locator('input').focus();
  expect(await page.evaluate(() => document.activeElement.shadowRoot.activeElement.id)).toBe('my-input');
  await expect(page.locator('#app')).toBeFocused();
  await expect(page.locator('input')).toBeFocused();
});

test('should print unknown engine error', async ({ page }) => {
  const error = await expect(page.locator('row="row"')).toBeVisible().catch(e => e);
  expect(error.message).toContain(`Unknown engine "row" while parsing selector row="row"`);
});

test('should print selector syntax error', async ({ page }) => {
  const error = await expect(page.locator('row]')).toBeVisible().catch(e => e);
  expect(error.message).toContain(`Unexpected token "]" while parsing css selector "row]"`);
});

test.describe(() => {
  test.skip(({ isAndroid }) => isAndroid, 'server.EMPTY_PAGE is the emulator address 10.0.2.2');
  test.skip(({ isElectron, electronMajorVersion }) => isElectron && electronMajorVersion < 30, 'Protocol error (Storage.getCookies): Browser context management is not supported.');

  test('toBeOK', async ({ page, server }) => {
    const res = await page.request.get(server.EMPTY_PAGE);
    await expect(res).toBeOK();
  });

  test('not.toBeOK', async ({ page, server }) => {
    const res = await page.request.get(`${server.PREFIX}/unknown`);
    await expect(res).not.toBeOK();
  });


  test('toBeOK fail with invalid argument', async ({ page }) => {
    const error = await (expect(page) as any).toBeOK().catch(e => e);
    expect(error.message).toContain('toBeOK can be only used with APIResponse object');
  });

  test('toBeOK fail with promise', async ({ page, server }) => {
    const res = page.request.get(server.EMPTY_PAGE);
    const error = await (expect(res) as any).toBeOK().catch(e => e);
    expect(error.message).toContain('toBeOK can be only used with APIResponse object');
    await res;
  });

  test.describe('toBeOK should print response with text content type when fails', () => {
    test.beforeEach(async ({ server }) => {
      server.setRoute('/text-content-type', (req, res) => {
        res.statusCode = 404;
        res.setHeader('Content-type', 'text/plain');
        res.end('Text error');
      });
      server.setRoute('/no-content-type', (req, res) => {
        res.statusCode = 404;
        res.end('No content type error');
      });
      server.setRoute('/binary-content-type', (req, res) => {
        res.statusCode = 404;
        res.setHeader('Content-type', 'image/bmp');
        res.end('Image content type error');
      });
    });

    test('text content type', async ({ page, server }) => {
      const res = await page.request.get(`${server.PREFIX}/text-content-type`);
      const error = await expect(res).toBeOK().catch(e => e);
      expect(error.message).toContain(`→ GET ${server.PREFIX}/text-content-type`);
      expect(error.message).toContain(`← 404 Not Found`);
      expect(error.message).toContain(`Text error`);
    });

    test('no content type', async ({ page, server }) => {
      const res = await page.request.get(`${server.PREFIX}/no-content-type`);
      const error = await expect(res).toBeOK().catch(e => e);
      expect(error.message).toContain(`→ GET ${server.PREFIX}/no-content-type`);
      expect(error.message).toContain(`← 404 Not Found`);
      expect(error.message).not.toContain(`No content type error`);
    });

    test('image content type', async ({ page, server }) => {
      const res = await page.request.get(`${server.PREFIX}/image-content-type`);
      const error = await expect(res).toBeOK().catch(e => e);
      expect(error.message).toContain(`→ GET ${server.PREFIX}/image-content-type`);
      expect(error.message).toContain(`← 404 Not Found`);
      expect(error.message).not.toContain(`Image content type error`);
    });
  });
});

test.describe('toBeAttached', () => {
  test('default', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    await expect(locator).toBeAttached();
  });

  test('with hidden element', async ({ page }) => {
    await page.setContent('<button style="display:none">hello</button>');
    const locator = page.locator('button');
    await expect(locator).toBeAttached();
  });

  test('with not', async ({ page }) => {
    await page.setContent('<button>hello</button>');
    const locator = page.locator('input');
    await expect(locator).not.toBeAttached();
  });

  test('with attached:true', async ({ page }) => {
    await page.setContent('<button>hello</button>');
    const locator = page.locator('button');
    await expect(locator).toBeAttached({ attached: true });
  });

  test('with attached:false', async ({ page }) => {
    await page.setContent('<button>hello</button>');
    const locator = page.locator('input');
    await expect(locator).toBeAttached({ attached: false });
  });

  test('with not and attached:false', async ({ page }) => {
    await page.setContent('<button>hello</button>');
    const locator = page.locator('button');
    await expect(locator).not.toBeAttached({ attached: false });
  });

  test('eventually', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('span');
    setTimeout(() => {
      page.$eval('div', div => div.innerHTML = '<span>Hello</span>').catch(() => {});
    }, 0);
    await expect(locator).toBeAttached();
  });

  test('eventually with not', async ({ page }) => {
    await page.setContent('<div><span>Hello</span></div>');
    const locator = page.locator('span');
    setTimeout(() => {
      page.$eval('div', div => div.textContent = '').catch(() => {});
    }, 0);
    await expect(locator).not.toBeAttached();
  });

  test('fail', async ({ page }) => {
    await page.setContent('<button>Hello</button>');
    const locator = page.locator('input');
    const error = await expect(locator).toBeAttached({ timeout: 1000 }).catch(e => e);
    expect(error.message).not.toContain(`locator resolved to`);
  });

  test('fail with not', async ({ page }) => {
    await page.setContent('<input></input>');
    const locator = page.locator('input');
    const error = await expect(locator).not.toBeAttached({ timeout: 1000 }).catch(e => e);
    expect(error.message).toContain(`locator resolved to <input/>`);
  });

  test('with impossible timeout', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    await expect(page.locator('#node')).toBeAttached({ timeout: 1 });
  });

  test('with impossible timeout .not', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    await expect(page.locator('no-such-thing')).not.toBeAttached({ timeout: 1 });
  });

  test('with frameLocator', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.frameLocator('iframe').locator('input');
    let done = false;
    const promise = expect(locator).toBeAttached().then(() => done = true);
    await page.waitForTimeout(1000);
    expect(done).toBe(false);
    await page.setContent('<iframe srcdoc="<input>"></iframe>');
    await promise;
    expect(done).toBe(true);
  });

  test('over navigation', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    let done = false;
    const promise = expect(page.locator('input')).toBeAttached().then(() => done = true);
    await page.waitForTimeout(1000);
    expect(done).toBe(false);
    await page.goto(server.PREFIX + '/input/checkbox.html');
    await promise;
    expect(done).toBe(true);
  });
});
