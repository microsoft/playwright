# playwright-android
This package contains the [Android](https://www.android.com/) flavor of [Playwright](http://github.com/microsoft/playwright).

## Requirements

- Android device or AVD Emulator.
- [ADB daemon](https://developer.android.com/studio/command-line/adb) running and authenticated with your device. Typically running `adb devices` is all you need to do.
- [Chrome 87](https://play.google.com/store/apps/details?id=com.android.chrome) or newer installed on the device
- "Enable command line on non-rooted devices" enabled in `chrome://flags`.

## How to demo

```js
const { android } = require('playwright-android');

(async () => {
  const [device] = await android.devices();

  // Android automation.
  console.log(`Model: ${device.model()}`);
  console.log(`Serial: ${device.serial()}`);

  await device.tap({ desc: 'Home' });
  console.log(await device.info({ text: 'Chrome' }));
  await device.tap({ text: 'Chrome' });
  await device.fill({ res: 'com.android.chrome:id/url_bar' }, 'www.chromium.org');
  await device.input.press('Enter');
  await new Promise(f => setTimeout(f, 1000));

  await device.tap({ res: 'com.android.chrome:id/tab_switcher_button' });
  await device.tap({ desc: 'More options' });
  await device.tap({ desc: 'Close all tabs' });

  // Browser automation.
  const context = await device.launchBrowser();
  const [page] = context.pages();
  await page.goto('https://webkit.org/');
  console.log(await page.evaluate(() => window.location.href));
  await context.close();

  await device.close();
})();
```
