(async() => {
  process.on('unhandledRejection', error => {
    // Catch various errors as we launch non-browser binary.
    console.log('unhandledRejection', error.message);
  });

  const [, , playwrightRoot, product, useWebSocket] = process.argv;
  const options = {
    ignoreDefaultArgs: true,
    dumpio: true,
    timeout: 1,
    executablePath: 'node',
    args: ['-e', 'console.error("message from dumpio")', '--']
  }
  console.error('using web socket: ' + options.webSocket);
  try {
    await require(playwrightRoot)[product.toLowerCase()].launchServer(options);
    console.error('Browser launch unexpectedly succeeded.');
  } catch (e) {
  }
})();
