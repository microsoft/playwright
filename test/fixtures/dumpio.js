(async() => {
  process.on('unhandledRejection', error => {
    // Catch various errors as we launch non-browser binary.
    console.log('unhandledRejection', error.message);
  });

  const [, , playwrightRoot, product, usePipe] = process.argv;
  const options = {
    pipe: usePipe === 'use-pipe',
    ignoreDefaultArgs: true,
    dumpio: true,
    timeout: 1,
    executablePath: 'node',
    args: ['-e', 'console.error("message from dumpio")', '--']
  }
  console.error('using pipe: ' + options.pipe);
  if (product.toLowerCase() === 'firefox')
    options.args.push('-juggler', '-profile');
  try {
    await require(playwrightRoot)[product.toLowerCase()].launchBrowserApp(options);
    console.error('Browser launch unexpectedly succeeded.');
  } catch (e) {
  }
})();
