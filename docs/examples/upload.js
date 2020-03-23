const { firefox } = require("playwright");

/**
 * In this script, we will upload a file to a web page.
 * 
 * Steps summary
 * 1. Open the sample file upload at https://cgi-lib.berkeley.edu/ex/fup.html
 * 2. Automate file upload with setInputFiles
 */

(async () => {
    // Launch a headless browser instance of chromium, webkit or firefox
	const browser = await firefox.launch();

    // Use the default browser context to create a new tab and navigate to URL
    const page = await browser.newPage();
    await page.goto('https://cgi-lib.berkeley.edu/ex/fup.html');

    // Get an element handle to the file upload input
    const handle = await page.$('input[type="file"]');

    // Use the setInputFiles API to upload this file. File paths are relative to
    // the current working directory. It is also possible to upload multiple files
    // or use base64 encoded data, instead of a file. See API docs.
    // https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandlesetinputfilesfiles
    await handle.setInputFiles('upload.js');

    // Click on the form submit element
    await page.click('input[type="submit"]');

    // Take a screenshot of the uploaded state and close the browser
    await page.screenshot({ path: 'uploaded.png' });
    await browser.close();
})();
