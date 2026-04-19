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

// Regression guard for commit 463be3479: the protocol channel validator
// silently stripped humanizeInput and stealthMode across the client/server
// boundary. The pure unit tests on bezierInput would not catch this; we
// need to prove the flags actually arrive at BrowserOptions after a full
// launch — i.e. survive protocol.yml validation in both directions.
//
// Approach: launch via the browserType fixture, then hop from the client
// Browser to the server-side impl via the `toImpl` fixture (the canonical
// pattern used elsewhere in tests/library, e.g. channels.spec.ts and
// slowmo.spec.ts). Once on the server side, `browser.options` is the
// authoritative BrowserOptions that crInput / crPage consume.

import { playwrightTest, expect } from '../config/browserTest';

playwrightTest.skip(({ browserName }) => browserName !== 'chromium',
    'humanizeInput + stealthMode are Chromium-only fork options');
playwrightTest.skip(({ mode }) => mode !== 'default',
    'toImpl access requires in-process server, not available in service mode');

playwrightTest('humanizeInput flag reaches BrowserOptions via launch', async ({ browserType, toImpl }) => {
  const browser = await browserType.launch({
    // @ts-expect-error — humanizeInput is an internal fork-only option
    humanizeInput: true,
  });
  try {
    const serverBrowser = toImpl(browser);
    expect(serverBrowser.options.humanizeInput, 'humanizeInput not forwarded to BrowserOptions').toBe(true);
  } finally {
    await browser.close();
  }
});

playwrightTest('stealthMode flag reaches BrowserOptions via launch', async ({ browserType, toImpl }) => {
  const browser = await browserType.launch({
    // @ts-expect-error — stealthMode is an internal fork-only option
    stealthMode: true,
  });
  try {
    const serverBrowser = toImpl(browser);
    expect(serverBrowser.options.stealthMode, 'stealthMode not forwarded to BrowserOptions').toBe(true);
  } finally {
    await browser.close();
  }
});

playwrightTest('neither flag is set when omitted (default)', async ({ browserType, toImpl }) => {
  const browser = await browserType.launch();
  try {
    const serverBrowser = toImpl(browser);
    expect(serverBrowser.options.humanizeInput, 'humanizeInput leaked when not requested').toBeFalsy();
    expect(serverBrowser.options.stealthMode, 'stealthMode leaked when not requested').toBeFalsy();
  } finally {
    await browser.close();
  }
});
