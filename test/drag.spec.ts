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

describe('Drag and drop', (test, {browserName}) => {
  test.fixme(browserName !== 'chromium');
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
      // 'dragenter',
      // 'dragover',
    ]);

    await page.reload();
    const afterNavigationEvents = await trackEvents(await page.$('body'));

    await page.hover('#target');
    await page.mouse.up();

    expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
    expect(await afterNavigationEvents.jsonValue()).toEqual([
      'dragenter',
      'dragover',
      'dragover',
      'drop',
    ]);
  });

  it('should work even if the page tries to stop us', async ({page, server}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    await page.evaluate(() => {
      window.DragEvent = null;
    });
    await page.hover('#source');
    await page.mouse.down();
    await page.hover('#target');
    await page.mouse.up();
    expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
  });

  it('should drag text into a textarea', async ({page}) => {
    await page.setContent(`
      <div>ThisIsTheText</div>
      <textarea></textarea>
    `);
    await page.click('div', {
      clickCount: 3
    });
    await page.mouse.down();
    await page.hover('textarea');
    await page.mouse.up();
    expect(await page.$eval('textarea', t => t.value.trim())).toBe('ThisIsTheText');
  });

  it('should not drop when the dragover is ignored', async ({page}) => {
    await page.setContent(`
      <div draggable="true">drag target</div>
      <drop-target>this is the drop target</drop-target>
    `);
    await page.evaluate(() => {
      const events = window['events'] = [];
      document.querySelector('div').addEventListener('dragstart', event => {
        events.push('dragstart');
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', 'drag data');
      });
      document.querySelector('drop-target').addEventListener('dragover', event => {
        events.push('dragover');
      });
      document.querySelector('drop-target').addEventListener('drop', event => {
        events.push('drop');
      });
      document.querySelector('div').addEventListener('dragend', event => {
        events.push('dragend');
      });
    });
    await page.hover('div');
    await page.mouse.down();
    await page.hover('drop-target');
    await page.mouse.up();
    expect(await page.evaluate('events')).toEqual([
      'dragstart',
      'dragover',
      'dragend'
    ]);
  });
  it('should respect the drop effect', (test, {browserName}) => {
    test.fixme(browserName === 'chromium', 'Chromium doesn\'t let users set dropEffect on our fake data transfer');
  }, async ({page}) => {
    page.on('console', console.log);
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
          event.dataTransfer.effectAllowed = effectAllowed;
          event.dataTransfer.setData('text/plain', 'drag data');
        });

        const dropTarget: HTMLElement = document.querySelector('drop-target');
        dropTarget.addEventListener('dragover', event => {
          const before = event.dataTransfer.dropEffect + ':';
          event.dataTransfer.dropEffect = dropEffect;
          console.log('set drop effect',before,  dropEffect, event.dataTransfer.dropEffect);
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
  it('should drop when it has all drop effects', async ({page}) => {
    await page.setContent(`
      <div draggable="true">drag target</div>
      <drop-target>this is the drop target</drop-target>
    `);
    await page.evaluate(() => {
      const events = window['events'] = [];
      const dropTarget: HTMLElement = document.querySelector('drop-target');
      document.querySelector('div').addEventListener('dragstart', event => {
        events.push('dragstart');
        event.dataTransfer.effectAllowed = 'all';
        event.dataTransfer.setData('text/plain', 'drag data');
      });
      dropTarget.addEventListener('dragover', event => {
        events.push('dragover');
        event.dataTransfer.dropEffect = 'copy';
        event.preventDefault();
      });
      dropTarget.addEventListener('drop', event => {
        events.push('drop');
      });
      document.querySelector('div').addEventListener('dragend', event => {
        events.push('dragend');
      });
    });
    await page.hover('div');
    await page.mouse.down();
    await page.hover('drop-target');
    await page.mouse.up();
    expect(await page.evaluate('events')).toEqual([
      'dragstart',
      'dragover',
      'drop',
      'dragend'
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
