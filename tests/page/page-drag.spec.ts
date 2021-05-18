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

import type { ElementHandle } from '../../index';
import { test as it, expect } from './pageTest';
import { attachFrame } from '../config/utils';

it.describe('Drag and drop', () => {
  it.skip(({ isAndroid }) => isAndroid);
  it.fixme(({ browserName }) => browserName === 'chromium');

  it('should work', async ({page, server}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    await page.hover('#source');
    await page.mouse.down();
    await page.hover('#target');
    await page.mouse.up();
    expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
  });

  it('should send the right events', async ({server, page, browserName}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    const events = await trackEvents(await page.$('body'));
    await page.hover('#source');
    await page.mouse.down();
    await page.hover('#target');
    await page.mouse.up();
    expect(await events.jsonValue()).toEqual([
      'mousemove',
      'mousedown',
      browserName === 'firefox' ? 'dragstart' : 'mousemove',
      browserName === 'firefox' ? 'mousemove' : 'dragstart',
      'dragenter',
      'dragover',
      'drop',
      'dragend',
    ]);
  });

  it('should cancel on escape', async ({server, page, browserName}) => {
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
      browserName === 'firefox' ? 'dragstart' : 'mousemove',
      browserName === 'firefox' ? 'mousemove' : 'dragstart',
      'dragenter',
      'dragover',
      'dragend',
      'mouseup',
    ]);
  });

  it.describe('iframe', () => {
    it.fixme('implement dragging with iframes');

    it('should drag into an iframe', async ({server, page, browserName}) => {
      await page.goto(server.PREFIX + '/drag-n-drop.html');
      const frame = await attachFrame(page, 'oopif',server.PREFIX + '/drag-n-drop.html');
      const pageEvents = await trackEvents(await page.$('body'));
      const frameEvents = await trackEvents(await frame.$('body'));
      await page.pause();
      await page.hover('#source');
      await page.mouse.down();
      await frame.hover('#target');
      await page.mouse.up();
      expect(await frame.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
      expect(await pageEvents.jsonValue()).toEqual([
        'mousemove',
        'mousedown',
        browserName === 'firefox' ? 'dragstart' : 'mousemove',
        browserName === 'firefox' ? 'mousemove' : 'dragstart',
      ]);
      expect(await frameEvents.jsonValue()).toEqual([
        'dragenter',
        'dragover',
        'drop',
      ]);
    });

    it('should drag out of an iframe', async ({server, page}) => {
      await page.goto(server.PREFIX + '/drag-n-drop.html');
      const frame = await attachFrame(page, 'oopif',server.PREFIX + '/drag-n-drop.html');
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
  });

  it('should respect the drop effect', async ({page, browserName, platform}) => {
    it.fixme(browserName === 'chromium', 'Chromium doesn\'t let users set dropEffect on our fake data transfer');
    it.fixme(browserName === 'webkit' && platform !== 'linux', 'WebKit doesn\'t handle the drop effect correctly outside of linux.');
    it.fixme(browserName === 'firefox');

    expect(await testIfDropped('copy', 'copy')).toBe(true);
    expect(await testIfDropped('copy', 'move')).toBe(false);
    expect(await testIfDropped('all', 'link')).toBe(true);
    expect(await testIfDropped('all', 'none')).toBe(false);

    expect(await testIfDropped('copyMove', 'copy')).toBe(true);
    expect(await testIfDropped('copyLink', 'copy')).toBe(true);
    expect(await testIfDropped('linkMove', 'copy')).toBe(false);

    expect(await testIfDropped('copyMove', 'link')).toBe(false);
    expect(await testIfDropped('copyLink', 'link')).toBe(true);
    expect(await testIfDropped('linkMove', 'link')).toBe(true);

    expect(await testIfDropped('copyMove', 'move')).toBe(true);
    expect(await testIfDropped('copyLink', 'move')).toBe(false);
    expect(await testIfDropped('linkMove', 'move')).toBe(true);

    expect(await testIfDropped('uninitialized', 'copy')).toBe(true);

    async function testIfDropped(effectAllowed: string, dropEffect: string) {
      await page.setContent(`
        <div draggable="true">drag target</div>
        <drop-target>this is the drop target</drop-target>
      `);
      await page.evaluate(({effectAllowed, dropEffect}) => {
        window['dropped'] = false;

        document.querySelector('div').addEventListener('dragstart', event => {
          event.dataTransfer.effectAllowed = effectAllowed as any;
          event.dataTransfer.setData('text/plain', 'drag data');
        });

        const dropTarget: HTMLElement = document.querySelector('drop-target');
        dropTarget.addEventListener('dragover', event => {
          event.dataTransfer.dropEffect = dropEffect as any;
          event.preventDefault();
        });
        dropTarget.addEventListener('drop', event => {
          window['dropped'] = true;
        });
      }, {effectAllowed, dropEffect});
      await page.hover('div');
      await page.mouse.down();
      await page.hover('drop-target');
      await page.mouse.up();
      return await page.evaluate('dropped');
    }
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
