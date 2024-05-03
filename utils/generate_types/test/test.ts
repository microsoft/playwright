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

import * as playwright from 'playwright';

type AssertType<T, S> = S extends T ? AssertNotAny<S> : false;
type AssertNotAny<S> = {notRealProperty: number} extends S ? false : true;

// Examples taken from README
(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'example.png' });

  await browser.close();
})();

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://news.ycombinator.com', { waitUntil: 'networkidle' });
  await page.pdf({ path: 'hn.pdf', format: 'A4' });

  await browser.close();
})();

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');

  // Get the "viewport" of the page, as reported by the page.
  const dimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      deviceScaleFactor: window.devicePixelRatio
    };
  });

  console.log('Dimensions:', dimensions);

  await browser.close();
})();

// The following examples are taken from the docs itself
playwright.chromium.launch().then(async browser => {
  const page = await browser.newPage();
  page.on('console', message => {
    console.log(message.text());
  });
  await page.evaluate(() => console.log(5, 'hello', { foo: 'bar' }));

  {
    const result = await page.evaluate(() => {
      return Promise.resolve(8 * 7);
    });
    const assertion: AssertType<number, typeof result> = true;
    console.log(await page.evaluate('1 + 2'));
    page.$eval('.foo', e => e.style);
  }

  const bodyHandle = await page.$('body');
  if (!bodyHandle)
    return;
  {
    const html = await page.evaluate(
        (body: HTMLElement) => body.innerHTML,
        bodyHandle
    );
    const assertion: AssertType<string, typeof html> = true;
  }
});

import * as crypto from 'crypto';
import * as fs from 'fs';
import { EventEmitter } from 'events';

playwright.chromium.launch().then(async browser => {
  const page = await browser.newPage();
  page.on('console', console.log);
  await page.exposeFunction('md5', (text: string) =>
    crypto
        .createHash('md5')
        .update(text)
        .digest('hex')
  );
  await page.evaluate(async () => {
    // use window.md5 to compute hashes
    const myString = 'PUPPETEER';
    const myHash = await (window as any).md5(myString);
    console.log(`md5 of ${myString} is ${myHash}`);
  });
  await browser.close();

  page.on('console', console.log);
  await page.exposeFunction('readfile', async (filePath: string) => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, text) => {
        if (err) reject(err);
        else resolve(text);
      });
    });
  });
  await page.evaluate(async () => {
    // use window.readfile to read contents of a file
    const content = await (window as any).readfile('/etc/hosts');
    console.log(content);
  });

  await page.exposeBinding('clicked', async (source, handle) => {
    await handle.asElement()!.textContent();
    await source.page.goto('http://example.com');
  }, { handle: true });

  await page.emulateMedia({media: 'screen'});
  await page.pdf({ path: 'page.pdf' });

  await page.route('**/*', (route, interceptedRequest) => {
    if (
      interceptedRequest.url().endsWith('.png') ||
      interceptedRequest.url().endsWith('.jpg')
    )
      route.abort();
    else route.continue();
  });

  await page.route('**/*', route => route.continue());

  await page.route(str => {
    return true;
  }, (route, request) => {
    const {referer} = request.headers();
    const isString: AssertType<string, typeof referer> = true;
    route.continue({
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
    return 'something random for no reason';
  });

  await page.addLocatorHandler(page.locator(''), async () => { });
  await page.addLocatorHandler(page.locator(''), async () => 42);
  await page.addLocatorHandler(page.locator(''), () => Promise.resolve(42));

  await page.keyboard.type('Hello'); // Types instantly
  await page.keyboard.type('World', { delay: 100 }); // Types slower, like a user

  const watchDog = page.waitForFunction('window.innerWidth < 100');
  page.setViewportSize({ width: 50, height: 50 });
  await watchDog;

  let currentURL: string;
  page
      .waitForSelector('img')
      .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of [
    'https://example.com',
    'https://google.com',
    'https://bbc.com'
  ])
    await page.goto(currentURL);


  page.keyboard.type('Hello World!');
  page.keyboard.press('ArrowLeft');

  page.keyboard.down('Shift');
  // tslint:disable-next-line prefer-for-of
  for (let i = 0; i < ' World'.length; i++)
    page.keyboard.press('ArrowLeft');

  page.keyboard.up('Shift');
  page.keyboard.press('Backspace');
  page.keyboard.insertText('嗨');
  await browser.startTracing(page, { path: 'trace.json'});
  await page.goto('https://www.google.com');
  await browser.stopTracing();

  page.on('dialog', async dialog => {
    console.log(dialog.message());
    await dialog.dismiss();
    await browser.close();
  });

  const inputElement = (await page.$('input[type=submit]'))!;
  await inputElement.click();

  await inputElement.setInputFiles([{
    name: 'yo',
    mimeType: 'text/plain',
    buffer: Buffer.from('yo')
  }])
});

