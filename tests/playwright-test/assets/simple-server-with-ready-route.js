const http = require('http');

const port = process.argv[2] || 3000;

let ready = false;
setTimeout(() => ready = true, 750);

const requestListener = function (req, res) {
  if (req.url === '/ready') {
    if (ready) {
      res.writeHead(200);
      res.end('hello');
    } else {
      res.writeHead(404);
      res.end('not-ready');
    }
  } else {
    res.writeHead(404);
    res.end();
  }
};

const server = http.createServer(requestListener);
server.listen(port, () => {
  console.log('listening on port', port);
});
