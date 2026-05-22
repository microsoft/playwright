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

export type WebViewExpectation = 'pass' | 'fail' | 'flaky' | 'timeout' | 'skip' | 'unknown';

// 'skip' means "known to pass in a prior run, fast-forward past it" — distinct
// from 'fail' which marks a real expected failure.
const SKIP_OUTCOMES = new Set<WebViewExpectation>(['fail', 'flaky', 'timeout', 'skip']);

export function loadWebViewExpectations(projectName: string): Map<string, WebViewExpectation> {
  const result = new Map<string, WebViewExpectation>();
  const file = path.join(__dirname, 'expectations', `${projectName}.txt`);
  loadInto(result, file);
  return result;
}

function loadInto(result: Map<string, WebViewExpectation>, file: string): void {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#'))
      continue;
    const match = /^(?<key>.+) \[(?<outcome>[^\]]+)\]$/.exec(trimmed);
    if (!match) {
      console.error(`webview expectations: bad line "${line}"`);
      continue;
    }
    result.set(match.groups!.key, match.groups!.outcome as WebViewExpectation);
  }
}

export function shouldSkipWebViewTest(titlePath: string[], expectations: Map<string, WebViewExpectation>): WebViewExpectation | undefined {
  // Test names that intentionally include trailing whitespace (e.g.
  // `it('should emulate forcedColors ', ...)`) would never match because our
  // parser strips trailing whitespace from the skip file. Normalize at lookup
  // time on both ends.
  const key = titlePath.join(' › ').replace(/\s+$/, '');
  // Exact-match first.
  const direct = expectations.get(key);
  if (direct && SKIP_OUTCOMES.has(direct))
    return direct;
  // Fall back to prefix-match: when the parser captured a `it.step` child as
  // the failure key (e.g. `parent › "case A" foo`), the runtime titlePath only
  // goes up to the parent. Treat any child entry as a skip for the parent.
  const prefix = key + ' › ';
  for (const [otherKey, outcome] of expectations) {
    if (otherKey.startsWith(prefix) && SKIP_OUTCOMES.has(outcome))
      return outcome;
  }
  return undefined;
}
