const http = require('http');

console.error('error from server');

const port = process.argv[2] || 3000;

const requestListener = function (req, res) {
  if (req.url === '/hello') {
    res.end('hello');
    return;
  }
  if (req.url === '/env-FOO') {
    res.end(process.env.FOO);
    return;
  }
  if (req.url === '/port') {
    res.end('' + port);
    return;
  }
  if (req.url === '/redirect') {
    res.writeHead(301, 'Moved');
    res.end();
    return;
  }
  res.writeHead(404);
  res.end();
};

const server = http.createServer(requestListener);

// delay creating the server to test waiting for it
setTimeout(() => {
  server.listen(port, () => {
    console.log('listening on port', port);
  });
}, process.argv[3] ? +process.argv[3] : 0);
