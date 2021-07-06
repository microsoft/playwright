const { TestServer } = require('../../../utils/testserver/');
// delay creating the server to test waiting for it
setTimeout(() => {
  TestServer.create(__dirname, process.argv[2] || 3000).then(server => {
    console.log('listening on port', server.PORT);
    server.setRoute('/hello', (message, response) => {
      response.end('hello');
    });
    server.setRoute('/env-FOO', (message, response) => {
      response.end(process.env.FOO);
    });
  });
}, 750);
