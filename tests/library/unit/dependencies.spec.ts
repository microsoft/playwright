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

import { test, expect } from '@playwright/test';
import { parseMissingPackages } from '../../../packages/playwright-core/src/server/registry/dependencies';

// The two fixtures below mirror the relevant lines of real output from
// `apt-get install -s --no-install-recommends` on Debian 13 (trixie), apt
// 3.0.3. They are not hand-crafted. The parser only reads the `Inst <pkg>`
// lines, so the exact package names and versions are irrelevant to the
// assertion. The surrounding lines (Conf, Suggested packages) mirror what the
// real command prints.

test('parseMissingPackages returns empty when nothing would be installed', () => {
  // Real output when every requested package is already present.
  const stdout = [
    'libnss3 is already the newest version (2:3.110-1+deb13u4).',
    'libatomic1 is already the newest version (14.2.0-19).',
    '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.',
    '',
  ].join('\n');
  expect(parseMissingPackages(stdout)).toEqual([]);
});

test('parseMissingPackages extracts only the Inst lines', () => {
  // Real output for two missing packages (apt-get install -s zzuf unhide).
  const stdout = [
    'Suggested packages:',
    '  rkhunter',
    'The following NEW packages will be installed:',
    '  unhide zzuf',
    '0 upgraded, 2 newly installed, 0 to remove and 0 not upgraded.',
    'Inst unhide (20240510-2 Debian:13.7/stable [amd64])',
    'Inst zzuf (0.15-5+b1 Debian:13.7/stable [amd64])',
    'Conf unhide (20240510-2 Debian:13.7/stable [amd64])',
    'Conf zzuf (0.15-5+b1 Debian:13.7/stable [amd64])',
    '',
  ].join('\n');
  // Only `Inst <pkg>` lines count as missing. `Conf` lines are the follow-up
  // configure step for already-declared packages and must not be duplicated.
  expect(parseMissingPackages(stdout)).toEqual(['unhide', 'zzuf']);
});
