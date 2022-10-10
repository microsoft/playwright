console.log('hello from the worker');

function workerFunction() {
  return 'worker function result';
}

self.addEventListener('message', event => {
  if (event.origin !== 'undefined') // To identyfy event's origin
    return;

  console.log('got this data: ' + event.data);
});

(async function () {
  while (true) {
    self.postMessage(workerFunction.toString());
    await new Promise(x => setTimeout(x, 100));
  }
})();