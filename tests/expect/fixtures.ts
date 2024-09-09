/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import fs from 'fs';
import { ansi2Markup } from 'tests/config/utils';
import { expect as baseExpect } from '../playwright-test/stable-test-runner';
import { test } from '../playwright-test/stable-test-runner';
export { test } from '../playwright-test/stable-test-runner';

const ordinals = new Map<string, number>();
const snapshotFiles = new Set<string>();

function checkExpectation(unformatted: string, inlineExpected?: string) {
  const actual = ansi2Markup(unformatted);
  const file = test.info().file.replace('.test.ts', '.snapshots.js');
  const fullKey = test.info().titlePath.join('|');
  const ordinal = ordinals.get(fullKey) || 0;
  ordinals.set(fullKey, ordinal + 1);

  const key = test.info().titlePath.slice(1).join(' ') + (ordinal ? ` #${ordinal}` : '');

  if (!inlineExpected && test.info().config.updateSnapshots === 'all') {
    if (!snapshotFiles.has(file)) {
      fs.writeFileSync(file, '');
      snapshotFiles.add(file);
    }
    const line = `module.exports[${JSON.stringify(key)}] = \`${actual.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`;\n\n`;
    fs.appendFileSync(file, line);
    return { message: () => '', pass: true };
  }

  let expected: string;
  if (inlineExpected) {
    expected = inlineExpected;
  } else {
    const data = require(file);
    expected = data[key];
  }

  let pass: boolean;
  let matcherResult: any;
  try {
    baseExpect(actual).toBe(expected);
    pass = true;
  } catch (e: any) {
    matcherResult = e.matcherResult;
    pass = false;
  }

  const expectOptions = {
    isNot: this.isNot,
  };

  const message = pass
    ? () => this.utils.matcherHint('toBe', actual, expected, expectOptions) +
        '\n\n' +
        `Expected: ${this.isNot ? 'not' : ''}${this.utils.printExpected(expected)}\n` +
        (matcherResult ? `Received: ${this.utils.printReceived(matcherResult.actual)}` : '')
    : () =>  this.utils.matcherHint('toBe', actual, expected, expectOptions) +
        '\n\n' +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        (matcherResult ? `Received: ${this.utils.printReceived(matcherResult.actual)}` : '');

  return {
    name: 'toThrowErrorMatching',
    expected,
    message,
    pass,
    actual: matcherResult?.actual,
  };
}

export const expect = baseExpect.extend({
  toMatchSnapshot(message: string, expected?: string) {
    return checkExpectation.call(this, message, expected);
  },

  toThrowErrorMatchingSnapshot(callback: () => any, expected?: string) {
    try {
      callback();
    } catch (e) {
      return checkExpectation.call(this, e.message, expected);
    }
    throw new Error('Expected function to throw, but it did not');
  },

  async toThrowErrorMatchingSnapshotAsync(callback: () => Promise<any>, expected?: string) {
    try {
      await callback();
    } catch (e) {
      return checkExpectation.call(this, e.message, expected);
    }
    throw new Error('Expected function to throw, but it did not');
  }
});
