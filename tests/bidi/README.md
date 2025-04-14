## Running Bidi tests

To run Playwright tests with Bidi:

```sh
git clone https://github.com/microsoft/playwright.git
cd playwright
npm run build # call `npm run watch` for watch mode
npx playwright install chromium
npm run biditest -- --project='moz-firefox-*'
```

To install beta channel of Firefox, run the following command in the project root:
```sh
npx -y @puppeteer/browsers install firefox@beta
```
After that you need to pass custom firefox binary path to the test runner via `BIDI_FFPATH`:
```sh
BIDI_FFPATH='/Users/myself/playwright/firefox/mac_arm-beta_138.0b5/Firefox.app/Contents/MacOS/firefox' npm run biditest -- --project='moz-firefox-*'
```

For custom Chromium path use `BIDI_CRPATH`.

```sh
BIDI_CRPATH='/Users/myself/Downloads/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
```
