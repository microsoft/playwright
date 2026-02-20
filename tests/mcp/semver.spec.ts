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
import { compareSemver } from '../../packages/playwright/lib/cli/client/socketConnection';

test('compareSemver', () => {
  // Stable versions.
  expect(compareSemver('1.59.0', '1.58.0')).toBe(1);
  expect(compareSemver('1.58.0', '1.59.0')).toBe(-1);
  expect(compareSemver('1.58.2', '1.58.2')).toBe(0);
  expect(compareSemver('1.58.2', '1.58.1')).toBe(1);

  // Different base versions ignore suffix.
  expect(compareSemver('1.59.0-alpha-2026-02-16', '1.58.0')).toBe(1);
  expect(compareSemver('1.58.0', '1.59.0-alpha-1771260841000')).toBe(-1);

  // Stable beats alpha/beta at same version.
  expect(compareSemver('1.59.0', '1.59.0-alpha-2026-02-16')).toBe(1);
  expect(compareSemver('1.59.0-alpha-2026-02-16', '1.59.0')).toBe(-1);
  expect(compareSemver('1.59.0', '1.59.0-beta-1771260841000')).toBe(1);
  expect(compareSemver('1.59.0-beta-1771260841000', '1.59.0')).toBe(-1);

  // Daily alphas compared by date.
  expect(compareSemver('1.59.0-alpha-2026-02-16', '1.59.0-alpha-2026-02-15')).toBe(1);
  expect(compareSemver('1.59.0-alpha-2026-02-15', '1.59.0-alpha-2026-02-16')).toBe(-1);
  expect(compareSemver('1.59.0-alpha-2026-02-16', '1.59.0-alpha-2026-02-16')).toBe(0);

  // Nightly timestamps.
  expect(compareSemver('1.59.0-alpha-1771260841000', '1.59.0-alpha-1771260840000')).toBe(1);
  expect(compareSemver('1.59.0-alpha-1771260840000', '1.59.0-alpha-1771260841000')).toBe(-1);
  expect(compareSemver('1.59.0-alpha-1771260841000', '1.59.0-alpha-1771260841000')).toBe(0);

  // Daily alpha vs nightly timestamp (date normalizes to ms).
  expect(compareSemver('1.59.0-alpha-1771260841000', '1.59.0-alpha-2026-02-16')).toBe(1);
  expect(compareSemver('1.59.0-alpha-2026-02-16', '1.59.0-alpha-1771260841000')).toBe(-1);

  // Beta suffixes.
  expect(compareSemver('1.59.0-beta-1771260841000', '1.59.0-beta-1771260840000')).toBe(1);
  expect(compareSemver('1.59.0-beta-2026-02-16', '1.59.0-beta-2026-02-15')).toBe(1);
});
