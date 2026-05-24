/**
 * Copyright Microsoft Corporation. All rights reserved.
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


import fs from 'fs';
import path from 'path';

import { escapeTemplateString, isString } from '@isomorphic/stringUtils';
import { existsAsync } from '@utils/fileUtils';

import { expectTypes, formatMatcherMessage, printReceivedStringContainExpectedSubstring } from './matcherHint';
import { expectConfig } from './expect';

import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherStateInternal, FrameEx, LocatorEx } from './matchers';
import type { MatcherReceived } from '@injected/ariaSnapshot';
import type { Page } from 'playwright-core';


type ToMatchAriaSnapshotExpected = {
  name?: string;
  path?: string;
  timeout?: number;
} | string;

const kImpossibleAriaMatch = `- none "Generating new baseline"`;

export async function toMatchAriaSnapshot(
  this: ExpectMatcherStateInternal,
  receiver: LocatorEx | Page,
  expectedParam?: ToMatchAriaSnapshotExpected,
  options: { timeout?: number } = {},
): Promise<MatcherResult<string | RegExp, string>> {
  const matcherName = 'toMatchAriaSnapshot';
  expectTypes(receiver, ['Page', 'Locator'], matcherName);
  const locator = (receiver as any)._apiName === 'Page' ? undefined : receiver as LocatorEx;

  const testInfo = expectConfig().testInfo;
  if (!testInfo)
    throw new Error(`${matcherName}() must be called during the test`);

  if (expectConfig().ignoreSnapshots)
    return { pass: !this.isNot, message: () => '', name: 'toMatchAriaSnapshot', expected: '' };

  const updateSnapshots = expectConfig().updateSnapshots;

  let expected: string;
  let timeout: number;
  let expectedPath: string | undefined;
  if (isString(expectedParam)) {
    expected = expectedParam;
    timeout = options.timeout ?? this.timeout;
  } else {
    const legacyPath = testInfo._resolveSnapshotPaths('aria', expectedParam?.name, 'dontUpdateSnapshotIndex', '.yml').absoluteSnapshotPath;
    expectedPath = testInfo._resolveSnapshotPaths('aria', expectedParam?.name, 'updateSnapshotIndex').absoluteSnapshotPath;
    // in 1.51, we changed the default template to use .aria.yml extension
    // for backwards compatibility, we check for the legacy .yml extension
    if (!(await existsAsync(expectedPath)) && await existsAsync(legacyPath))
      expectedPath = legacyPath;
    expected = await fs.promises.readFile(expectedPath, 'utf8').catch(() => '');
    timeout = expectedParam?.timeout ?? this.timeout;
  }

  const isMissingBaseline = updateSnapshots === 'missing' && !expected;
  if (isMissingBaseline && this.isNot) {
    const message = `Matchers using ".not" can't generate new baselines`;
    return { pass: this.isNot, message: () => message, name: 'toMatchAriaSnapshot' };
  }
  const generateBaseline = !this.isNot && (updateSnapshots === 'all' || isMissingBaseline);
  if (generateBaseline) {
    // When generating new baseline, run entire pipeline against impossible match.
    expected = kImpossibleAriaMatch;
  }

  expected = unshift(expected);

  const globalChildren = expectConfig().toMatchAriaSnapshot?.children;
  if (globalChildren && !expected.match(/^- \/children:/m))
    expected = `- /children: ${globalChildren}\n` + expected;

  const expectParams = { expectedValue: expected, isNot: this.isNot, timeout };
  const { matches: pass, received, log, timedOut, errorMessage } = locator ?
    await (locator as LocatorEx)._expect('to.match.aria', expectParams) :
    await ((receiver as Page).mainFrame() as FrameEx)._expect('to.match.aria', expectParams);
  const typedReceived = received?.value as MatcherReceived;

  const message = () => {
    let printedExpected: string | undefined;
    let printedReceived: string | undefined;
    let printedDiff: string | undefined;
    if (errorMessage) {
      printedExpected = `Expected: ${this.isNot ? 'not ' : ''}${this.utils.printExpected(expected)}`;
    } else if (pass) {
      const receivedString = printReceivedStringContainExpectedSubstring(this.utils, typedReceived.raw, typedReceived.raw.indexOf(expected), expected.length);
      printedExpected = `Expected: not ${this.utils.printExpected(expected)}`;
      printedReceived = `Received: ${receivedString}`;
    } else {
      const receivedForDiff = mergeRegexMatchedLines(expected, typedReceived.raw);
      printedDiff = this.utils.printDiffOrStringify(expected, receivedForDiff, 'Expected', 'Received', false);
    }
    return formatMatcherMessage(this.utils, {
      isNot: this.isNot,
      promise: this.promise,
      matcherName,
      expectation: 'expected',
      locator: locator?.toString(),
      timeout,
      timedOut,
      printedExpected,
      printedReceived,
      printedDiff,
      errorMessage,
      log,
    });
  };

  if (errorMessage)
    return { pass: this.isNot, message, name: 'toMatchAriaSnapshot', expected };

  if (!this.isNot) {
    if (generateBaseline || (updateSnapshots === 'changed' && pass === this.isNot)) {
      if (expectedPath) {
        await fs.promises.mkdir(path.dirname(expectedPath), { recursive: true });
        await fs.promises.writeFile(expectedPath, typedReceived.regex, 'utf8');
        const relativePath = path.relative(process.cwd(), expectedPath);
        if (isMissingBaseline) {
          const message = `A snapshot doesn't exist at ${relativePath}, writing actual.`;
          return { pass: true, message: () => '', name: 'toMatchAriaSnapshot', softError: new Error(message), shouldNotRetryTest: true };
        }
        const message = `A snapshot is generated at ${relativePath}.`;
        /* eslint-disable no-console */
        console.log(message);
        return { pass: true, message: () => '', name: 'toMatchAriaSnapshot' };
      } else {
        const suggestedRebaseline = `\`\n${escapeTemplateString(indent(typedReceived.regex, '{indent}  '))}\n{indent}\``;
        if (isMissingBaseline) {
          const message = 'A snapshot is not provided, generating new baseline.';
          return { pass: true, message: () => '', name: 'toMatchAriaSnapshot', suggestedRebaseline, softError: new Error(message), shouldNotRetryTest: true };
        }
        return { pass: true, message: () => '', name: 'toMatchAriaSnapshot', suggestedRebaseline };
      }
    }
  }

  return {
    name: matcherName,
    expected,
    message,
    pass,
    actual: typedReceived?.raw,
    log,
    timeout: timedOut ? timeout : undefined,
  };
}

