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
import type { ElementHandle } from 'playwright-core';

it.use({ hasTouch: true });

it('should send all of the correct events @smoke', async ({ page }) => {
  await page.setContent(`
  <div id="a" style="background: lightblue; width: 50px; height: 50px">a</div>
  <div id="b" style="background: pink; width: 50px; height: 50px">b</div>
`);
  await page.tap('#a');
  const eventsHandle = await trackEvents(await page.$('#b'));
  await page.tap('#b');
  // webkit doesn't send pointerenter or pointerleave or mouseout
  expect(await eventsHandle.jsonValue()).toEqual([
    'pointerover',  'pointerenter',
    'pointerdown',  'touchstart',
    'pointerup',    'pointerout',
    'pointerleave', 'touchend',
    'mouseover',    'mouseenter',
    'mousemove',    'mousedown',
    'mouseup',      'click',
  ]);
});

it('trial run should not tap', async ({ page }) => {
  await page.setContent(`
    <div id="a" style="background: lightblue; width: 50px; height: 50px">a</div>
    <div id="b" style="background: pink; width: 50px; height: 50px">b</div>
  `);
  await page.tap('#a');
  const eventsHandle = await trackEvents(await page.$('#b'));
  await page.tap('#b', { trial: true });
  const expected = ['pointerover', 'pointerenter', 'pointerout', 'pointerleave'];
  expect(await eventsHandle.jsonValue()).toEqual(expected);
});

it('should not send mouse events touchstart is canceled', async ({ page }) => {
  await page.setContent(`<div style="width: 50px; height: 50px; background: red">`);
  await page.evaluate(() => {
    // touchstart is not cancelable unless passive is false
    document.addEventListener('touchstart', t => t.preventDefault(), { passive: false });
  });
  const eventsHandle = await trackEvents(await page.$('div'));
  await page.tap('div');
  expect(await eventsHandle.jsonValue()).toEqual([
    'pointerover',  'pointerenter',
    'pointerdown',  'touchstart',
    'pointerup',    'pointerout',
    'pointerleave', 'touchend',
  ]);
});

it('should not send mouse events when touchend is canceled', async ({ page }) => {
  await page.setContent(`<div style="width: 50px; height: 50px; background: red">`);
  await page.evaluate(() => {
    document.addEventListener('touchend', t => t.preventDefault());
  });
  const eventsHandle = await trackEvents(await page.$('div'));
  await page.tap('div');
  expect(await eventsHandle.jsonValue()).toEqual([
    'pointerover',  'pointerenter',
    'pointerdown',  'touchstart',
    'pointerup',    'pointerout',
    'pointerleave', 'touchend',
  ]);
});

it('should not wait for a navigation caused by a tap', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href="/intercept-this.html">link</a>;`);
  await Promise.all([
    new Promise(resolve => server.setRoute('/intercept-this.html', resolve)),
    page.tap('a'),
  ]);
});

it('should work with modifiers', async ({ page  }) => {
  await page.setContent('hello world');
  const altKeyPromise = page.evaluate(() => new Promise(resolve => {
    document.addEventListener('touchstart', event => {
      resolve(event.altKey);
    }, { passive: false });
  }));
  // make sure the evals hit the page
  await page.evaluate(() => void 0);
  await page.tap('body', {
    modifiers: ['Alt']
  });
  expect(await altKeyPromise).toBe(true);
});

it('should send well formed touch points', async ({ page }) => {
  const promises = Promise.all([
    page.evaluate(() => new Promise(resolve => {
      document.addEventListener('touchstart', event => {
        resolve([...event.touches].map(t => ({
          identifier: t.identifier,
          clientX: t.clientX,
          clientY: t.clientY,
          pageX: t.pageX,
          pageY: t.pageY,
          radiusX: 'radiusX' in t ? t.radiusX : t['webkitRadiusX'],
          radiusY: 'radiusY' in t ? t.radiusY : t['webkitRadiusY'],
          rotationAngle: 'rotationAngle' in t ? t.rotationAngle : t['webkitRotationAngle'],
          force: 'force' in t ? t.force : t['webkitForce'],
        })));
      }, false);
    })),
    page.evaluate(() => new Promise(resolve => {
      document.addEventListener('touchend', event => {
        resolve([...event.touches].map(t => ({
          identifier: t.identifier,
          clientX: t.clientX,
          clientY: t.clientY,
          pageX: t.pageX,
          pageY: t.pageY,
          radiusX: 'radiusX' in t ? t.radiusX : t['webkitRadiusX'],
          radiusY: 'radiusY' in t ? t.radiusY : t['webkitRadiusY'],
          rotationAngle: 'rotationAngle' in t ? t.rotationAngle : t['webkitRotationAngle'],
          force: 'force' in t ? t.force : t['webkitForce'],
        })));
      }, false);
    })),
  ]);
  // make sure the evals hit the page
  await page.evaluate(() => void 0);
  await page.touchscreen.tap(40, 60);
  const [touchstart, touchend] = await promises;

  expect(touchstart).toEqual([{
    clientX: 40,
    clientY: 60,
    force: 1,
    identifier: 0,
    pageX: 40,
    pageY: 60,
    radiusX: 1,
    radiusY: 1,
    rotationAngle: 0,
  }]);
  expect(touchend).toEqual([]);
});

it('should wait until an element is visible to tap it', async ({ page }) => {
  const div = await page.evaluateHandle(() => {
    const button = document.createElement('button');
    button.textContent = 'not clicked';
    document.body.appendChild(button);
    button.style.display = 'none';
    return button;
  });
  const tapPromise = div.tap();
  await div.evaluate(div => div.onclick = () => div.textContent = 'clicked');
  await div.evaluate(div => div.style.display = 'block');
  await tapPromise;
  expect(await div.textContent()).toBe('clicked');
});

async function trackEvents(target: ElementHandle) {
  const eventsHandle = await target.evaluateHandle(target => {
    const events: string[] = [];
    for (const event of [
      'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'click',
      'pointercancel', 'pointerdown', 'pointerenter', 'pointerleave', 'pointermove', 'pointerout', 'pointerover', 'pointerup',
      'touchstart', 'touchend', 'touchmove', 'touchcancel',
    ])
      target.addEventListener(event, () => events.push(event), false);
    return events;
  });
  return eventsHandle;
}

it.describe('locators', () => {
  it('should send all of the correct events', async ({ page }) => {
    await page.setContent(`
      <div id="a" style="background: lightblue; width: 50px; height: 50px">a</div>
      <div id="b" style="background: pink; width: 50px; height: 50px">b</div>
    `);
    await page.locator('#a').tap();
    await page.locator('#b').tap();
  });
});
