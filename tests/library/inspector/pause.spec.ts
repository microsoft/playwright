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

import type { Page } from 'playwright-core';
import { test as it, expect, Recorder } from './inspectorTest';
import { waitForTestLog } from '../../config/utils';
import { roundBox } from '../../page/pageTest';
import type { BoundingBox } from '../../page/pageTest';

it('should resume when closing inspector', async ({ page, recorderPageGetter, closeRecorder, mode }) => {
  it.skip(mode !== 'default');

  const scriptPromise = (async () => {
    // @ts-ignore
    await page.pause({ __testHookKeepTestTimeout: true });
  })();
  await recorderPageGetter();
  await closeRecorder();
  await scriptPromise;
});

it('should not reset timeouts', async ({ page, recorderPageGetter, closeRecorder, server }) => {
  page.context().setDefaultNavigationTimeout(1000);
  page.context().setDefaultTimeout(1000);

  // @ts-ignore
  const pausePromise = page.pause({ __testHookKeepTestTimeout: true });
  await recorderPageGetter();
  await closeRecorder();
  await pausePromise;

  server.setRoute('/empty.html', () => {});
  const error = await page.goto(server.EMPTY_PAGE).catch(e => e);
  expect(error.message).toContain('page.goto: Timeout 1000ms exceeded.');
});

