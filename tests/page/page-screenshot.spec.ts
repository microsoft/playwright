/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test as it, expect } from './pageTest';
import { verifyViewport } from '../config/utils';
import path from 'path';
import fs from 'fs';
import os from 'os';

it.describe('page screenshot', () => {
  it.skip(({ browserName, headless }) => browserName === 'firefox' && !headless, 'Firefox headed produces a different image.');
  it.skip(({ isAndroid }) => isAndroid, 'Different viewport');

  it('should work #smoke', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-sanity.png');
  });

  it('should not capture blinking caret', async ({ page, server }) => {
    await page.setContent(`
      <div contenteditable="true"></div>
    `);
    const div = page.locator('div');
    await div.type('foo bar');
    const screenshot = await div.screenshot();
    for (let i = 0; i < 10; ++i) {
      // Caret blinking time is set to 500ms.
      // Try to capture variety of screenshots to make
      // sure we don't capture blinking caret.
      await new Promise(x => setTimeout(x, 150));
      const newScreenshot = await div.screenshot();
      expect(newScreenshot.equals(screenshot)).toBe(true);
    }
  });

  it('should clip rect', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({
      clip: {
        x: 50,
        y: 100,
        width: 150,
        height: 100
      }
    });
    expect(screenshot).toMatchSnapshot('screenshot-clip-rect.png');
  });

  it('should clip rect with fullPage', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(150, 200));
    const screenshot = await page.screenshot({
      fullPage: true,
      clip: {
        x: 50,
        y: 100,
        width: 150,
        height: 100,
      },
    });
    expect(screenshot).toMatchSnapshot('screenshot-clip-rect.png');
  });

  it('should clip elements to the viewport', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({
      clip: {
        x: 50,
        y: 450,
        width: 1000,
        height: 100
      }
    });
    expect(screenshot).toMatchSnapshot('screenshot-offscreen-clip.png');
  });

  it('should throw on clip outside the viewport', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const screenshotError = await page.screenshot({
      clip: {
        x: 50,
        y: 650,
        width: 100,
        height: 100
      }
    }).catch(error => error);
    expect(screenshotError.message).toContain('Clipped area is either empty or outside the resulting image');
  });

  it('should run in parallel', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const promises = [];
    for (let i = 0; i < 3; ++i) {
      promises.push(page.screenshot({
        clip: {
          x: 50 * i,
          y: 0,
          width: 50,
          height: 50
        }
      }));
    }
    const screenshots = await Promise.all(promises);
    expect(screenshots[1]).toMatchSnapshot('grid-cell-1.png');
  });

  it('should take fullPage screenshots', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({
      fullPage: true
    });
    expect(screenshot).toMatchSnapshot('screenshot-grid-fullpage.png');
  });

  it('should restore viewport after fullPage screenshot', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeInstanceOf(Buffer);
    await verifyViewport(page, 500, 500);
  });

  it('should allow transparency', async ({ page, browserName }) => {
    it.fail(browserName === 'firefox');

    await page.setViewportSize({ width: 50, height: 150 });
    await page.setContent(`
      <style>
        body { margin: 0 }
        div { width: 50px; height: 50px; }
      </style>
      <div style="background:black"></div>
      <div style="background:white"></div>
      <div style="background:transparent"></div>
    `);
    const screenshot = await page.screenshot({ omitBackground: true });
    expect(screenshot).toMatchSnapshot('transparent.png');
  });

  it('should render white background on jpeg file', async ({ page, server, isElectron }) => {
    it.fixme(isElectron, 'omitBackground with jpeg does not work');

    await page.setViewportSize({ width: 100, height: 100 });
    await page.goto(server.EMPTY_PAGE);
    const screenshot = await page.screenshot({ omitBackground: true, type: 'jpeg' });
    expect(screenshot).toMatchSnapshot('white.jpg');
  });

  it('should work with odd clip size on Retina displays', async ({ page, isElectron }) => {
    it.fixme(isElectron, 'Scale is wrong');

    const screenshot = await page.screenshot({
      clip: {
        x: 0,
        y: 0,
        width: 11,
        height: 11,
      }
    });
    expect(screenshot).toMatchSnapshot('screenshot-clip-odd-size.png');
  });

  it('should work for canvas', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/screenshots/canvas.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-canvas.png', { threshold: 0.4 });
  });

  it('should capture canvas changes', async ({ page, isElectron }) => {
    it.skip(isElectron);
    await page.goto('data:text/html,<canvas></canvas>');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas.width = 600;
      canvas.height = 600;
    });

    async function addLine(step: number) {
      await page.evaluate(n => {
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, n * 100);
        ctx.lineTo(300, n * 100);
        ctx.stroke();
      }, step);
    }

    for (let i = 0; i < 3; i++) {
      await addLine(i);
      // With the slight delay WebKit stops reflecting changes in the screenshots on macOS.
      await new Promise(f => setTimeout(f, 100));
      const screenshot = await page.screenshot();
      expect(screenshot).toMatchSnapshot(`canvas-changes-${i}.png`);
    }
  });

  it('should work for webgl', async ({ page, server, browserName }) => {
    it.fixme(browserName === 'firefox' || browserName === 'webkit');

    await page.setViewportSize({ width: 640, height: 480 });
    await page.goto(server.PREFIX + '/screenshots/webgl.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-webgl.png');
  });

  it('should work for translateZ', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/screenshots/translateZ.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-translateZ.png');
  });

  it('should work while navigating', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/redirectloop1.html');
    for (let i = 0; i < 10; i++) {
      const screenshot = await page.screenshot({ fullPage: true }).catch(e => {
        if (e.message.includes('Cannot take a screenshot while page is navigating'))
          return Buffer.from('');
        throw e;
      });
      expect(screenshot).toBeInstanceOf(Buffer);
    }
  });

  it('should work with iframe in shadow', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid-iframe-in-shadow.html');
    expect(await page.screenshot()).toMatchSnapshot('screenshot-iframe.png');
  });

  it('path option should work', async ({ page, server }, testInfo) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const outputPath = testInfo.outputPath('screenshot.png');
    await page.screenshot({ path: outputPath });
    expect(await fs.promises.readFile(outputPath)).toMatchSnapshot('screenshot-sanity.png');
  });

  it('path option should create subdirectories', async ({ page, server }, testInfo) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const outputPath = testInfo.outputPath(path.join('these', 'are', 'directories', 'screenshot.png'));
    await page.screenshot({ path: outputPath });
    expect(await fs.promises.readFile(outputPath)).toMatchSnapshot('screenshot-sanity.png');
  });

  it('path option should detect jpeg', async ({ page, server, isElectron }, testInfo) => {
    it.fixme(isElectron, 'omitBackground with jpeg does not work');

    await page.setViewportSize({ width: 100, height: 100 });
    await page.goto(server.EMPTY_PAGE);
    const outputPath = testInfo.outputPath('screenshot.jpg');
    const screenshot = await page.screenshot({ omitBackground: true, path: outputPath });
    expect(await fs.promises.readFile(outputPath)).toMatchSnapshot('white.jpg');
    expect(screenshot).toMatchSnapshot('white.jpg');
  });

  it('path option should throw for unsupported mime type', async ({ page }) => {
    const error = await page.screenshot({ path: 'file.txt' }).catch(e => e);
    expect(error.message).toContain('path: unsupported mime type "text/plain"');
  });

  it('quality option should throw for png', async ({ page }) => {
    const error = await page.screenshot({ quality: 10 }).catch(e => e);
    expect(error.message).toContain('options.quality is unsupported for the png');
  });

  it('zero quality option should throw for png', async ({ page }) => {
    const error = await page.screenshot({ quality: 0, type: 'png' }).catch(e => e);
    expect(error.message).toContain('options.quality is unsupported for the png');
  });

  it('should prefer type over extension', async ({ page }, testInfo) => {
    const outputPath = testInfo.outputPath('file.png');
    const buffer = await page.screenshot({ path: outputPath, type: 'jpeg' });
    expect([buffer[0], buffer[1], buffer[2]]).toEqual([0xFF, 0xD8, 0xFF]);
  });

  it('should not issue resize event', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/grid.html');
    let resizeTriggered = false;
    await page.exposeFunction('resize', () => {
      resizeTriggered = true;
    });
    await page.evaluate(() => {
      window.addEventListener('resize', () => (window as any).resize());
    });
    await page.screenshot();
    expect(resizeTriggered).toBeFalsy();
  });

  it('should work with Array deleted', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => delete window.Array);
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchSnapshot('screenshot-grid-fullpage.png');
  });

  it('should take fullPage screenshots during navigation', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const reloadSeveralTimes = async () => {
      for (let i = 0; i < 5; ++i)
        await page.reload();
    };
    const screenshotSeveralTimes = async () => {
      for (let i = 0; i < 5; ++i)
        await page.screenshot({ fullPage: true });
    };
    await Promise.all([
      reloadSeveralTimes(),
      screenshotSeveralTimes()
    ]);
  });
});

