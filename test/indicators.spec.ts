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
import { folio } from './fixtures';
import { Page } from '..';

const fixtures = folio.extend();

fixtures.browserOptions.override(async ({browserOptions}, runTest) => {
  await runTest({
    ...browserOptions,
    showUserInput: true,
  });
});

fixtures.contextOptions.override(async ({contextOptions}, runTest) => {
  await runTest({
    ...contextOptions,
    hasTouch: true,
  });
});

const { it, expect, describe } = fixtures.build();

describe('mouse indicator', () => {
  it('should move the indicator with the mouse', async ({page}) => {
    await page.mouse.move(123, 456);
    const indicator = await page.$('playwright-mouse-indicator');
    expect(await indicator.boundingBox()).toEqual({
      x: 123,
      y: 456,
      width: 40,
      height: 40
    });
    await page.mouse.move(111, 222);
    expect(await indicator.boundingBox()).toEqual({
      x: 111,
      y: 222,
      width: 40,
      height: 40
    });
  });

  it('should move the indicator with the mouse', async ({page}) => {
    await page.mouse.move(123, 456);
    const indicator = await page.$('playwright-mouse-indicator');
    expect(await indicator.boundingBox()).toEqual({
      x: 123,
      y: 456,
      width: 40,
      height: 40
    });
    await page.mouse.move(111, 222);
    expect(await indicator.boundingBox()).toEqual({
      x: 111,
      y: 222,
      width: 40,
      height: 40
    });
  });

  it('work after the page reloads', async ({page}) => {
    await page.mouse.move(123, 456);
    let indicator = await page.$('playwright-mouse-indicator');
    expect(await indicator.boundingBox()).toEqual({
      x: 123,
      y: 456,
      width: 40,
      height: 40
    });
    await page.reload();
    await page.mouse.move(111, 222);
    indicator = await page.$('playwright-mouse-indicator');
    expect(await indicator.boundingBox()).toEqual({
      x: 111,
      y: 222,
      width: 40,
      height: 40
    });
  });

  it('should indicate when pressed', async ({page}) => {
    await page.mouse.move(123, 456);
    const indicator = await page.$('playwright-mouse-indicator');
    expect(await indicator.evaluate(e => e.classList.contains('pressed'))).toBe(false);
    await page.mouse.down();
    expect(await indicator.evaluate(e => e.classList.contains('pressed'))).toBe(true);
    expect(await indicator.boundingBox()).toEqual({
      x: 123,
      y: 456,
      width: 40,
      height: 40
    });
    await page.mouse.up();
    expect(await indicator.evaluate(e => e.classList.contains('pressed'))).toBe(false);
  });

  it('should be hidden while screenshotting', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    await page.mouse.move(100, 100);
    expect(await page.screenshot()).toMatchSnapshot('screenshot-sanity.png');
  });
});

