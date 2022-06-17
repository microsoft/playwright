/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { test, expect } from './npmTest';

const CDNS = [
  'https://playwright.azureedge.net',
  'https://playwright-akamai.azureedge.net',
  'https://playwright-verizon.azureedge.net',
];

const DL_STAT_BLOCK = /^.*from url: (.*)$\n^.*to location: (.*)$\n^.*response status code: (.*)$\n^.*total bytes: (.*)$\n^.*SUCCESS downloading (\w+) .*$/gm;

const parsedDownloads = (rawLogs: string) => {
  const out: { url: string, status: number, name: string }[] = [];
  for (const match of rawLogs.matchAll(DL_STAT_BLOCK)) {
    const [, url, /* filepath */, status, /* size */, name] = match;
    out.push({ url, status: Number.parseInt(status, 10), name: name.toLocaleLowerCase() });
  }
  return out;
};


for (const cdn of CDNS) {
  test(`playwright cdn failover should work (${cdn})`, async ({ exec, nodeMajorVersion, installedSoftwareOnDisk }) => {
    const result = await exec('npm i --foreground-scripts playwright', { env: { PW_TEST_CDN_THAT_SHOULD_WORK: cdn, DEBUG: 'pw:install' } });
    expect(result).toHaveLoggedSoftwareDownload(['chromium', 'ffmpeg', 'firefox', 'webkit']);
    expect(await installedSoftwareOnDisk()).toEqual(['chromium', 'ffmpeg', 'firefox', 'webkit']);
    const dls = parsedDownloads(result);
    for (const software of ['chromium', 'ffmpeg', 'firefox', 'webkit'])
      expect(dls).toContainEqual({ status: 200, name: software, url: expect.stringContaining(cdn) });
    await exec('node sanity.js playwright');
    if (nodeMajorVersion >= 14)
      await exec('node esm-playwright.mjs');
    const stdio = await exec('npx playwright', 'test', '-c', '.', { expectToExitWithError: true });
    expect(stdio).toContain(`Please install @playwright/test package to use Playwright Test.`);
  });
}
