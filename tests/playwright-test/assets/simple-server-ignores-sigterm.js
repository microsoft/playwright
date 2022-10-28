const http = require('http');

const port = process.argv[2] || 3000;

const server = http.createServer(function (req, res) {
  res.end('running!');
});
process.on('SIGTERM', () => console.log('received SIGTERM - ignoring'));
process.on('SIGINT', () => console.log('received SIGINT - ignoring'));

server.listen(port, () => {
  console.log('listening on port', port);
});
