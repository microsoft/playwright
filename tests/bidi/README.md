## Running Bidi tests

To run Playwright tests with Bidi:

```sh
git clone https://github.com/microsoft/playwright.git
cd playwright
npm run build # call `npm run watch` for watch mode
npx playwright install chromium
npm run biditest -- --project='bidi-firefox-beta-*'
```

To install beta channel of Firefox, run the following command in the project root:
```sh
npx -y @puppeteer/browsers install firefox@beta
```

You can also pass custom binary path via `BIDIPATH`:
```sh
BIDIPATH='/Users/myself/Downloads/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
```


