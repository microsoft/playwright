// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

module.exports = browser => {
  if (browser === 'chromium')
    return require('./chromium');
  if (browser === 'firefox')
    return require('./firefox');
  if (browser === 'webkit')
    return require('./webkit');
  throw new Error(`Unsupported browser "${browser}"`);
};