// Example with launch options
(async () => {
  const browser = await playwright.chromium.launch({
    chromiumSandbox: false,
    handleSIGINT: true,
    handleSIGHUP: true,
    handleSIGTERM: true,
  });
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'example.png' });

  await browser.close();
})();

// Test v0.12 features
(async () => {
  const launchOptions: playwright.LaunchOptions = {
    devtools: true,
    env: {
      TIMEOUT: 52,
      SOMETHING: '/some/path',
      JEST_TEST: true
    }
  };
  const browser = await playwright.chromium.launch(launchOptions);
  const viewport: playwright.ViewportSize = {
    width: 100,
    height: 200,
  };
  const geolocation: playwright.Geolocation = {
    latitude: 0,
    longitude: 0,
    accuracy: undefined,
  };
  const httpCredentials: playwright.HTTPCredentials = {
    username: 'foo',
    password: 'bar',
  };
  const contextOptions: playwright.BrowserContextOptions = {
    viewport,
    geolocation,
    httpCredentials,
  };
  const page = await browser.newPage(contextOptions);
  const button = (await page.$('#myButton'))!;
  const div = (await page.$('#myDiv'))!;
  const input = (await page.$('#myInput'))!;

  if (!button)
    throw new Error('Unable to select myButton');

  if (!input)
    throw new Error('Unable to select myInput');

  await page.addStyleTag({
    url: 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css'
  });

  console.log(page.url());

  page.type('#myInput', 'Hello World!');

  page.on('console', (event: playwright.ConsoleMessage, ...args: any[]) => {
    console.log(event.text, event.type);
    for (let i = 0; i < args.length; ++i) console.log(`${i}: ${args[i]}`);
  });

  await button.focus();
  await button.press('Enter');
  await button.screenshot({
    type: 'jpeg',
    omitBackground: true
  });
  console.log(button.toString());
  input.type('Hello World', { delay: 10 });

  const buttonText = await (await button.getProperty('textContent')).jsonValue();
  await page.context().clearCookies();

  const cookies: playwright.Cookie[] = await page.context().cookies(['http://example.com']);
  const cookie = cookies[0];
  const nameIsString: AssertType<string, typeof cookie.name> = true;
  const valueIsString: AssertType<string, typeof cookie.value> = true;
  const pathIsString: AssertType<string, typeof cookie.path> = true;
  const expiresIsNumber: AssertType<number, typeof cookie.expires> = true;
  const httpOnlyIsBoolean: AssertType<boolean, typeof cookie.httpOnly> = true;
  const secureIsBoolean: AssertType<boolean, typeof cookie.secure> = true;
  const sameSiteIsEnum: AssertType<"Strict"|"Lax"|"None", typeof cookie.sameSite> = true;

  const navResponse = await page.waitForNavigation({
    timeout: 1000
  });
  console.log(navResponse!.ok, navResponse!.status, navResponse!.url, navResponse!.headers);

  // evaluate example
  const bodyHandle = (await page.$('body'))!;
  const html = await page.evaluate((body: HTMLBodyElement) => body.innerHTML, bodyHandle);
  await bodyHandle.dispose();

  // getProperties example
  const handle = await page.evaluateHandle(() => ({ window, document }));
  const properties = await handle.getProperties();
  const windowHandle = properties.get('window');
  const documentHandle = properties.get('document');
  await handle.dispose();

  // evaluateHandle example
  const aHandle = await page.evaluateHandle(() => document.body);
  const resultHandle = await page.evaluateHandle((body: Element) => body.innerHTML, aHandle);
  console.log(await resultHandle.jsonValue());
  await resultHandle.dispose();

  // evaluateHandle with two different return types (JSHandle)
  {
    const handle = await page.evaluateHandle(() => '' as string | number);
    const result = await handle.evaluate(value => value);
    const assertion: AssertType<string | number, typeof result> = true;
  }
  // evaluateHandle with two different return types (ElementHandle)
  {
    const handle = await page.evaluateHandle(() => '' as any as HTMLInputElement | HTMLTextAreaElement);
    await handle.evaluate(element => element.value);
    const assertion: AssertType<playwright.ElementHandle<HTMLInputElement | HTMLTextAreaElement>, typeof handle> = true;
  }


  await browser.close();
})();