describe('keyboard indicator', () => {
  it('should have text that was typed', async ({page}) => {
    const getEvents = await trackKeyboardIndicator(page);
    await page.keyboard.type('foo');
    expect(await getEvents()).toEqual([
      'f',
      'fo',
      'foo',
    ]);
  });

  it('should have text that was inserted', async ({page}) => {
    const getEvents = await trackKeyboardIndicator(page);
    await page.keyboard.insertText('foo 🍫');
    expect(await getEvents()).toEqual(['foo 🍫']);
  });

  it('should have the code of a key that was pressed', async ({page}) => {
    const getEvents = await trackKeyboardIndicator(page);
    await page.keyboard.press('Home');
    await page.keyboard.press('Control');
    await page.keyboard.type(' ');
    expect(await getEvents()).toEqual([
      'Home',
      'ControlLeft',
      'Space',
    ]);
  });

  it('should list modifiers when relevant', async ({page}) => {
    const getEvents = await trackKeyboardIndicator(page);
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Alt+Shift+7');
    await page.keyboard.press('Shift+Meta+J');
    await page.keyboard.press('Meta+Shift+J');
    expect(await getEvents()).toEqual([
      'ControlLeft',
      'Control + Home',

      'AltLeft',
      'Alt + ShiftLeft',
      'Alt + Shift + Digit7',

      'ShiftLeft',
      'Shift + MetaLeft',
      'Shift + Meta + KeyJ',

      'MetaLeft',
      'Meta + ShiftLeft',
      'Meta + Shift + KeyJ',
    ]);
  });

  it('should go away', async ({page}) => {
    await page.keyboard.type('foo');
    await page.evaluate(() => new Promise(x => setTimeout(x, 201)));
    expect(await keyboardIndicatorText(page)).toBe(null);

    async function keyboardIndicatorText(page: Page) {
      // @ts-expect-error because we are using internal _evaluateInUtility
      return await page.mainFrame()._evaluateInUtility(() => {
        const indicator = document.querySelector('playwright-keyboard-indicator');
        if (!indicator)
          return null;
        const shadow: ShadowRoot = (indicator as any).__shadowForTest;
        const div = shadow.querySelector('div');
        return div ? div.innerText : null;
      });
    }
  });

  async function trackKeyboardIndicator(page: Page) {
    // @ts-expect-error because we are using internal _evaluateInUtility
    const handle = await page.mainFrame()._evaluateHandleInUtility(() => {
      const events: string[] = [];
      const observer = new MutationObserver(mutationsList => {
        for (const mutation of mutationsList) {
          for (const node of mutation.addedNodes) {
            if ((node as HTMLElement).tagName === 'playwright-keyboard-indicator'.toUpperCase()) {
              const shadow: ShadowRoot = (node as any).__shadowForTest;
              new MutationObserver(pushEvent).observe(shadow, { subtree: true, childList: true, characterData: true });
              pushEvent();
              function pushEvent() {
                const div = shadow.querySelector('div');
                if (div)
                  events.push(div.innerText);
              }
            }
          }
        }
      });

      observer.observe(document.documentElement, { childList: true });

      return events;
    });
    return  () => handle.jsonValue();
  }
});

describe('touchscreen indicator', () => {
  it('should show taps', async ({page}) => {
    const {events, allDone} = await trackEvents(page);
    await page.touchscreen.tap(30, 50);
    await page.touchscreen.tap(70, 50);
    await page.touchscreen.tap(40, 20);
    expect(await events()).toEqual([
      '30px, 50px',
      '70px, 50px',
      '40px, 20px',
    ]);
    // all of the taps should eventually be removed
    await allDone();
  });
  it('should tap through the indicator', async ({page}) => {
    await page.setContent('foo');
    const {events, allDone} = await trackEvents(page);
    const webEventsHandle = await page.evaluateHandle(() => {
      const events = [];
      document.body.addEventListener('touchstart', () => events.push('touchstart'));
      document.body.addEventListener('touchend', () => events.push('touchend'));
      document.body.addEventListener('click', () => events.push('click'));
      return events;
    });
    await page.touchscreen.tap(20, 20);
    await page.touchscreen.tap(20, 20);
    expect(await events()).toEqual([
      '20px, 20px',
      '20px, 20px',
    ]);
    expect(await webEventsHandle.jsonValue()).toEqual([
      'touchstart',
      'touchend',
      'click',
      'touchstart',
      'touchend',
      'click',
    ]);
    // all of the taps should eventually be removed
    await allDone();
  });
  async function trackEvents(page: Page) {
    const handle = await page.evaluateHandle(() => {
      let allDoneCallback;
      const events: string[] = [];
      const observer = new MutationObserver(mutationsList => {
        for (const mutation of mutationsList) {
          for (const node of mutation.addedNodes)
            events.push((node as HTMLElement).style.left + ', ' + (node as HTMLElement).style.top);
        }
        if (allDoneCallback && !document.querySelector('playwright-touch-indicator'))
          allDoneCallback();
      });

      observer.observe(document.documentElement, { childList: true });

      return {
        events,
        allDone: async () => {
          if (!document.querySelector('playwright-touch-indicator'))
            return;
          return new Promise<void>(x => allDoneCallback = x);
        }
      };
    });
    return {
      events: () => handle.evaluate(x => x.events),
      allDone: () => handle.evaluate(x => x.allDone()),
    };
  }
});