async function rafraf(page) {
  // Do a double raf since single raf does not
  // actually guarantee a new animation frame.
  await page.evaluate(() => new Promise(x => {
    requestAnimationFrame(() => requestAnimationFrame(x));
  }));
}

declare global {
  interface Window {
    animation?: Animation;
    _EVENTS?: string[];
  }
}

it.describe('page screenshot animations', () => {
  it('should not capture infinite css animation', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/rotate-z.html');
    const div = page.locator('div');
    const screenshot = await div.screenshot({
      disableAnimations: true,
    });
    for (let i = 0; i < 10; ++i) {
      await rafraf(page);
      const newScreenshot = await div.screenshot({
        disableAnimations: true,
      });
      expect(newScreenshot.equals(screenshot)).toBe(true);
    }
  });

  it('should not capture pseudo element css animation', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/rotate-pseudo.html');
    const div = page.locator('div');
    const screenshot = await div.screenshot({
      disableAnimations: true,
    });
    for (let i = 0; i < 10; ++i) {
      await rafraf(page);
      const newScreenshot = await div.screenshot({
        disableAnimations: true,
      });
      expect(newScreenshot.equals(screenshot)).toBe(true);
    }
  });

  it('should not capture css animations in shadow DOM', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/rotate-z-shadow-dom.html');
    const screenshot = await page.screenshot({
      disableAnimations: true,
    });
    for (let i = 0; i < 4; ++i) {
      await rafraf(page);
      const newScreenshot = await page.screenshot({
        disableAnimations: true,
      });
      expect(newScreenshot.equals(screenshot)).toBe(true);
    }
  });

  it('should stop animations that happen right before screenshot', async ({ page, server, mode }) => {
    it.skip(mode !== 'default');
    await page.goto(server.PREFIX + '/rotate-z.html');
    // Stop rotating bar.
    await page.$eval('div', el => el.style.setProperty('animation', 'none'));
    const buffer1 = await page.screenshot({
      disableAnimations: true,
      // Start rotating bar right before screenshot.
      __testHookBeforeScreenshot: async () => {
        await page.$eval('div', el => el.style.removeProperty('animation'));
      },
    } as any);
    await rafraf(page);
    const buffer2 = await page.screenshot({
      disableAnimations: true,
    });
    expect(buffer1.equals(buffer2)).toBe(true);
  });

  it('should resume infinite animations', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/rotate-z.html');
    await page.screenshot({
      disableAnimations: true,
    });
    const buffer1 = await page.screenshot();
    await rafraf(page);
    const buffer2 = await page.screenshot();
    expect(buffer1.equals(buffer2)).toBe(false);
  });

  it('should not capture infinite web animations', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/web-animation.html');
    const div = page.locator('div');
    const screenshot = await div.screenshot({
      disableAnimations: true,
    });
    for (let i = 0; i < 10; ++i) {
      await rafraf(page);
      const newScreenshot = await div.screenshot({
        disableAnimations: true,
      });
      expect(newScreenshot.equals(screenshot)).toBe(true);
    }
    // Should resume infinite web animation.
    const buffer1 = await page.screenshot();
    await rafraf(page);
    const buffer2 = await page.screenshot();
    expect(buffer1.equals(buffer2)).toBe(false);
  });

  it('should fire transitionend for finite transitions', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/css-transition.html');
    const div = page.locator('div');
    await div.evaluate(el => {
      el.addEventListener('transitionend', () => window['__TRANSITION_END'] = true, false);
    });

    await it.step('make sure transition is actually running', async () => {
      const screenshot1 = await page.screenshot();
      await rafraf(page);
      const screenshot2 = await page.screenshot();
      expect(screenshot1.equals(screenshot2)).toBe(false);
    });

    // Make a screenshot that finishes all finite animations.
    const screenshot1 = await div.screenshot({
      disableAnimations: true,
    });
    await rafraf(page);
    // Make sure finite transition is not restarted.
    const screenshot2 = await div.screenshot();
    expect(screenshot1.equals(screenshot2)).toBe(true);

    expect(await page.evaluate(() => window['__TRANSITION_END'])).toBe(true);
  });

  it('should capture screenshots after layoutchanges in transitionend event', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/css-transition.html');
    const div = page.locator('div');
    await div.evaluate(el => {
      el.addEventListener('transitionend', () => {
        const time = Date.now();
        // Block main thread for 200ms, emulating heavy layout.
        while (Date.now() - time < 200) ;
        const h1 = document.createElement('h1');
        h1.textContent = 'woof-woof';
        document.body.append(h1);
      }, false);
    });

    await it.step('make sure transition is actually running', async () => {
      const screenshot1 = await page.screenshot();
      await rafraf(page);
      const screenshot2 = await page.screenshot();
      expect(screenshot1.equals(screenshot2)).toBe(false);
    });

    // 1. Make a screenshot that finishes all finite animations
    //    and triggers layout.
    const screenshot1 = await page.screenshot({
      disableAnimations: true,
    });

    // 2. Make a second screenshot after h1 is on screen.
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('woof-woof');
    const screenshot2 = await page.screenshot();

    // 3. Make sure both screenshots are equal, meaning that
    //    first screenshot actually was taken after transitionend
    //    changed layout.
    expect(screenshot1.equals(screenshot2)).toBe(true);
  });

  it('should not change animation with playbackRate equal to 0', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/rotate-z.html');
    await page.evaluate(async () => {
      window.animation = document.getAnimations()[0];
      window.animation.updatePlaybackRate(0);
      await window.animation.ready;
      window.animation.currentTime = 500;
    });
    const screenshot1 = await page.screenshot({
      disableAnimations: true,
    });
    await rafraf(page);
    const screenshot2 = await page.screenshot({
      disableAnimations: true,
    });
    expect(screenshot1.equals(screenshot2)).toBe(true);
    expect(await page.evaluate(() => ({
      playbackRate: window.animation.playbackRate,
      currentTime: window.animation.currentTime,
    }))).toEqual({
      playbackRate: 0,
      currentTime: 500,
    });
  });

  it('should trigger particular events for css transitions', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/css-transition.html');
    const div = page.locator('div');
    await div.evaluate(async el => {
      window._EVENTS = [];
      el.addEventListener('transitionend', () => {
        window._EVENTS.push('transitionend');
        console.log('transitionend');
      }, false);
      const animation = el.getAnimations()[0];
      animation.oncancel = () => window._EVENTS.push('oncancel');
      animation.onfinish = () => window._EVENTS.push('onfinish');
      animation.onremove = () => window._EVENTS.push('onremove');
      await animation.ready;
    });
    await Promise.all([
      page.screenshot({ disableAnimations: true }),
      page.waitForEvent('console', msg => msg.text() === 'transitionend'),
    ]);
    expect(await page.evaluate(() => window._EVENTS)).toEqual([
      'onfinish', 'transitionend'
    ]);
  });

  it('should trigger particular events for INfinite css animation', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/rotate-z.html');
    const div = page.locator('div');
    await div.evaluate(async el => {
      window._EVENTS = [];
      el.addEventListener('animationcancel', () => {
        window._EVENTS.push('animationcancel');
        console.log('animationcancel');
      }, false);
      const animation = el.getAnimations()[0];
      animation.oncancel = () => window._EVENTS.push('oncancel');
      animation.onfinish = () => window._EVENTS.push('onfinish');
      animation.onremove = () => window._EVENTS.push('onremove');
      await animation.ready;
    });
    await Promise.all([
      page.screenshot({ disableAnimations: true }),
      page.waitForEvent('console', msg => msg.text() === 'animationcancel'),
    ]);
    expect(await page.evaluate(() => window._EVENTS)).toEqual([
      'oncancel', 'animationcancel'
    ]);
  });

  it('should trigger particular events for finite css animation', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/rotate-z.html');
    const div = page.locator('div');
    await div.evaluate(async el => {
      window._EVENTS = [];
      // Make CSS animation to be finite.
      el.style.setProperty('animation-iteration-count', '1000');
      el.addEventListener('animationend', () => {
        window._EVENTS.push('animationend');
        console.log('animationend');
      }, false);
      const animation = el.getAnimations()[0];
      animation.oncancel = () => window._EVENTS.push('oncancel');
      animation.onfinish = () => window._EVENTS.push('onfinish');
      animation.onremove = () => window._EVENTS.push('onremove');
      await animation.ready;
    });
    // Ensure CSS animation is finite.
    expect(await div.evaluate(async el => Number.isFinite(el.getAnimations()[0].effect.getComputedTiming().endTime))).toBe(true);
    await Promise.all([
      page.screenshot({ disableAnimations: true }),
      page.waitForEvent('console', msg => msg.text() === 'animationend'),
    ]);
    expect(await page.evaluate(() => window._EVENTS)).toEqual([
      'onfinish', 'animationend'
    ]);
  });
});