// test $eval and $$eval
(async () => {
  const browser = await playwright.firefox.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.$eval('#someElement', (element, text: string) => {
    return element.innerHTML = text;
  }, 'hey');

  const elementText = await page.$$eval('.someClassName', elements => {
    console.log(elements.length);
    console.log(elements.map(x => x)[0].textContent);
    return elements[3].innerHTML;
  });
  const frame = page.frames()[0];
  const handle = await page.evaluateHandle(() => document.body);
  for (const object of [frame, handle, page]) {
    {
      const value = await object.$eval('*[foo=bar]', i => i.textContent);
      const assertion: AssertType<string, typeof value> = true;
    }
    {
      const value = await object.$eval('input', i => i.disabled);
      const assertion: AssertType<boolean, typeof value> = true;
    }
    {
      const value = await object.$eval('input[foo=bar]', (i: HTMLInputElement) => i.disabled);
      const assertion: AssertType<boolean, typeof value> = true;
    }
    {
      const value = await object.$eval('*[foo=bar]', (i, dummy) => i.textContent, 2);
      const assertion: AssertType<string, typeof value> = true;
    }
    {
      const value = await object.$eval('input', (i, dummy) => i.disabled, 2);
      const assertion: AssertType<boolean, typeof value> = true;
    }
    {
      const value = await object.$eval('input[foo=bar]', (i: HTMLInputElement, dummy: number) => i.disabled, 2);
      const assertion: AssertType<boolean, typeof value> = true;
    }
    {
      const value = await object.$$eval('*[foo=bar]', i => i[0].textContent);
      const assertion: AssertType<string, typeof value> = true;
    }
    {
      const value = await object.$$eval('input', i => i[0].defaultValue);
      const assertion: AssertType<string, typeof value> = true;
    }
    {
      const value = await object.$$eval('input[foo=bar]', (i: HTMLInputElement[]) => i[0].defaultValue);
      const assertion: AssertType<string, typeof value> = true;
    }
    {
      const value = await object.$$eval('*[foo=bar]', (i, dummy) => i[0].textContent, 2);
      const assertion: AssertType<string, typeof value> = true;
    }
    {
      const value = await object.$$eval('input', (i, dummy) => i[0].defaultValue, 2);
      const assertion: AssertType<string, typeof value> = true;
    }
    {
      const value = await object.$$eval('input[foo=bar]', (i: HTMLInputElement[], dummy: number) => i[0].defaultValue, 2);
      const assertion: AssertType<string, typeof value> = true;
    }
  }
  await browser.close();
})();

// test locator.evaluate
(async () => {
  const browser = await playwright.firefox.launch();
  const page = await browser.newPage();
  const locator = page.locator('.foo');
  {
    const result = await locator.evaluate((sel: HTMLSelectElement) => sel.options[sel.selectedIndex].textContent)
    const assertion: AssertType<string, typeof result> = true;
  }
  {
    const result = await locator.evaluate((media: HTMLMediaElement, dummy) => media.duration, 10);
    const assertion: AssertType<number, typeof result> = true;
  }
  {
    await locator.evaluate((input: HTMLInputElement) => {})
  }
  {
    const list = await locator.evaluateAll((i: HTMLInputElement[]) => i.length);
    const assertion: AssertType<number, typeof list> = true;
  }
  {
    const list = await locator.evaluateAll((i: HTMLInputElement[], dummy) => i.length, 10);
    const assertion: AssertType<number, typeof list> = true;
  }
  {
    await locator.evaluateAll((sel: HTMLSelectElement[]) => {})
  }
  await browser.close();
})();

