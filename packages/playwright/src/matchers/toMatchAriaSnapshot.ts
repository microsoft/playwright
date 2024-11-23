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


import type { LocatorEx } from './matchers';
import type { ExpectMatcherState } from '../../types/test';
import { kNoElementsFoundError, matcherHint, type MatcherResult } from './matcherHint';
import { colors } from 'playwright-core/lib/utilsBundle';
import { EXPECTED_COLOR } from '../common/expectBundle';
import { callLogText } from '../util';
import { printReceivedStringContainExpectedSubstring } from './expect';
import { currentTestInfo } from '../common/globals';
import type { MatcherReceived } from '@injected/ariaSnapshot';
import { escapeTemplateString } from 'playwright-core/lib/utils';

export async function toMatchAriaSnapshot(
  this: ExpectMatcherState,
  receiver: LocatorEx,
  expected: string,
  options: { timeout?: number, matchSubstring?: boolean } = {},
): Promise<MatcherResult<string | RegExp, string>> {
  const matcherName = 'toMatchAriaSnapshot';

  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchAriaSnapshot() must be called during the test`);

  if (testInfo._projectInternal.ignoreSnapshots)
    return { pass: !this.isNot, message: () => '', name: 'toMatchAriaSnapshot', expected };

  const updateSnapshots = testInfo.config.updateSnapshots;

  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  if (typeof expected !== 'string') {
    throw new Error([
      matcherHint(this, receiver, matcherName, receiver, expected, matcherOptions),
      `${colors.bold('Matcher error')}: ${EXPECTED_COLOR('expected',)} value must be a string`,
      this.utils.printWithType('Expected', expected, this.utils.printExpected)
    ].join('\n\n'));
  }

  const generateMissingBaseline = updateSnapshots === 'missing' && !expected;
  if (generateMissingBaseline) {
    if (this.isNot) {
      const message = `Matchers using ".not" can't generate new baselines`;
      return { pass: this.isNot, message: () => message, name: 'toMatchAriaSnapshot' };
    } else {
      // When generating new baseline, run entire pipeline against impossible match.
      expected = `- none "Generating new baseline"`;
    }
  }

  const timeout = options.timeout ?? this.timeout;
  expected = unshift(expected);
  const { matches: pass, received, log, timedOut } = await receiver._expect('to.match.aria', { expectedValue: expected, isNot: this.isNot, timeout });
  const typedReceived = received as MatcherReceived | typeof kNoElementsFoundError;

  const messagePrefix = matcherHint(this, receiver, matcherName, 'locator', undefined, matcherOptions, timedOut ? timeout : undefined);
  const notFound = typedReceived === kNoElementsFoundError;
  if (notFound) {
    return {
      pass: this.isNot,
      message: () => messagePrefix + `Expected: ${this.utils.printExpected(expected)}\nReceived: ${EXPECTED_COLOR('<element not found>')}` + callLogText(log),
      name: 'toMatchAriaSnapshot',
      expected,
    };
  }

  const receivedText = typedReceived.raw;
  const message = () => {
    if (pass) {
      if (notFound)
        return messagePrefix + `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${receivedText}` + callLogText(log);
      const printedReceived = printReceivedStringContainExpectedSubstring(receivedText, receivedText.indexOf(expected), expected.length);
      return messagePrefix + `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${printedReceived}` + callLogText(log);
    } else {
      const labelExpected = `Expected`;
      if (notFound)
        return messagePrefix + `${labelExpected}: ${this.utils.printExpected(expected)}\nReceived: ${receivedText}` + callLogText(log);
      return messagePrefix + this.utils.printDiffOrStringify(expected, receivedText, labelExpected, 'Received', false) + callLogText(log);
    }
  };

  if (!this.isNot) {
    if ((updateSnapshots === 'all') ||
        (updateSnapshots === 'changed' && pass === this.isNot) ||
        generateMissingBaseline) {
      const suggestedRebaseline = `toMatchAriaSnapshot(\`\n${escapeTemplateString(indent(typedReceived.regex, '{indent}  '))}\n{indent}\`)`;
      return { pass: this.isNot, message: () => '', name: 'toMatchAriaSnapshot', suggestedRebaseline };
    }
  }

  return {
    name: matcherName,
    expected,
    message,
    pass,
    actual: received,
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
