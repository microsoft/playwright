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

import * as playwright from '../../../index';
type AssertType<T, S> = S extends T ? AssertNotAny<S> : false;
type AssertNotAny<S> = {notRealProperty: number} extends S ? false : true;

// Examples taken from README
(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'example.png' });

  browser.close();
})();

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://news.ycombinator.com', { waitUntil: 'networkidle0' });
  await page.pdf({ path: 'hn.pdf', format: 'A4' });

  browser.close();
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

  browser.close();
})();

// The following examples are taken from the docs itself
playwright.chromium.launch().then(async browser => {
  const page = await browser.newPage();
  page.on('console', message => {
    console.log(message.text());
  });
  page.evaluate(() => console.log(5, 'hello', { foo: 'bar' }));

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
  browser.close();

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

  await page.emulateMedia({media: 'screen'});
  await page.pdf({ path: 'page.pdf' });

  await page.route('**/*', interceptedRequest => {
    if (
      interceptedRequest.url().endsWith('.png') ||
      interceptedRequest.url().endsWith('.jpg')
    )
      interceptedRequest.abort();
    else interceptedRequest.continue();
  });

  await page.route(str => {
    const assertion: AssertType<string, typeof str> = true;
    return true;
  }, interceptedRequest => {
    interceptedRequest.continue();
    return 'something random for no reason';
  });

  await page.keyboard.type('Hello'); // Types instantly
  await page.keyboard.type('World', { delay: 100 }); // Types slower, like a user

  const watchDog = page.waitForFunction('window.innerWidth < 100');
  page.setViewportSize({ width: 50, height: 50 });
  await watchDog;

  let currentURL: string;
  page
      .waitForSelector('img', { visibility: 'visible' })
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
  page.keyboard.sendCharacters('嗨');
  await browser.startTracing(page, { path: 'trace.json'});
  await page.goto('https://www.google.com');
  await browser.stopTracing();

  page.on('dialog', async dialog => {
    console.log(dialog.message());
    await dialog.dismiss();
    browser.close();
  });

  const inputElement = (await page.$('input[type=submit]'))!;
  await inputElement.click();
});

// Example with launch options
(async () => {
  const browser = await playwright.chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    handleSIGINT: true,
    handleSIGHUP: true,
    handleSIGTERM: true,
  });
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'example.png' });

  browser.close();
})();

// Test v0.12 features
(async () => {
  const browser = await playwright.chromium.launch({
    devtools: true,
    env: {
      JEST_TEST: true
    }
  });
  const page = await browser.newPage();
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

  browser.close();
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

  browser.close();
})();

// typed handles
(async () => {
  const browser = await playwright.webkit.launch();
  const page = await browser.newPage();
  const windowHandle = await page.evaluateHandle(() => window);
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
    const handle = await page.evaluateHandle(() => document.createElement('body'));
    const assertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
    await handle.evaluate(body => {
      const assertion: AssertType<HTMLBodyElement, typeof body> = true;
    });
  }

  await browser.close();
})();

// protocol
(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const session = await context.createSession(await context.newPage());


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

(async () => {
  const browser = await playwright.firefox.launch();
  const page = await browser.newPage();
  const context = page.context();
  const oneTwoThree = ('pageTarget' in context) ? context['pageTarget'] : 123;
  const assertion: AssertType<123, typeof oneTwoThree> = true;
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
  await frame.$eval('span', (element, x, y) => {
    const spanAssertion: AssertType<HTMLSpanElement, typeof element> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
    const stringAssertion: AssertType<string, typeof y> = true;
  }, 5, 'asdf');
  await frame.$eval('my-custom-element', element => {
    const elementAssertion: AssertType<HTMLElement|SVGElement, typeof element> = true;
  });
  await frame.$$eval('my-custom-element', (elements, x, y) => {
    const elementAssertion: AssertType<(HTMLElement|SVGElement)[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
    const stringAssertion: AssertType<string, typeof y> = true;
  }, 5, await page.evaluateHandle(() => 'asdf'));
  await frame.$$eval('input', (elements, x) => {
    const elementAssertion: AssertType<HTMLInputElement[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
  }, 5);

  const something = Math.random()  > .5 ? 'visible' : 'any';
  const handle = await page.waitForSelector('a', {visibility: something});
  await handle.$eval('span', (element, x, y) => {
    const spanAssertion: AssertType<HTMLSpanElement, typeof element> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
    const stringAssertion: AssertType<string, typeof y> = true;
  }, 5, 'asdf');
  await handle.$eval('my-custom-element', element => {
    const elementAssertion: AssertType<HTMLElement|SVGElement, typeof element> = true;
  });
  await handle.$$eval('my-custom-element', (elements, x, y) => {
    const elementAssertion: AssertType<(HTMLElement|SVGElement)[], typeof elements> = true;
    const numberAssertion: AssertType<number, typeof x> = true;
    const stringAssertion: AssertType<string, typeof y> = true;
  }, 5, await page.evaluateHandle(() => 'asdf'));
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

  const frameLikes = [page, frame];
  for (const frameLike of frameLikes) {
    {
      const handle = await frameLike.waitForSelector('body');
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
      const canBeNull: AssertType<null, typeof handle> = false;
    }
    {
      const visibility = Math.random() > .5 ? 'any' : 'visible';
      const handle = await frameLike.waitForSelector('body', {visibility});
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
      const canBeNull: AssertType<null, typeof handle> = false;
    }
    {
      const waitFor = Math.random() > .5 ? 'hidden' : 'visible';
      const handle = await frameLike.waitForSelector('body', {waitFor});
      const bodyAssertion: AssertType<playwright.ElementHandle<HTMLBodyElement>, typeof handle> = true;
      const canBeNull: AssertType<null, typeof handle> = true;
    }

    {
      const handle = await frameLike.waitForSelector('something-strange');
      const elementAssertion: AssertType<playwright.ElementHandle<HTMLElement|SVGElement>, typeof handle> = true;
      const canBeNull: AssertType<null, typeof handle> = false;
    }
    {
      const visibility = Math.random() > .5 ? 'any' : 'visible';
      const handle = await frameLike.waitForSelector('something-strange', {visibility});
      const elementAssertion: AssertType<playwright.ElementHandle<HTMLElement|SVGElement>, typeof handle> = true;
      const canBeNull: AssertType<null, typeof handle> = false;
    }
    {
      const waitFor = Math.random() > .5 ? 'hidden' : 'visible';
      const handle = await frameLike.waitForSelector('something-strange', {waitFor});
      const elementAssertion: AssertType<playwright.ElementHandle<HTMLElement|SVGElement>, typeof handle> = true;
      const canBeNull: AssertType<null, typeof handle> = true;
    }
  }


  await browser.close();
})();
