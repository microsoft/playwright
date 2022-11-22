onconnect = event => {
  const port = event.ports[0];
  port.onmessage = e => port.postMessage('echo:' + e.data);
};
