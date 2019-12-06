// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
export async function download(
  browserFetcher:
    import('./chromium/BrowserFetcher').BrowserFetcher |
    import('./firefox/BrowserFetcher').BrowserFetcher |
    import('./webkit/BrowserFetcher').BrowserFetcher,
  revision: string,
  browserName: string,
  {onProgress}: {onProgress?: (downloadedBytes: number, totalBytes: number) => void} = {}) : Promise<RevisionInfo> {
  const revisionInfo = browserFetcher.revisionInfo(revision);
  await browserFetcher.download(revision, onProgress);
  return revisionInfo;
}

export type RevisionInfo = {
  folderPath: string,
  executablePath: string,
  url: string,
  local: boolean,
  revision: string,
};
