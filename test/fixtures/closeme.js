(async() => {
  const [, , playwrightRoot, options] = process.argv;
  const browser = await require(playwrightRoot).launch(JSON.parse(options));
  if (browser.chromium)
    console.log(browser.chromium.wsEndpoint());
  else if (browser.firefox)
    console.log(browser.firefox.wsEndpoint());
})();
