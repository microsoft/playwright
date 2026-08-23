/**
 * Example 14: Downloads, Uploads, and Dialog Handling
 * 
 * This script demonstrates interacting with the native browser events
 * for downloading files, uploading files (without UI dialogs), and 
 * handling JavaScript dialogs.
 * 
 * Note: This is a standalone, well-commented example for documentation
 * purposes only and is not meant to be executed directly in this environment.
 */

const { chromium } = require('playwright-core');

(async () => {
  // 1. Launch browser and create a context
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 2. Dialog Handling
  // Playwright intercepts Page.javascriptDialogOpening CDP events and wraps them
  // into a Dialog object from packages/playwright-core/src/server/dialog.ts
  page.on('dialog', async dialog => {
    console.log(`Intercepted dialog: ${dialog.type()} with message: ${dialog.message()}`);
    // Native browser execution is blocked until we accept or dismiss the dialog.
    // This sends the Page.handleJavaScriptDialog CDP command.
    await dialog.accept('User input text');
  });

  // 3. File Chooser (Upload Interception)
  // When Page.setInterceptFileChooserDialog is enabled via CDP, clicking an input
  // element triggers Page.fileChooserOpened instead of opening the OS dialog.
  page.on('filechooser', async fileChooser => {
    console.log(`Intercepted file chooser for multiple files? ${fileChooser.isMultiple()}`);
    // This ultimately sends DOM.setFileInputFiles to Chromium.
    await fileChooser.setFiles('/path/to/mock_upload.pdf');
  });

  // 4. Download Handling
  // Chromium emits Browser.downloadWillBegin and Browser.downloadProgress, which
  // playwright-core translates to Page.Events.Download.
  page.on('download', async download => {
    console.log(`Download started: ${download.url()} -> ${download.suggestedFilename()}`);
    
    // Playwright stores the artifact in a temporary directory until explicitly saved.
    // Using Artifact.ts logic underneath to stream or copy the file.
    const downloadError = await download.failure();
    if (!downloadError) {
      await download.saveAs('/path/to/save/downloaded_file.zip');
    }
  });

  // 5. Direct Upload (Bypassing File Chooser)
  // Bypasses the file chooser completely by directly sending the paths to the DOM element.
  // This uses dom.ts to resolve the element and crPage.ts to invoke DOM.setFileInputFiles.
  await page.goto('https://example.com/upload');
  await page.setInputFiles('input[type="file"]', ['/path/to/upload1.png', '/path/to/upload2.png']);

  // Cleanup
  await browser.close();
})();
