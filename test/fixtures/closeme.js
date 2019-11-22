(async() => {
  const [, , playwrightRoot, options] = process.argv;
  const browser = await require(playwrightRoot).launch(JSON.parse(options));
  console.log(browser.chromium.wsEndpoint());
})();