function unshift(snapshot: string): string {
  const lines = snapshot.split('\n');
  let whitespacePrefixLength = 100;
  for (const line of lines) {
    if (!line.trim())
      continue;
    const match = line.match(/^(\s*)/);
    if (match && match[1].length < whitespacePrefixLength)
      whitespacePrefixLength = match[1].length;
  }
  return lines.filter(t => t.trim()).map(line => line.substring(whitespacePrefixLength)).join('\n');
}

function indent(snapshot: string, indent: string): string {
  return snapshot.split('\n').map(line => indent + line).join('\n');
}

// Rewrites `received` so that any line that the corresponding `expected`
// line's regexes match is replaced with the expected line verbatim. The
// downstream jest text differ then treats those lines as unchanged context
// rather than -/+ noise, which keeps the real mismatch visible. See #34555.
export function mergeRegexMatchedLines(expected: string, received: string): string {
  const expectedLines = expected.split('\n');
  const receivedLines = received.split('\n');
  const expectedRegexes = expectedLines.map(toFullLineRegex);

  const linesMatch = (i: number, j: number): boolean => {
    if (expectedLines[i] === receivedLines[j])
      return true;
    const regex = expectedRegexes[i];
    return !!(regex && regex.test(receivedLines[j]));
  };

  // LCS over equality-or-regex-match keeps alignment robust when lengths drift.
  const n = expectedLines.length;
  const m = receivedLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = linesMatch(i, j) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }

  const result: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (linesMatch(i, j)) {
      result.push(expectedLines[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      result.push(receivedLines[j]);
      j++;
    }
  }
  while (j < m)
    result.push(receivedLines[j++]);
  return result.join('\n');
}

// Builds a full-line RegExp from an expected aria-snapshot line. Any `/.../`
// segments outside of quoted strings become regex bodies; everything else is
// matched as plain text. Returns null when the line contains no regex.
function toFullLineRegex(line: string): RegExp | null {
  const escapeMeta = (s: string) => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  let pattern = '';
  let i = 0;
  let inString = false;
  let foundRegex = false;
  while (i < line.length) {
    const ch = line[i];
    if (inString) {
      if (ch === '\\' && i + 1 < line.length) {
        pattern += escapeMeta(ch + line[i + 1]);
        i += 2;
        continue;
      }
      if (ch === '"')
        inString = false;
      pattern += escapeMeta(ch);
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      pattern += escapeMeta(ch);
      i++;
      continue;
    }
    if (ch === '/') {
      const body = readRegexBody(line, i + 1);
      if (body) {
        // Role names render quoted in received output even when the
        // expected line uses the regex form, so allow optional quotes.
        pattern += '"?(?:' + body.source + ')"?';
        i = body.endIndex;
        foundRegex = true;
        continue;
      }
    }
    pattern += escapeMeta(ch);
    i++;
  }
  if (!foundRegex)
    return null;
  try {
    return new RegExp('^' + pattern + '$');
  } catch {
    return null;
  }
}

// Reads a `/.../` body starting just after the opening slash, returning the
// regex source and the index just past the closing slash, or null on no match.
function readRegexBody(line: string, start: number): { source: string, endIndex: number } | null {
  let source = '';
  let escaped = false;
  let inClass = false;
  for (let j = start; j < line.length; j++) {
    const c = line[j];
    if (escaped) {
      source += c;
      escaped = false;
      continue;
    }
    if (c === '\\') {
      source += c;
      escaped = true;
      continue;
    }
    if (c === '[') {
      inClass = true;
      source += c;
      continue;
    }
    if (c === ']' && inClass) {
      inClass = false;
      source += c;
      continue;
    }
    if (c === '/' && !inClass)
      return { source, endIndex: j + 1 };
    source += c;
  }
  return null;
}
