/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { contextTest as it, expect } from '../config/browserTest';

const source = `
  module.exports = {
    default: function() {
      return function(injectedScript, params) {
        (window.__installs = window.__installs || []).push(params.marker);
      };
    }
  };
`;

it('should not run a stale extendInjectedScript call against a new document after navigation', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41773' },
}, async ({ page, server, toImpl }) => {
  await page.goto(server.EMPTY_PAGE);

  const frame = toImpl(page).mainFrame();
  const originalContext = frame.context.bind(frame);
  let callCount = 0;
  let releaseGate: () => void;
  const gate = new Promise<void>(f => releaseGate = f);
  // Delay only the first call to context('main'), simulating an install that was
  // scheduled for the frame's current document but hasn't resolved its context yet.
  frame.context = (world: string) => {
    callCount++;
    return callCount === 1 ? gate.then(() => originalContext(world)) : originalContext(world);
  };

  try {
    // Install for the current (soon to be stale) document. Blocks on the gate above.
    const staleInstall = frame.extendInjectedScript(source, { marker: 'A' });

    // Real navigation to a new document, going through production code that updates
    // frame._currentDocument.
    await page.goto(server.PREFIX + '/title.html');

    // Install for the new, current document completes normally.
    await frame.extendInjectedScript(source, { marker: 'B' });

    // Only now let the stale call's context('main') resolve, after the frame has
    // already navigated away from the document it was installed for.
    releaseGate!();
    await staleInstall;
  } finally {
    frame.context = originalContext;
  }

  expect(await page.evaluate(() => (window as any).__installs)).toEqual(['B']);
});
