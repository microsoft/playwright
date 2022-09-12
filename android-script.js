const { _android: android } = require('playwright');
// const android = require('playwright');

(async () => {
    // Connect to the device.
    const [device] = await android.devices();
    console.log(`Model: ${device.model()}`);
    console.log(`Serial: ${device.serial()}`);
    // Take screenshot of the whole device.
    await device.screenshot({ path: 'device.png' });

    {
        // --------------------- Browser -----------------------

        // Launch Chrome browser.
        await device.shell('am force-stop com.android.chrome');
        const context = await device.launchBrowser();

        // Use BrowserContext as usual.
        const page = await context.newPage();
        await page.goto('https://webkit.org/');
        console.log(await page.evaluate(() => window.location.href));
        await page.screenshot({ path: 'page-chrome.png' });

        await context.close();
    }

    // Close the device.
    await device.close();

    // const browser = await android.connect(`ws://127.0.0.1:52534/791eb8d8d342fdc4456d26747d6fad00`);

    // const devices =  await android.devices();
    // console.log(devices);
})();