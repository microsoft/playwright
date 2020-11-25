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
import { ElementHandle } from '..';
import { it, expect, describe } from './fixtures';
import { attachFrame } from './utils';

describe('Drag and drop', test => {
  test.fixme();
}, () => {
  it('should work', async ({server, page, context}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    await page.hover('#source');
    await page.mouse.down();
    await page.hover('#target');
    await page.mouse.up();
    expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
  });

  it('should send the right events', async ({server, page, isFirefox}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    const events = await trackEvents(await page.$('body'));
    await page.hover('#source');
    await page.mouse.down();
    await page.hover('#target');
    await page.mouse.up();
    expect(await events.jsonValue()).toEqual([
      'mousemove',
      'mousedown',
      isFirefox ? 'dragstart' : 'mousemove',
      isFirefox ? 'mousemove' : 'dragstart',
      'dragenter',
      'dragover',
      'drop',
      'dragend',
    ]);
  });

  it('should cancel on escape', async ({server, page, isFirefox}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    const events = await trackEvents(await page.$('body'));
    await page.hover('#source');
    await page.mouse.down();
    await page.hover('#target');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(false); // found source in target
    expect(await events.jsonValue()).toEqual([
      'mousemove',
      'mousedown',
      isFirefox ? 'dragstart' : 'mousemove',
      isFirefox ? 'mousemove' : 'dragstart',
      'dragenter',
      'dragover',
      'dragend',
      'mouseup',
    ]);
  });

  it('should drag into an iframe', async ({server, page, isFirefox}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    const frame = await attachFrame(page, 'oopif',server.CROSS_PROCESS_PREFIX + '/drag-n-drop.html');
    const pageEvents = await trackEvents(await page.$('body'));
    const frameEvents = await trackEvents(await frame.$('body'));
    await page.hover('#source');
    await page.mouse.down();
    await frame.hover('#target');
    await page.mouse.up();
    expect(await frame.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
    expect(await pageEvents.jsonValue()).toEqual([
      'mousemove',
      'mousedown',
      isFirefox ? 'dragstart' : 'mousemove',
      isFirefox ? 'mousemove' : 'dragstart',
    ]);
    expect(await frameEvents.jsonValue()).toEqual([
      'dragenter',
      'dragover',
      'drop',
    ]);
  });

  it('should drag out of an iframe', async ({server, page}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    const frame = await attachFrame(page, 'oopif',server.CROSS_PROCESS_PREFIX + '/drag-n-drop.html');
    const pageEvents = await trackEvents(await page.$('body'));
    const frameEvents = await trackEvents(await frame.$('body'));
    await frame.hover('#source');
    await page.mouse.down();
    await page.hover('#target');
    await page.mouse.up();
    expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
    expect(await frameEvents.jsonValue()).toEqual([
      'mousemove',
      'mousedown',
      'dragstart',
    ]);
    expect(await pageEvents.jsonValue()).toEqual([
      'dragenter',
      'dragover',
      'drop',
    ]);
  });

  it('should drag through a navigation', async ({server, page, isFirefox}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    const beforeNavigationEvents = await trackEvents(await page.$('body'));
    await page.hover('#source');
    await page.mouse.down();
    // start the drag
    await page.mouse.move(50, 50);

    expect(await beforeNavigationEvents.jsonValue()).toEqual([
      'mousemove',
      'mousedown',
      isFirefox ? 'dragstart' : 'mousemove',
      isFirefox ? 'mousemove' : 'dragstart',
      'dragenter',
      'dragover',
    ]);

    await page.reload();
    const afterNavigationEvents = await trackEvents(await page.$('body'));

    await page.hover('#target');
    await page.mouse.up();

    expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
    expect(await afterNavigationEvents.jsonValue()).toEqual([
      'dragenter',
      'dragover',
      'drop',
    ]);
  });

  async function trackEvents(target: ElementHandle) {
    const eventsHandle = await target.evaluateHandle(target => {
      const events: string[] = [];
      for (const event of [
        'mousedown', 'mousemove', 'mouseup',
        'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'dragexit',
        'drop'
      ])
        target.addEventListener(event, () => events.push(event), false);
      return events;
    });
    return eventsHandle;
  }
});
