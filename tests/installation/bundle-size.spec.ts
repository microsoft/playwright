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
import fs from 'fs';
import path from 'path';
import { test, expect } from './npmTest';

const THRESHOLDS: Record<string, number> = {
  'playwright-core': 7 * 1024 * 1024,
  'playwright': 3 * 1024 * 1024,
};

for (const [pkg, maxBytes] of Object.entries(THRESHOLDS)) {
  test(`${pkg} tarball stays under ${(maxBytes / 1024 / 1024).toFixed(2)} MB`, async () => {
    const registry = JSON.parse(await fs.promises.readFile(path.join(__dirname, '.registry.json'), 'utf8'));
    const tarball: string = registry[pkg];
    expect(tarball, `no tarball recorded for ${pkg} in .registry.json`).toBeTruthy();
    const { size } = await fs.promises.stat(tarball);
    test.info().annotations.push({ type: 'size', description: `${pkg}: ${size} bytes` });
    expect(size, `${pkg} tarball ${tarball} is ${size} bytes, limit ${maxBytes}`).toBeLessThanOrEqual(maxBytes);
  });
}
