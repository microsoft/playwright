const { spawnSync } = require('child_process');

measureJS('require', `require('..')`);

for (const browserName of ['chromium', 'webkit', 'firefox'])
    measureJS(browserName, `(${measurePlaywrightPerf})(${JSON.stringify(browserName)})`);

try {
    require.resolve('puppeteer');
    measureJS('puppeteer', `(${measurePuppeteerPerf})()`);
}
catch {}

try {
    require.resolve('jsdom');
    measureJS('jsdom', `(${measureJSDOMPerf})()`);
}
catch {}

async function measurePlaywrightPerf(browserName) {
    const playwright = require('..');
    const browser = await playwright[browserName].launch();
    const page = await browser.newPage();
    const value = await page.evaluate(() => 1 + 2);
    if (value !== 3)
        throw new Error(`Expected value to be 3, got ${value}`);
    await browser.close();
}

async function measurePuppeteerPerf() {
    const browser = await require('puppeteer').launch();
    const page = await browser.newPage();
    const value = await page.evaluate(() => 1 + 2);
    if (value !== 3)
        throw new Error(`Expected value to be 3, got ${value}`);
    await browser.close();
}

async function measureJSDOMPerf() {
    const {JSDOM} = require('jsdom');
    const {window} = new JSDOM(``);
    const value = window.eval(`1 + 2`);
    if (value !== 3)
        throw new Error(`Expected value to be 3, got ${value}`);
}

function measureJS(name, js) {
    const iterations = 30;
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
        spawnSync(process.argv0, ['-e', js], {
            stdio: 'inherit',
            cwd: __dirname,
        });
    }
    console.log(name, Math.round((Date.now() - start) / iterations));
}