// waitForEvent
(async () => {
  const browser = await playwright.webkit.launch();
  const page = await browser.newPage();
  {
    const frame = await page.waitForEvent('frameattached');
    const assertion: AssertType<playwright.Frame, typeof frame> = true;
  }
  {
    const worker = await page.waitForEvent('worker', {
      predicate: worker => {
        const condition: AssertType<playwright.Worker, typeof worker> = true;
        return true;
      }
    });
    const assertion: AssertType<playwright.Worker, typeof worker> = true;
  }
  {
    const newPage = await page.context().waitForEvent('page', {
      timeout: 500
    });
    const assertion: AssertType<playwright.Page, typeof newPage> = true;
  }
  {
    const response = await page.waitForEvent('response', response => response.url() === 'asdf');
    const assertion: AssertType<playwright.Response, typeof response> = true;
  }
})();

// typed handles
(async () => {
  const browser = await playwright.webkit.launch();
  const page = await browser.newPage();
  const windowHandle = await page.evaluateHandle(() => window);

  function wrap<T>(t: T): [T, string, boolean, number] {
    return [t, '1', true, 1];
  }

  {
    const value = await page.evaluate(() => 1);
    const assertion: AssertType<number, typeof value> = true;
  }
  {
    const value = await page.mainFrame().evaluate(() => 'hello');
    const assertion: AssertType<string, typeof value> = true;
  }
  {
    const value = await page.workers()[0].evaluate(() => [1,2,3]);
    const assertion: AssertType<number[], typeof value> = true;
  }
  {
    const value = await windowHandle.evaluate((x: Window, b) => b, 'world');
    const assertion: AssertType<string, typeof value> = true;
  }
  {
    const value = await page.evaluate(({a, b}) => b ? a : '123', { a: 3, b: true });
    const assertion: AssertType<number | string, typeof value> = true;
  }
  {
    const value = await page.evaluate(([a, b, c]) => ({a, b, c}), [3, '123', true]);
    const assertion: AssertType<{a: string | number | boolean, b: string | number | boolean, c: string | number | boolean}, typeof value> = true;
  }
  {
    const value = await page.evaluate(([a, b, c]) => ({a, b, c}), [3, '123', true] as const);
    const assertion: AssertType<{a: 3, b: '123', c: true}, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => 3);
    const value = await page.evaluate(([a, b, c, d]) => ({a, b, c, d}), wrap(handle));
    const assertion: AssertType<{a: number, b: string, c: boolean, d: number}, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => 3);
    const h = await page.evaluateHandle(([a, b, c, d]) => ({a, b, c, d}), wrap(handle));
    const value = await h.evaluate(h => h);
    const assertion: AssertType<{a: number, b: string, c: boolean, d: number}, typeof value> = true;
  }

  {
    const handle = await page.locator('body').evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluate(h => h[1].a);
    const assertion: AssertType<string, typeof value> = true;
  }
  {
    const handle = await page.locator('body').evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluate((h, p) => ({ a: h[1].a, p}), 123);
    const assertion: AssertType<{a: string, p: number}, typeof value> = true;
  }
  {
    const handle = await page.locator('body').evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluate((h: ({a: string, b: number})[]) => h[1].b);
    const assertion: AssertType<number, typeof value> = true;
  }
  {
    const handle = await page.locator('body').evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluate((h: ({a: string, b: number})[], prop) => h[1][prop], 'b' as const);
    const assertion: AssertType<number, typeof value> = true;
  }
  {
    const handle = await page.locator('body').evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluateHandle(h => h[1].a);
    const assertion: AssertType<playwright.JSHandle<string>, typeof value> = true;
  }
  {
    const handle = await page.locator('body').evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluateHandle((h, p) => ({ a: h[1].a, p}), 123);
    const assertion: AssertType<playwright.JSHandle<{a: string, p: number}>, typeof value> = true;
  }
  {
    const handle = await page.locator('body').evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluateHandle((h: ({a: string, b: number})[]) => h[1].b);
    const assertion: AssertType<playwright.JSHandle<number>, typeof value> = true;
  }
  {
    const handle = await page.locator('body').evaluateHandle(e => {
      const assertion1: AssertType<HTMLElement, typeof e> = true;
      const assertion2: AssertType<SVGElement, typeof e> = true;
      return e.nodeName;
    });
    const value = await handle.evaluate(e => e);
    const assertion: AssertType<string, typeof value> = true;
  }{
    const handle = await page.locator('body').evaluateHandle(() => 3);
    const value = await page.evaluate(([a, b, c, d]) => ({a, b, c, d}), wrap(handle));
    const assertion: AssertType<{a: number, b: string, c: boolean, d: number}, typeof value> = true;
  }
  {
    const handle = await page.locator('body').evaluateHandle(() => 3);
    const h = await page.locator('body').evaluateHandle((_, [a, b, c, d]) => ({a, b, c, d}), wrap(handle));
    const value = await h.evaluate(h => h);
    const assertion: AssertType<{a: number, b: string, c: boolean, d: number}, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluate(h => h[1].a);
    const assertion: AssertType<string, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluate((h, p) => ({ a: h[1].a, p}), 123);
    const assertion: AssertType<{a: string, p: number}, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluate((h: ({a: string, b: number})[]) => h[1].b);
    const assertion: AssertType<number, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluate((h: ({a: string, b: number})[], prop) => h[1][prop], 'b' as const);
    const assertion: AssertType<number, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluateHandle(h => h[1].a);
    const assertion: AssertType<playwright.JSHandle<string>, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluateHandle((h, p) => ({ a: h[1].a, p}), 123);
    const assertion: AssertType<playwright.JSHandle<{a: string, p: number}>, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => ([{a: '123'}]));
    const value = await handle.evaluateHandle((h: ({a: string, b: number})[]) => h[1].b);
    const assertion: AssertType<playwright.JSHandle<number>, typeof value> = true;
  }
  {
    const handle = await page.waitForSelector('*');
    const value = await handle.evaluate((e: HTMLInputElement) => e.disabled);
    const assertion: AssertType<boolean, typeof value> = true;
  }
  {
    const handle = await page.waitForSelector('*');
    const value = await handle.evaluate((e: HTMLInputElement, x) => e.disabled || x, 123);
    const assertion: AssertType<boolean | number, typeof value> = true;
  }
  {
    const handle = await page.waitForSelector('*');
    const value = await handle.evaluateHandle((e: HTMLInputElement, x) => e.disabled || x, 123);
    const assertion: AssertType<playwright.JSHandle<boolean | number>, typeof value> = true;
  }

  {
    const handle = await page.evaluateHandle(() => 'hello');
    const value = await handle.jsonValue();
    const assertion: AssertType<string, typeof value> = true;
  }
  {
    const handle = await page.mainFrame().evaluateHandle(() => ['a', 'b', 'c']);
    const value = await handle.jsonValue();
    const assertion: AssertType<string[], typeof value> = true;
  }
  {
    const handle = await page.workers()[0].evaluateHandle(() => 123);
    const value = await handle.jsonValue();
    const assertion: AssertType<number, typeof value> = true;
  }
  {
    const handle = await windowHandle.evaluateHandle((x: Window, b) => b, 123);
    const value = await handle.jsonValue();
    const assertion: AssertType<number, typeof value> = true;
  }
  {
    const handle = await page.evaluateHandle(() => document.body);
    const tuple = { s: '', n: 23, h: handle };
    const value = await page.evaluate(([{ s, n, h }]) => {
      return parseInt(s) + n + parseInt(h.nodeName);
    }, [tuple]);
    const assertion: AssertType<number, typeof value> = true;
  }
  {
    type T = ({ s: string } | playwright.ElementHandle)[];
    const handle = await page.evaluateHandle(() => document.body);
    const tuple: T = [{ s: '' }, handle];
    const value = await page.evaluate(([a, b]) => {
      return (a instanceof Node ? a.nodeName : a.s) + (b instanceof Node ? b.nodeName : b.s);
    }, tuple);
    const assertion: AssertType<string, typeof value> = true;
  }

  {
    const handle = await page.evaluateHandle(() => document.createElement('body'));
    const assertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
    await handle.evaluate(body => {
      const assertion: AssertType<HTMLBodyElement, typeof body> = true;
    });
  }

  {
    await page.addInitScript((args) => {
      args.foo === args.hello.world
    }, {
      foo: 'bar',
      hello: {
        world: 'bar'
      }
    });
  }

  await browser.close();
})();