it.describe('pause', () => {
  it.skip(({ mode }) => mode !== 'default');

  it.afterEach(async ({ recorderPageGetter }, testInfo) => {
    if (testInfo.status === 'skipped')
      return;
    try {
      const recorderPage = await recorderPageGetter();
      recorderPage.click('[title="Resume (F8)"]').catch(() => {});
    } catch (e) {
      // Some tests close context.
    }
  });

  it('should pause and resume the script', async ({ page, recorderPageGetter }) => {
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should pause and resume the script with keyboard shortcut', async ({ page, recorderPageGetter }) => {
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
    })();
    const recorderPage = await recorderPageGetter();
    await expect(recorderPage.getByRole('button', { name: 'Resume' })).toBeEnabled();
    await recorderPage.keyboard.press('F8');
    await scriptPromise;
  });

  it('should resume from console', async ({ page }) => {
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
    })();
    await Promise.all([
      page.waitForFunction(() => (window as any).playwright && (window as any).playwright.resume).then(() => {
        return page.evaluate('window.playwright.resume()');
      })
    ]);
    await scriptPromise;
  });

  it('should pause after a navigation', async ({ page, server, recorderPageGetter }) => {
    const scriptPromise = (async () => {
      await page.goto(server.EMPTY_PAGE);
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should show source', async ({ page, recorderPageGetter }) => {
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
    })();
    const recorderPage = await recorderPageGetter();
    await expect(recorderPage.getByRole('combobox', { name: 'Source chooser' })).toHaveValue(/pause\.spec\.ts/);
    const source = await recorderPage.textContent('.source-line-paused');
    expect(source).toContain('page.pause({ __testHookKeepTestTimeout: true })');
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should pause on next pause', async ({ page, recorderPageGetter }) => {
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });  // 1
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });  // 2
    })();
    const recorderPage = await recorderPageGetter();
    const source = await recorderPage.textContent('.source-line-paused');
    expect(source).toContain('page.pause({ __testHookKeepTestTimeout: true });  // 1');
    await recorderPage.click('[title="Resume (F8)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.pause({ __testHookKeepTestTimeout: true });  // 2")');
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should step', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button>Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.click('button');
    })();
    const recorderPage = await recorderPageGetter();
    const source = await recorderPage.textContent('.source-line-paused');
    expect(source).toContain('page.pause({ __testHookKeepTestTimeout: true });');

    await recorderPage.click('[title="Step over (F10)"]');
    await recorderPage.waitForSelector('.source-line-paused :has-text("page.click")');

    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should step with keyboard shortcut', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button>Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.click('button');
    })();
    const recorderPage = await recorderPageGetter();
    const source = await recorderPage.textContent('.source-line-paused');
    expect(source).toContain('page.pause({ __testHookKeepTestTimeout: true });');

    await recorderPage.keyboard.press('F10');
    await recorderPage.waitForSelector('.source-line-paused :has-text("page.click")');
    await recorderPage.isEnabled('[title="Resume (F8)"]');

    await recorderPage.keyboard.press('F8');
    await scriptPromise;
  });

  it('should highlight pointer, only in main frame', async ({ page, recorderPageGetter }) => {
    await page.setContent(`
      <iframe
        style="margin: 100px;"
        srcdoc="<button style='margin: 80px;'>Submit</button>">
      </iframe>
    `);
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.frameLocator('iframe').locator('button').click();
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Step over (F10)"]');

    const iframe = page.frames()[1];
    const button = await iframe.waitForSelector('button');
    const box1Promise = button.boundingBox();

    const actionPoint = await page.waitForSelector('x-pw-action-point');
    const box2Promise = actionPoint.boundingBox();
    await recorderPage.click('[title="Step over (F10)"]');

    const box1 = await box1Promise;
    const box2 = await box2Promise;

    const iframeActionPoint = await iframe.$('x-pw-action-point');
    const iframeActionPointPromise = iframeActionPoint?.boundingBox();
    await recorderPage.click('[title="Resume (F8)"]');

    expect(await iframeActionPointPromise).toBeFalsy();

    const x1 = box1!.x + box1!.width / 2;
    const y1 = box1!.y + box1!.height / 2;
    const x2 = box2!.x + box2!.width / 2;
    const y2 = box2!.y + box2!.height / 2;

    expect(Math.abs(x1 - x2) < 2).toBeTruthy();
    expect(Math.abs(y1 - y2) < 2).toBeTruthy();

    await scriptPromise;
  });

  it('should skip input when resuming', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button>Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.click('button');
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });  // 2
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Resume (F8)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.pause({ __testHookKeepTestTimeout: true });  // 2")');
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should populate log', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button>Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.click('button');
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });  // 2
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Resume (F8)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.pause({ __testHookKeepTestTimeout: true });  // 2")');
    expect(await sanitizeLog(recorderPage)).toEqual([
      'Pause- XXms',
      'Click(page.locator(\'button\'))- XXms',
      'Pause',
    ]);
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should hide internal calls', async ({ page, recorderPageGetter, trace }) => {
    it.skip(trace === 'on');

    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.context().tracing.start();
      page.setDefaultTimeout(0);
      page.context().setDefaultNavigationTimeout(0);
      await page.context().tracing.stop();
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });  // 2
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Resume (F8)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.pause({ __testHookKeepTestTimeout: true });  // 2")');
    expect(await sanitizeLog(recorderPage)).toEqual([
      'Pause- XXms',
      'Pause',
    ]);
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should show expect.toHaveText', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button>Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await expect(page.locator('button')).toHaveText('Submit');
      await expect(page.locator('button')).not.toHaveText('Submit2');
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });  // 2
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Resume (F8)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.pause({ __testHookKeepTestTimeout: true });  // 2")');
    expect(await sanitizeLog(recorderPage)).toEqual([
      'Pause- XXms',
      'Expect "toHaveText"(page.locator(\'button\'))- XXms',
      'Expect "not toHaveText"(page.locator(\'button\'))- XXms',
      'Pause',
    ]);
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should highlight waitForEvent', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button onclick="console.log(1)">Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await Promise.all([
        page.waitForEvent('console', msg => msg.type() === 'log' && msg.text() === '1'),
        page.click('button'),
      ]);
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Step over (F10)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.click")');
    await recorderPage.waitForSelector('.source-line-running:has-text("page.waitForEvent")');
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should populate log with waitForEvent', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button onclick="console.log(1)">Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await Promise.all([
        page.waitForEvent('console'),
        page.getByRole('button', { name: 'Submit' }).click(),
      ]);
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });  // 2
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Resume (F8)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.pause({ __testHookKeepTestTimeout: true });  // 2")');
    expect(await sanitizeLog(recorderPage)).toEqual([
      'Pause- XXms',
      'Wait for event "console"- XXms',
      'Click(page.getByRole(\'button\', { name: \'Submit\' }))- XXms',
      'Pause',
    ]);
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should populate log with error', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button onclick="console.log(1)">Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.getByRole('button').isChecked();
    })().catch(e => e);
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Resume (F8)"]');
    await recorderPage.waitForSelector('.source-line-error-underline');
    expect(await sanitizeLog(recorderPage)).toEqual([
      'Pause- XXms',
      'Is checked(page.getByRole(\'button\'))- XXms',
      'waiting for getByRole(\'button\')',
      'error: Error: Not a checkbox or radio button',
    ]);
    const error = await scriptPromise;
    expect(error.message).toContain('Not a checkbox or radio button');
  });

  it('should populate log with error in waitForEvent', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button>Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await Promise.all([
        page.waitForEvent('console', { timeout: 1 }).catch(() => {}),
        // @ts-ignore
        page.pause({ __testHookKeepTestTimeout: true }),
      ]);
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Step over (F10)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.pause")');
    await recorderPage.waitForSelector('.source-line-error:has-text("page.waitForEvent")');
    expect(await sanitizeLog(recorderPage)).toEqual([
      'Pause- XXms',
      'Wait for event "console"- XXms',
      'waiting for event "console"',
      'error: Timeout 1ms exceeded while waiting for event "console"',
      'Pause',
    ]);
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should pause on page close', async ({ page, recorderPageGetter }) => {
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.close();
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Step over (F10)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.close();")');
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should pause on context close', async ({ page, recorderPageGetter }) => {
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.context().close();
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.click('[title="Step over (F10)"]');
    await recorderPage.waitForSelector('.source-line-paused:has-text("page.context().close();")');
    // Next line can throw because closing context also closes the inspector page.
    await recorderPage.click('[title="Resume (F8)"]').catch(e => {});
    await scriptPromise;
  });

  it('should highlight on explore', async ({ page, recorderPageGetter }) => {
    await page.setContent('<button>Submit</button>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
    })();
    const recorderPage = await recorderPageGetter();

    const box1Promise = waitForTestLog<BoundingBox>(page, 'Highlight box for test: ');
    await recorderPage.getByText('Locator', { exact: true }).click();
    await recorderPage.locator('.tabbed-pane .CodeMirror').click();
    await recorderPage.keyboard.press('ControlOrMeta+A');
    await recorderPage.keyboard.press('Backspace');
    await recorderPage.keyboard.type('getByText(\'Submit\')');
    const box1 = await box1Promise;

    const button = await page.$('text=Submit');
    const box2 = await button!.boundingBox();
    expect(roundBox(box1)).toEqual(roundBox(box2!));
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should highlight on explore (csharp)', async ({ page, recorderPageGetter }) => {
    process.env.TEST_INSPECTOR_LANGUAGE = 'csharp';
    try {
      await page.setContent('<button>Submit</button>');
      const scriptPromise = (async () => {
        // @ts-ignore
        await page.pause({ __testHookKeepTestTimeout: true });
      })();
      const recorderPage = await recorderPageGetter();

      await recorderPage.getByRole('combobox', { name: 'Source chooser' }).selectOption('csharp');
      const box1Promise = waitForTestLog<BoundingBox>(page, 'Highlight box for test: ');
      await recorderPage.getByText('Locator', { exact: true }).click();
      await recorderPage.locator('.tabbed-pane .CodeMirror').click();
      await recorderPage.keyboard.press('ControlOrMeta+A');
      await recorderPage.keyboard.press('Backspace');
      await recorderPage.keyboard.type('GetByText("Submit")');
      const box1 = await box1Promise;

      const button = await page.$('text=Submit');
      const box2 = await button.boundingBox();
      expect(roundBox(box1)).toEqual(roundBox(box2));
      await recorderPage.click('[title="Resume (F8)"]');
      await scriptPromise;
    } finally {
      delete process.env.TEST_INSPECTOR_LANGUAGE;
    }
  });

  it('should not prevent key events', async ({ page, recorderPageGetter }) => {
    await page.setContent('<div>Hello</div>');
    await page.evaluate(() => {
      (window as any).log = [];
      for (const event of ['keydown', 'keyup', 'keypress'])
        window.addEventListener(event, e => (window as any).log.push(e.type));
    });
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      await page.keyboard.press('Enter');
      await page.keyboard.press('A');
      await page.keyboard.press('Shift+A');
    })();
    const recorderPage = await recorderPageGetter();
    await recorderPage.waitForSelector(`.source-line-paused:has-text("page.pause")`);
    await recorderPage.click('[title="Step over (F10)"]');
    await recorderPage.waitForSelector(`.source-line-paused:has-text("press('Enter')")`);
    await recorderPage.click('[title="Step over (F10)"]');
    await recorderPage.waitForSelector(`.source-line-paused:has-text("press('A')")`);
    await recorderPage.click('[title="Step over (F10)"]');
    await recorderPage.waitForSelector(`.source-line-paused:has-text("press('Shift+A')")`);
    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;

    const log = await page.evaluate(() => (window as any).log);
    expect(log).toEqual([
      'keydown',
      'keypress',
      'keyup',
      'keydown',
      'keypress',
      'keyup',
      'keydown',
      'keydown',
      'keypress',
      'keyup',
      'keyup',
    ]);
  });

  it('should highlight locators with custom testId', async ({ page, playwright, recorderPageGetter }) => {
    await page.setContent('<div data-custom-id=foo id=target>and me</div>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
      playwright.selectors.setTestIdAttribute('data-custom-id');
      await page.getByTestId('foo').click();
    })();
    const recorderPage = await recorderPageGetter();

    const box1Promise = waitForTestLog<BoundingBox>(page, 'Highlight box for test: ');
    await recorderPage.click('[title="Step over (F10)"]');
    const box2 = roundBox((await page.locator('#target').boundingBox())!);
    const box1 = roundBox(await box1Promise);
    expect(box1).toEqual(box2);

    await recorderPage.click('[title="Resume (F8)"]');
    await scriptPromise;
  });

  it('should record from debugger', async ({ page, recorderPageGetter }) => {
    await page.setContent('<body style="width: 100%; height: 100%"></body>');
    const scriptPromise = (async () => {
      // @ts-ignore
      await page.pause({ __testHookKeepTestTimeout: true });
    })();
    const recorderPage = await recorderPageGetter();
    await expect(recorderPage.getByRole('combobox', { name: 'Source chooser' })).toHaveValue(/pause\.spec\.ts/);
    await expect(recorderPage.locator('.source-line-paused')).toHaveText(/await page\.pause\(.*\)/);
    await recorderPage.getByRole('button', { name: 'Record' }).click();

    const recorder = new Recorder(page, recorderPage);
    await recorder.hoverOverElement('body', { omitTooltip: true });
    await recorder.trustedClick();

    await expect(recorderPage.getByRole('combobox', { name: 'Source chooser' })).toHaveValue('playwright-test');
    await expect(recorderPage.locator('.cm-wrapper')).toContainText(`await page.locator('body').click();`);
    await recorderPage.getByRole('button', { name: 'Resume' }).click();
    await scriptPromise;
  });
});

async function sanitizeLog(recorderPage: Page): Promise<string[]> {
  const results = [];
  for (const entry of await recorderPage.$$('.call-log-call')) {
    const header = (await (await entry.$('.call-log-call-header'))!.textContent())!.replace(/— [\d.]+(ms|s)/, '- XXms');
    results.push(header.replace(/page\.waitForEvent\(console\).*/, 'page.waitForEvent(console)'));
    results.push(...await entry.$$eval('.call-log-message', ee => ee.map(e => {
      return (e.classList.contains('error') ? 'error: ' : '') + e.textContent;
    })));
  }
  return results;
}
