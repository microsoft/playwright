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

import { browserTest as it, expect } from '../config/browserTest';

it.describe('device', () => {
  it.skip(({ browserName }) => browserName === 'firefox');

  it('should work @smoke', async ({ playwright, browser, server }) => {
    const iPhone = playwright.devices['iPhone 6'];
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
    await context.close();
  });

  it('should support clicking', async ({ playwright, browser, server }) => {
    const iPhone = playwright.devices['iPhone 6'];
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await page.evaluate(button => button!.style.marginTop = '200px', button);
    await button!.click();
    expect(await page.evaluate('result')).toBe('Clicked');
    await context.close();
  });

  it('should scroll to click', async ({ browser, server }) => {
    const context = await browser.newContext({
      viewport: {
        width: 400,
        height: 400,
      },
      deviceScaleFactor: 1,
      isMobile: true
    });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/scrollable.html');
    const element = await page.$('#button-91');
    await element!.click();
    expect(await element!.textContent()).toBe('clicked');
    await context.close();
  });

  it('should scroll twice when emulated', async ({ contextFactory, playwright }) => {
    const device = playwright.devices['iPhone 6'];
    const context = await contextFactory(device);
    const page = await context.newPage();
    await page.setContent(`
          <meta name="viewport" content="width=device-width, user-scalable=no" />
          Lorem ipsum dolor sit amet consectetur adipiscing elit proin, integer curabitur imperdiet rhoncus cursus tincidunt bibendum, consequat sed magnis laoreet luctus mollis tellus. Nisl parturient mus accumsan feugiat sem laoreet magnis nisi, aptent per sollicitudin gravida orci ac blandit, viverra eros praesent auctor vivamus semper bibendum. Consequat sed habitasse luctus dictumst gravida platea semper phasellus, nascetur ridiculus purus est varius quisque et scelerisque, id vehicula eleifend montes sollicitudin dis velit. Pellentesque ridiculus per natoque et eleifend taciti nunc, laoreet auctor at condimentum imperdiet ante, conubia mi cubilia scelerisque sociosqu sem.</p> <p>Curabitur magna per felis primis mauris non dapibus luctus ultricies eros, quis et egestas condimentum lobortis eget semper montes litora purus, ridiculus elementum sollicitudin imperdiet dictum lacinia parturient cras eu. Risus cum varius rhoncus eros torquent pretium taciti id erat dis egestas, nibh tristique montes convallis metus lacus phasellus blandit ut auctor bibendum semper, facilisis mi integer eget ultrices lobortis odio viverra duis dui. Risus ullamcorper lacinia in venenatis sodales fusce tortor potenti volutpat quis, dictum vulputate suspendisse velit mollis torquent sociis aptent morbi, senectus nascetur justo maecenas conubia magnis viverra gravida fames. Phasellus sed nec gravida nibh class augue lectus, blandit quis turpis orci diam nam pellentesque, ultricies metus imperdiet hendrerit lacinia lacus.</p> <p>Inceptos facilisi montes cum hendrerit, pulvinar ut tellus eget velit, arcu nulla aenean. Phasellus augue urna nostra molestie interdum vehicula, posuere fames cum euismod massa curabitur donec, inceptos cubilia tellus facilisis fermentum. Lacus laoreet facilisis ultrices cursus quisque at ad porta vestibulum massa inceptos, curae class aliquet maecenas cum ullamcorper pulvinar erat mus vitae. Cum in aenean convallis dis quam tincidunt justo sed quisque, imperdiet faucibus hendrerit felis commodo scelerisque magnis vehicula etiam leo, eros varius platea lobortis maecenas condimentum nisi phasellus. Turpis vulputate mus himenaeos sociosqu facilisis dignissim leo quam, ultricies habitasse commodo molestie est tortor vitae et, porttitor risus erat cursus phasellus facilisi litora.</p> <p>Nostra habitasse egestas magnis velit pellentesque parturient cum lectus viverra, vestibulum sociosqu nunc vel urna consequat lacinia phasellus at sapien, aenean pretium dictum sed montes interdum imperdiet iaculis. Leo hac eros arcu senectus maecenas, tortor pulvinar venenatis lacinia volutpat, mattis platea ut facilisi. Aenean condimentum at et donec sociosqu fermentum luctus potenti semper vulputate, sapien justo non est auctor gravida ultricies fames per commodo, sed habitasse facilisi nulla quisque hendrerit aliquet viverra bibendum.</p> <p>Interdum nisl quam etiam montes porttitor laoreet nullam senectus velit, mauris proin tellus imperdiet litora venenatis fames massa quis, sollicitudin justo vivamus curae in sociis suscipit facilisi. Platea inceptos lacus elementum pellentesque quam euismod dictumst sociis tincidunt vulputate porttitor eros, turpis netus ut ad tempor sapien aliquet sodales molestie consequat nostra. Cum augue in quisque primis ut nunc sodales, sem orci tempus posuere cubilia suspendisse lacinia ligula, magna sed ridiculus at maecenas habitant.</p> <p>Natoque magna ac feugiat tellus bibendum diam, metus lobortis nisl ornare varius praesent, dictumst gravida lacus parturient semper. Pellentesque faucibus congue fusce posuere placerat dictum vitae, dui vestibulum eu sociis tempus aliquam ultricies malesuada, potenti laoreet lacus sem gravida nisi. Nostra platea sagittis hendrerit congue conubia senectus bibendum quis sapien pharetra, scelerisque nam imperdiet fermentum feugiat suspendisse viverra luctus at, semper ac consequat vitae mi gravida parturient mollis nascetur. Vel taciti justo consequat primis et blandit convallis sed, felis purus fusce a venenatis etiam aenean scelerisque, fringilla volutpat sagittis egestas rutrum id dis.</p> <p>Feugiat fermentum tortor ante ac iaculis sollicitudin ut interdum, cras orci ullamcorper potenti tristique vehicula. Molestie tortor ullamcorper rutrum turpis malesuada phasellus sem ultricies praesent mattis lobortis porta, senectus venenatis diam nostra laoreet volutpat per aptent justo elementum cum. Urna cursus vel felis cras eleifend arcu enim magnis, duis rutrum nibh nascetur cubilia interdum ultrices curae, id lacus aliquam dictumst diam fringilla lacinia.</p> <p>Luctus diam morbi eget tellus libero taciti faucibus inceptos, natoque facilisis lectus maecenas risus dapibus suscipit nibh, vel curae conubia orci imperdiet metus fusce. Condimentum massa donec luctus pharetra cum, in viverra placerat nisl litora facilisis, neque nascetur sociis dictumst. Suscipit accumsan eget rhoncus pharetra justo malesuada aliquet, suspendisse metus eleifend tincidunt varius ridiculus, convallis primis vitae curabitur quis mus.</p> <p>Gravida donec lacus molestie tortor aenean ultricies blandit per tempor, nostra penatibus orci vestibulum semper lectus vel a, montes potenti cum dapibus natoque eu volutpat nulla. Himenaeos purus nam malesuada habitasse nisl pharetra laoreet feugiat mi non, ultrices ultricies a cras ante eu venenatis ligula. Suscipit ut mus habitasse at aliquet sodales commodo justo, feugiat platea sagittis phasellus eleifend pellentesque interdum iaculis, integer cubilia montes metus hendrerit tincidunt purus.</p> <p>Vel posuere tellus dapibus eget duis cubilia, nec class vehicula libero gravida ligula, tempus urna taciti donec congue. Facilisis ridiculus congue cum dui per augue natoque, molestie hac etiam pellentesque dignissim urna class, feugiat aenean massa himenaeos penatibus ut eu, convallis purus et fusce tempus mattis. At mattis suscipit porta nostra nec facilisis sodales turpis, integer et lectus conubia justo nam congue taciti odio, fermentum semper cubilia fusce nunc purus velit.
          <button>hi</button>
  `);
    await page.evaluate(() => window.scroll(0, 100));
    expect(await page.evaluate(() => window.scrollY)).toBe(100);

    await page.evaluate(() => window.scroll(0, 200));
    expect(await page.evaluate(() => window.scrollY)).toBe(200);

    await context.close();
  });

  it('should reset scroll top after a navigation', async ({ server, contextFactory, playwright, browserName }) => {
    it.skip(browserName === 'webkit');

    const device = playwright.devices['iPhone 6'];
    const context = await contextFactory(device);
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/scrollable.html');
    await page.evaluate(() => window.scroll(0, 100));

    await page.goto(server.PREFIX + '/input/scrollable2.html');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await context.close();
  });

  it('should scroll to a precise position with mobile scale', async ({ server, contextFactory, playwright, browserName }) => {
    it.skip(browserName === 'webkit');

    const device = playwright.devices['iPhone 6'];
    const context = await contextFactory(device);
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/scrollable.html');
    expect(await page.evaluate(() => document.body.scrollHeight)).toBeGreaterThan(1000);
    await page.evaluate(() => window.scroll(0, 100));
    expect(await page.evaluate(() => window.scrollY)).toBe(100);
    await context.close();
  });

  it('should emulate viewport and screen size', async ({ contextFactory, playwright }) => {
    const device = playwright.devices['iPhone 12'];
    const context = await contextFactory(device);
    const page = await context.newPage();
    await page.setContent(`<meta name="viewport" content="width=device-width, user-scalable=no" />`);

    expect(await page.evaluate(() => ({
      width: window.screen.width,
      height: window.screen.height
    }))).toEqual({ width: 390, height: 844 });

    expect(await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }))).toEqual({ width: 390, height: 664 });

    await context.close();
  });

  it('should emulate viewport without screen size', async ({ contextFactory, playwright }) => {
    const device = playwright.devices['iPhone 6'];
    const context = await contextFactory(device);
    const page = await context.newPage();
    await page.setContent(`<meta name="viewport" content="width=device-width, user-scalable=no" />`);

    expect(await page.evaluate(() => ({
      width: window.screen.width,
      height: window.screen.height
    }))).toEqual({ width: 375, height: 667 });

    expect(await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }))).toEqual({ width: 375, height: 667 });

    await context.close();
  });
});
