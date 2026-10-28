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

async function fetchJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok)
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

const chromeReleases = await fetchJSON('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json');
const chromiumVersion = chromeReleases.channels?.Stable?.version;
if (!/^\d+\.\d+\.\d+\.\d+$/.test(chromiumVersion))
  throw new Error('Release metadata must contain a stable Chrome for Testing version');

console.log(chromiumVersion);
