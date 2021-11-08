const { TestServer } = require('../../../utils/testserver/');
TestServer.create(__dirname, process.argv[2] || 3000).then(server => {
  console.log('listening on port', server.PORT);
  let ready = false;
  setTimeout(() => ready = true, 750);
  server.setRoute('/ready', (message, response) => {
    if (ready) {
      response.statusCode = 200;
      response.end('hello');
    } else {
      response.statusCode = 404;
      response.end('not-ready');
    }
  });
});
