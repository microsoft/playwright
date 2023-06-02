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

import { test, expect } from '../playwright-test/stable-test-runner';
import { PNG } from 'playwright-core/lib/utilsBundle';
import { compare } from 'playwright-core/lib/image_tools/compare';
import fs from 'fs';
import path from 'path';

function listFixtures(root: string, fixtures: Set<string> = new Set()) {
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, item.name);
    if (item.isDirectory())
      listFixtures(p, fixtures);
    else if (item.isFile() && p.endsWith('-actual.png'))
      fixtures.add(p.substring(0, p.length - '-actual.png'.length));
  }
  return fixtures;
}

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function declareFixtureTest(fixtureRoot: string, fixtureName: string, shouldMatch: boolean) {
  test(path.relative(fixtureRoot, fixtureName), async ({}, testInfo) => {
    const [actual, expected] = await Promise.all([
      fs.promises.readFile(fixtureName + '-actual.png'),
      fs.promises.readFile(fixtureName + '-expected.png'),
    ]);
    await testInfo.attach(fixtureName + '-actual.png', {
      body: actual,
      contentType: 'image/png',
    });
    await testInfo.attach(fixtureName + '-expected.png', {
      body: expected,
      contentType: 'image/png',
    });
    const actualPNG = PNG.sync.read(actual);
    const expectedPNG = PNG.sync.read(expected);
    expect(actualPNG.width).toBe(expectedPNG.width);
    expect(actualPNG.height).toBe(expectedPNG.height);

    const diffPNG = new PNG({ width: actualPNG.width, height: actualPNG.height });
    const diffCount = compare(actualPNG.data, expectedPNG.data, diffPNG.data, actualPNG.width, actualPNG.height, {
      maxColorDeltaE94: 1.0,
    });

    await testInfo.attach(fixtureName + '-diff.png', {
      body: PNG.sync.write(diffPNG),
      contentType: 'image/png',
    });

    if (shouldMatch)
      expect(diffCount).toBe(0);
    else
      expect(diffCount).not.toBe(0);
  });
}

test.describe('basic fixtures', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const fixtureName of listFixtures(path.join(FIXTURES_DIR, 'should-match')))
    declareFixtureTest(FIXTURES_DIR, fixtureName, true /* shouldMatch */);
  for (const fixtureName of listFixtures(path.join(FIXTURES_DIR, 'should-fail')))
    declareFixtureTest(FIXTURES_DIR, fixtureName, false /* shouldMatch */);
});

const customImageToolsFixtures = process.env.IMAGE_TOOLS_FIXTURES;
if (customImageToolsFixtures) {
  test.describe('custom fixtures', () => {
    test.describe.configure({ mode: 'parallel' });

    for (const fixtureName of listFixtures(path.join(customImageToolsFixtures, 'should-match')))
      declareFixtureTest(customImageToolsFixtures, fixtureName, true /* shouldMatch */);
    for (const fixtureName of listFixtures(path.join(customImageToolsFixtures, 'should-fail')))
      declareFixtureTest(customImageToolsFixtures, fixtureName, false /* shouldMatch */);
  });
}