// protocol
(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const session = await context.newCDPSession(await context.newPage());


  session.on('Runtime.executionContextCreated', payload => {
    const id = payload.context.id;
    const assertion: AssertType<number, typeof id> = true;
  });

  const obj = await session.send('Runtime.evaluate', {
    expression: '1 + 1'
  });
  const type = obj.result.type;
  const assertion: AssertType<string, typeof type> = true;
  await session.detach();


  await browser.close();
})();

// $eval

(async () => {
  const browser = await playwright.webkit.launch();
  const page = await browser.newPage();
  await page.$eval('span', (element, x) => {
    const spanAssertion: AssertType<HTMLSpanElement, typeof element> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
  }, 5);
  await page.$eval('my-custom-element', (element, x) => {
    const elementAssertion: AssertType<HTMLElement|SVGElement, typeof element> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
  }, 5);
  await page.$$eval('my-custom-element', (elements, x) => {
    const elementAssertion: AssertType<(HTMLElement|SVGElement)[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
  }, 5);
  await page.$$eval('input', (elements, x) => {
    const elementAssertion: AssertType<HTMLInputElement[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
  }, 5);

  const frame = page.mainFrame();
  await frame.$eval('span', (element, [x, y]) => {
    const spanAssertion: AssertType<HTMLSpanElement, typeof element> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
    const stringAssertion: AssertType<string, typeof y> = true;
  }, [5, 'asdf']);
  await frame.$eval('my-custom-element', element => {
    const elementAssertion: AssertType<HTMLElement|SVGElement, typeof element> = true;
  });
  await frame.$$eval('my-custom-element', (elements, {x, y}) => {
    const elementAssertion: AssertType<(HTMLElement|SVGElement)[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
    const stringAssertion: AssertType<string, typeof y> = true;
  }, { x: 5, y: await page.evaluateHandle(() => 'asdf') });
  await frame.$$eval('input', (elements, x) => {
    const elementAssertion: AssertType<HTMLInputElement[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
  }, 5);

  const something = Math.random()  > .5 ? 'visible' : 'attached';
  const handle = await page.waitForSelector('a', {state: something});
  await handle.$eval('span', (element, { x, y }) => {
    const spanAssertion: AssertType<HTMLSpanElement, typeof element> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
    const stringAssertion: AssertType<string, typeof y> = true;
  }, { x: 5, y: 'asdf' });
  await handle.$eval('my-custom-element', element => {
    const elementAssertion: AssertType<HTMLElement|SVGElement, typeof element> = true;
  });
  await handle.$$eval('my-custom-element', (elements, [x, y]) => {
    const elementAssertion: AssertType<(HTMLElement|SVGElement)[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
    const stringAssertion: AssertType<string, typeof y> = true;
  }, [5, await page.evaluateHandle(() => 'asdf')]);
  await handle.$$eval('input', (elements, x) => {
    const elementAssertion: AssertType<HTMLInputElement[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
  }, 5);
  await browser.close();
})();

// query selectors

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const frame = page.mainFrame();
  const element = await page.waitForSelector('some-fake-element');
  const elementLikes = [page, frame, element];
  for (const elementLike of elementLikes) {
    {
      const handle = await elementLike.$('body');
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
    }
    {
      const handle = await elementLike.$('something-strange');
      const top = await handle!.evaluate(element => element.style.top);
      const assertion: AssertType<string, typeof top> = true;
    }

    {
      const handles = await elementLike.$$('body');
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>[], typeof handles> = true;
    }

    {
      const handles = await elementLike.$$('something-strange');
      const top = await handles[0].evaluate(element => element.style.top);
      const assertion: AssertType<string, typeof top> = true;
    }
  }

  type AssertCanBeNull<T> = null extends T ? true : false

  const frameLikes = [page, frame];
  for (const frameLike of frameLikes) {
    {
      const handle = await frameLike.waitForSelector('body');
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = false
    }
    {
      const handle = await frameLike.waitForSelector('body', {timeout: 0});
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = false;
    }
    {
      const state = Math.random() > .5 ? 'attached' : 'visible';
      const handle = await frameLike.waitForSelector('body', {state});
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = false;
    }
    {
      const handle = await frameLike.waitForSelector('body', {state: 'hidden'});
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = true;
    }
    {
      const state = Math.random() > .5 ? 'hidden' : 'visible';
      const handle = await frameLike.waitForSelector('body', {state});
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = true;
    }
    {
      const handle = await frameLike.waitForSelector('something-strange');
      const elementAssertion: AssertType<playwright.ElementHandle<HTMLElement|SVGElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = false;
    }
    {
      const handle = await frameLike.waitForSelector('something-strange', {timeout: 0});
      const elementAssertion: AssertType<playwright.ElementHandle<HTMLElement|SVGElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = false;
    }
    {
      const state = Math.random() > .5 ? 'attached' : 'visible';
      const handle = await frameLike.waitForSelector('something-strange', {state});
      const elementAssertion: AssertType<playwright.ElementHandle<HTMLElement|SVGElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = false;
    }
    {
      const state = Math.random() > .5 ? 'hidden' : 'visible';
      const handle = await frameLike.waitForSelector('something-strange', {state});
      const elementAssertion: AssertType<playwright.ElementHandle<HTMLElement|SVGElement>, typeof handle> = true;
      const canBeNull: AssertCanBeNull<typeof handle> = true;
    }
  }

  await browser.close();
})();

// top level
(async () => {
  playwright.chromium.connect;
  playwright.errors.TimeoutError;
  {
    playwright.devices['my device'] = {
      userAgent: 'foo',
      viewport: {height: 123, width: 456},
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: true,
      defaultBrowserType: 'chromium'
    };
    const iPhone = playwright.devices['iPhone 11'];
    const assertion: AssertType<string, typeof iPhone.userAgent> = true;
    const widthAssertion: AssertType<number, typeof iPhone.viewport.width> = true;
    const deviceScaleFactorAssertion: AssertType<number, typeof iPhone.deviceScaleFactor> = true;
    const hasTouchAssertion: AssertType<boolean, typeof iPhone.hasTouch> = true;
    const isMobileAssertion: AssertType<boolean, typeof iPhone.isMobile> = true;
  }
  {
    const agents = Object.entries(playwright.devices).map(([name, descriptor]) => descriptor.userAgent);
    const assertion: AssertType<string[], typeof agents> = true;
  }

  // Must be a function that evaluates to a selector engine instance.
  const createTagNameEngine = () => ({
    // Returns the first element matching given selector in the root's subtree.
    query(root: Element, selector: string) {
      return root.querySelector(selector);
    },

    // Returns all elements matching given selector in the root's subtree.
    queryAll(root: Element, selector: string) {
      return Array.from(root.querySelectorAll(selector));
    }
  });

  // Register the engine. Selectors will be prefixed with "tag=".
  await playwright.selectors.register('tag', createTagNameEngine);
})();

// Event listeners
(async function() {
  {
    const eventEmitter = {} as (playwright.Page | EventEmitter);
    const listener = () => { };
    eventEmitter.addListener('close', listener)
      .on('close', listener)
      .once('close', listener)
      .removeListener('close', listener)
      .off('close', listener);

  }
  {
    const eventEmitter = {} as (playwright.BrowserContext | EventEmitter);
    const listener = (c: playwright.BrowserContext) => { };
    eventEmitter.addListener('close', listener)
      .on('close', listener)
      .once('close', listener)
      .removeListener('close', listener)
      .off('close', listener);
  }
  {
    const page: playwright.Page = {} as any;
    page.on('dialog', dialog => dialog.accept());
  }
});

// waitForResponse callback predicate
(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().includes('example.com')),
    page.goto('https://example.com')
  ]);
  console.log((await response!.json()).foobar); // JSON return value should be any

  await browser.close();
})();

// for backwards compat, BrowserType is templated

(async () => {
  const browserType = {} as playwright.BrowserType<playwright.Browser & {foo: 'string'}>;
  const browser = await browserType.launch();
  await browser.close();
})

// exported types
import {
  LaunchOptions,
  ConnectOptions,
  Cookie,
  BrowserContextOptions,
  ViewportSize,
  Geolocation,
  HTTPCredentials,
} from 'playwright';

