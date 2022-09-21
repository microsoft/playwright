const { _android: android, _android } = require('playwright');
// const android = require('playwright');

(async () => {
    // Connect to the device.
    // const [device] = await _android.devices();
    // console.log(`Model: ${device.model()}`);
    // console.log(`Serial: ${device.serial()}`);
    // // Take screenshot of the whole device.
    // await device.screenshot({ path: 'device.png' });

    // {
    //     // --------------------- Browser -----------------------

    //     // Launch Chrome browser.
    //     await device.shell('am force-stop com.android.chrome');
    //     const context = await device.launchBrowser();

    //     // Use BrowserContext as usual.
        // const page = await context.newPage();
        // await page.goto('https://webkit.org/');
        // console.log(await page.evaluate(() => window.location.href));
        // await page.screenshot({ path: 'page-chrome.png' });

        // await context.close();
    // }

    // // Close the device.
    // await device.close();

    const device = await _android.connect(`ws://127.0.0.1:53461/f7f3ba874c061e28cce91f12623c6cb8`);

    // console.log(device);
    console.log(device.model());
    console.log(device.serial());
    await device.shell('am force-stop com.android.chrome');
    const context = await device.launchBrowser();
    // console.log(context);

    const page = await context.newPage();
    await page.goto('https://webkit.org/');
    console.log(await page.evaluate(() => window.location.href));
    await page.screenshot({ path: 'page-chrome-1.png' });

    await context.close();
    // await device.close();
    // const devices =  await browser.devices();
})();