it('should work for text with default font', async ({ page, headless, browserName, platform }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11177' });
  it.fixme(browserName === 'firefox', 'Text is misaligned in headed vs headless');
  it.fixme(platform === 'win32', 'Update expectations on Windows');
  it.fixme(platform === 'linux' && !headless, 'Headful only passes under xvfb');
  const genericFontFamilies = [
    'standard',
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'emoji'
  ];
  for (const family of genericFontFamilies) {
    await page.setContent(`<div style="font: 15px bold ${family === 'standard' ? '' : family}; max-width: 300px; max-height: 300px; overflow: hidden">
      Lorem ipsum dolor sit amet consectetur adipiscing elit proin, integer curabitur imperdiet rhoncus cursus tincidunt bibendum, consequat sed magnis laoreet luctus mollis tellus. Nisl parturient mus accumsan feugiat sem laoreet magnis nisi, aptent per sollicitudin gravida orci ac blandit, viverra eros praesent auctor vivamus semper bibendum. Consequat sed habitasse luctus dictumst gravida platea semper phasellus, nascetur ridiculus purus est varius quisque et scelerisque, id vehicula eleifend montes sollicitudin dis velit. Pellentesque ridiculus per natoque et eleifend taciti nunc, laoreet auctor at condimentum imperdiet ante, conubia mi cubilia scelerisque sociosqu sem.</p> <p>Curabitur magna per felis primis mauris non dapibus luctus ultricies eros, quis et egestas condimentum lobortis eget semper montes litora purus, ridiculus elementum sollicitudin imperdiet dictum lacinia parturient cras eu. Risus cum varius rhoncus eros torquent pretium taciti id erat dis egestas, nibh tristique montes convallis metus lacus phasellus blandit ut auctor bibendum semper, facilisis mi integer eget ultrices lobortis odio viverra duis dui. Risus ullamcorper lacinia in venenatis sodales fusce tortor potenti volutpat quis, dictum vulputate suspendisse velit mollis torquent sociis aptent morbi, senectus nascetur justo maecenas conubia magnis viverra gravida fames. Phasellus sed nec gravida nibh class augue lectus, blandit quis turpis orci diam nam pellentesque, ultricies metus imperdiet hendrerit lacinia lacus.</p> <p>Inceptos facilisi montes cum hendrerit, pulvinar ut tellus eget velit, arcu nulla aenean. Phasellus augue urna nostra molestie interdum vehicula, posuere fames cum euismod massa curabitur donec, inceptos cubilia tellus facilisis fermentum. Lacus laoreet facilisis ultrices cursus quisque at ad porta vestibulum massa inceptos, curae class aliquet maecenas cum ullamcorper pulvinar erat mus vitae. Cum in aenean convallis dis quam tincidunt justo sed quisque, imperdiet faucibus hendrerit felis commodo scelerisque magnis vehicula etiam leo, eros varius platea lobortis maecenas condimentum nisi phasellus. Turpis vulputate mus himenaeos sociosqu facilisis dignissim leo quam, ultricies habitasse commodo molestie est tortor vitae et, porttitor risus erat cursus phasellus facilisi litora.</p> <p>Nostra habitasse egestas magnis velit pellentesque parturient cum lectus viverra, vestibulum sociosqu nunc vel urna consequat lacinia phasellus at sapien, aenean pretium dictum sed montes interdum imperdiet iaculis. Leo hac eros arcu senectus maecenas, tortor pulvinar venenatis lacinia volutpat, mattis platea ut facilisi. Aenean condimentum at et donec sociosqu fermentum luctus potenti semper vulputate, sapien justo non est auctor gravida ultricies fames per commodo, sed habitasse facilisi nulla quisque hendrerit aliquet viverra bibendum.</p> <p>Interdum nisl quam etiam montes porttitor laoreet nullam senectus velit, mauris proin tellus imperdiet litora venenatis fames massa quis, sollicitudin justo vivamus curae in sociis suscipit facilisi. Platea inceptos lacus elementum pellentesque quam euismod dictumst sociis tincidunt vulputate porttitor eros, turpis netus ut ad tempor sapien aliquet sodales molestie consequat nostra. Cum augue in quisque primis ut nunc sodales, sem orci tempus posuere cubilia suspendisse lacinia ligula, magna sed ridiculus at maecenas habitant.</p> <p>Natoque magna ac feugiat tellus bibendum diam, metus lobortis nisl ornare varius praesent, dictumst gravida lacus parturient semper. Pellentesque faucibus congue fusce posuere placerat dictum vitae, dui vestibulum eu sociis tempus aliquam ultricies malesuada, potenti laoreet lacus sem gravida nisi. Nostra platea sagittis hendrerit congue conubia senectus bibendum quis sapien pharetra, scelerisque nam imperdiet fermentum feugiat suspendisse viverra luctus at, semper ac consequat vitae mi gravida parturient mollis nascetur. Vel taciti justo consequat primis et blandit convallis sed, felis purus fusce a venenatis etiam aenean scelerisque, fringilla volutpat sagittis egestas rutrum id dis.</p> <p>Feugiat fermentum tortor ante ac iaculis sollicitudin ut interdum, cras orci ullamcorper potenti tristique vehicula. Molestie tortor ullamcorper rutrum turpis malesuada phasellus sem ultricies praesent mattis lobortis porta, senectus venenatis diam nostra laoreet volutpat per aptent justo elementum cum. Urna cursus vel felis cras eleifend arcu enim magnis, duis rutrum nibh nascetur cubilia interdum ultrices curae, id lacus aliquam dictumst diam fringilla lacinia.</p> <p>Luctus diam morbi eget tellus libero taciti faucibus inceptos, natoque facilisis lectus maecenas risus dapibus suscipit nibh, vel curae conubia orci imperdiet metus fusce. Condimentum massa donec luctus pharetra cum, in viverra placerat nisl litora facilisis, neque nascetur sociis dictumst. Suscipit accumsan eget rhoncus pharetra justo malesuada aliquet, suspendisse metus eleifend tincidunt varius ridiculus, convallis primis vitae curabitur quis mus.</p> <p>Gravida donec lacus molestie tortor aenean ultricies blandit per tempor, nostra penatibus orci vestibulum semper lectus vel a, montes potenti cum dapibus natoque eu volutpat nulla. Himenaeos purus nam malesuada habitasse nisl pharetra laoreet feugiat mi non, ultrices ultricies a cras ante eu venenatis ligula. Suscipit ut mus habitasse at aliquet sodales commodo justo, feugiat platea sagittis phasellus eleifend pellentesque interdum iaculis, integer cubilia montes metus hendrerit tincidunt purus.</p> <p>Vel posuere tellus dapibus eget duis cubilia, nec class vehicula libero gravida ligula, tempus urna taciti donec congue. Facilisis ridiculus congue cum dui per augue natoque, molestie hac etiam pellentesque dignissim urna class, feugiat aenean massa himenaeos penatibus ut eu, convallis purus et fusce tempus mattis. At mattis suscipit porta nostra nec facilisis sodales turpis, integer et lectus conubia justo nam congue taciti odio, fermentum semper cubilia fusce nunc purus velit.
      <div/>
    `);
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot(`screenshot-font-${family}-${os.platform}.png`, { threshold: 0.01 });
  }
});
