import * as playwright from "../../../../index";

// Examples taken from README
(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto("https://example.com");
  await page.screenshot({ path: "example.png" });

  browser.close();
})();

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto("https://news.ycombinator.com", { waitUntil: "networkidle0" });
  await page.pdf({ path: "hn.pdf", format: "A4" });

  browser.close();
})();

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto("https://example.com");

  // Get the "viewport" of the page, as reported by the page.
  const dimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      deviceScaleFactor: window.devicePixelRatio
    };
  });

  console.log("Dimensions:", dimensions);

  browser.close();
})();

// The following examples are taken from the docs itself
playwright.launch().then(async browser => {
  const page = await browser.newPage();
  page.on("console", (...args: any[]) => {
    for (let i = 0; i < args.length; ++i) console.log(`${i}: ${args[i]}`);
  });
  page.evaluate(() => console.log(5, "hello", { foo: "bar" }));

  const result = await page.evaluate(() => {
    return Promise.resolve(8 * 7);
  });
  console.log(await page.evaluate("1 + 2"));

  const bodyHandle = await page.$("body");

  // Typings for this are really difficult since they depend on internal state
  // of the page class.
  const html = await page.evaluate(
    (body: HTMLElement) => body.innerHTML,
    bodyHandle
  );
});

import * as crypto from "crypto";
import * as fs from "fs";

playwright.launch().then(async browser => {
  const page = await browser.newPage();
  page.on("console", console.log);
  await page.exposeFunction("md5", (text: string) =>
    crypto
      .createHash("md5")
      .update(text)
      .digest("hex")
  );
  await page.evaluate(async () => {
    // use window.md5 to compute hashes
    const myString = "PLAYWRIGHT";
    const myHash = await (window as any).md5(myString);
    console.log(`md5 of ${myString} is ${myHash}`);
  });
  browser.close();

  page.on("console", console.log);
  await page.exposeFunction("readfile", async (filePath: string) => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, "utf8", (err, text) => {
        if (err) reject(err);
        else resolve(text);
      });
    });
  });
  await page.evaluate(async () => {
    // use window.readfile to read contents of a file
    const content = await (window as any).readfile("/etc/hosts");
    console.log(content);
  });

  await page.emulateMedia("screen");
  await page.pdf({ path: "page.pdf" });

  await page.setRequestInterception(true);
  page.on("request", interceptedRequest => {
    if (
      interceptedRequest.url().endsWith(".png") ||
      interceptedRequest.url().endsWith(".jpg")
    )
      interceptedRequest.abort();
    else interceptedRequest.continue();
  });

  page.keyboard.type("Hello"); // Types instantly
  page.keyboard.type("World", { delay: 100 }); // Types slower, like a user

  const watchDog = page.waitForFunction("window.innerWidth < 100");
  page.setViewport({ width: 50, height: 50 });
  await watchDog;

  let currentURL: string;
  page
    .waitForSelector("img", { visible: true })
    .then(() => console.log("First URL with image: " + currentURL));
  for (currentURL of [
    "https://example.com",
    "https://google.com",
    "https://bbc.com"
  ]) {
    await page.goto(currentURL);
  }

  page.keyboard.type("Hello World!");
  page.keyboard.press("ArrowLeft");

  page.keyboard.down("Shift");
  // tslint:disable-next-line prefer-for-of
  for (let i = 0; i < " World".length; i++) {
    page.keyboard.press("ArrowLeft");
  }
  page.keyboard.up("Shift");
  page.keyboard.press("Backspace");
  page.keyboard.sendCharacter("嗨");

  await page.tracing.start({ path: "trace.json" });
  await page.goto("https://www.google.com");
  await page.tracing.stop();

  page.on("dialog", async dialog => {
    console.log(dialog.message());
    await dialog.dismiss();
    browser.close();
  });

  const inputElement = (await page.$("input[type=submit]"))!;
  await inputElement.click();
});

// Example with launch options
(async () => {
  const browser = await playwright.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    handleSIGINT: true,
    handleSIGHUP: true,
    handleSIGTERM: true,
  });
  const page = await browser.newPage();
  await page.goto("https://example.com");
  await page.screenshot({ path: "example.png" });

  browser.close();
})();

// Test v0.12 features
(async () => {
  const browser = await playwright.launch({
    devtools: true,
    env: {
      JEST_TEST: true
    }
  });
  const page = await browser.newPage();
  const button = (await page.$("#myButton"))!;
  const div = (await page.$("#myDiv"))!;
  const input = (await page.$("#myInput"))!;

  if (!button)
    throw new Error('Unable to select myButton');

  if (!input)
    throw new Error('Unable to select myInput');

  await page.addStyleTag({
    url: "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css"
  });

  console.log(page.url());

  page.type("#myInput", "Hello World!");

  page.on("console", (event: playwright.ConsoleMessage, ...args: any[]) => {
    console.log(event.text, event.type);
    for (let i = 0; i < args.length; ++i) console.log(`${i}: ${args[i]}`);
  });

  await button.focus();
  await button.press("Enter");
  await button.screenshot({
    type: "jpeg",
    omitBackground: true,
    clip: {
      x: 0,
      y: 0,
      width: 200,
      height: 100
    }
  });
  console.log(button.toString());
  input.type("Hello World", { delay: 10 });

  const buttonText = await (await button.getProperty('textContent')).jsonValue();

  await page.deleteCookie(...await page.cookies());

  const metrics = await page.metrics();
  console.log(metrics.Documents, metrics.Frames, metrics.JSEventListeners);

  const navResponse = await page.waitForNavigation({
    timeout: 1000
  });
  console.log(navResponse.ok, navResponse.status, navResponse.url, navResponse.headers);

  // evaluate example
  const bodyHandle = (await page.$('body'))!;
  const html = await page.evaluate((body : HTMLBodyElement) => body.innerHTML, bodyHandle);
  await bodyHandle.dispose();

  // getProperties example
  const handle = await page.evaluateHandle(() => ({ window, document }));
  const properties = await handle.getProperties();
  const windowHandle = properties.get('window');
  const documentHandle = properties.get('document');
  await handle.dispose();

  // queryObjects example
  // Create a Map object
  await page.evaluate(() => (window as any).map = new Map());
  // Get a handle to the Map object prototype
  const mapPrototype = await page.evaluateHandle(() => Map.prototype);
  // Query all map instances into an array
  const mapInstances = await page.queryObjects(mapPrototype);
  // Count amount of map objects in heap
  const count = await page.evaluate((maps: Map<any, any>[]) => maps.length, mapInstances);
  await mapInstances.dispose();
  await mapPrototype.dispose();

  // evaluateHandle example
  const aHandle = await page.evaluateHandle(() => document.body);
  const resultHandle = await page.evaluateHandle((body: Element) => body.innerHTML, aHandle);
  console.log(await resultHandle.jsonValue());
  await resultHandle.dispose();

  browser.close();
})();

// test $eval and $$eval
(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto("https://example.com");
  await page.$eval('#someElement', (element, text: string) => {
    return element.innerHTML = text;
  }, 'hey');

  let elementText = await page.$$eval('.someClassName', (elements) => {
    console.log(elements.length);
    console.log(elements.map(x => x)[0].textContent);
    return elements[3].innerHTML;
  });

  browser.close();
})();
