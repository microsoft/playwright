// Each time the service worker starts (or restarts), this runs fresh.
// globalThis state is reset on every new SW activation.
globalThis.startTime = Date.now();
globalThis.startCount = 1;

self.addEventListener('message', event => {
  if (event.data === 'ping')
    event.source.postMessage({ startTime: globalThis.startTime, startCount: globalThis.startCount });
});
