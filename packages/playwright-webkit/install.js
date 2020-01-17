downloadBrowser('webkit', require('./index').webkit);

async function downloadBrowser(browser, playwright) {
  let progressBar = null;
  let lastDownloadedBytes = 0;
  function onProgress(downloadedBytes, totalBytes) {
    if (!progressBar) {
      const ProgressBar = require('progress');
      progressBar = new ProgressBar(`Downloading ${browser} ${playwright._revision} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `, {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: totalBytes,
      });
    }
    const delta = downloadedBytes - lastDownloadedBytes;
    lastDownloadedBytes = downloadedBytes;
    progressBar.tick(delta);
  }

  const fetcher = playwright._createBrowserFetcher();
  const revisionInfo = fetcher.revisionInfo();
  await fetcher.download(revisionInfo.revision, onProgress);
  logPolitely(`${browser} downloaded to ${revisionInfo.folderPath}`);
}

function toMegabytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb * 10) / 10} Mb`;
}

function logPolitely(toBeLogged) {
  const logLevel = process.env.npm_config_loglevel;
  const logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel) > -1;

  if (!logLevelDisplay)
    console.log(toBeLogged);
}

