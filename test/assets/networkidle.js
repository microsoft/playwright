async function sleep(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function main() {
  window.ws = new WebSocket('ws://localhost:' + window.location.port + '/ws');
  window.ws.addEventListener('message', message => {});

  const roundOne = Promise.all([
    fetch('fetch-request-a.js'),
  ]);

  await roundOne;
  await sleep(50);
  await fetch('fetch-request-d.js');
}

main();
