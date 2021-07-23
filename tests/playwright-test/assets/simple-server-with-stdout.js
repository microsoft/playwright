const { TestServer } = require('../../../utils/testserver/');
// delay creating the server to test waiting for it
setTimeout(() => {
  TestServer.create(__dirname, process.argv[2] || 3000).then(server => {
    console.log(`Listening on http://localhost:${server.PORT}`);
    server.setRoute('/hello', (message, response) => {
      response.end('hello');
    });
  });
}, 750);
