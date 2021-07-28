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

import {
  matcherHint,
  MatcherHintOptions,
  printReceived
} from 'jest-matcher-utils';
import { Locator } from '../../..';
import { currentTestInfo } from '../globals';
import type { Expect } from '../types';
import { monotonicTime, pollUntilDeadline } from '../util';


async function toBeTruthyImpl(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  query: (timeout: number) => Promise<boolean>,
  options: { timeout?: number } = {},
) {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchSnapshot() must be called during the test`);

  const matcherOptions: MatcherHintOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  let received: boolean;
  let pass = false;
  const timeout = options.timeout === 0 ? 0 : options.timeout || testInfo.timeout;
  const deadline = timeout ? monotonicTime() + timeout : 0;

  try {
    await pollUntilDeadline(async () => {
      const remainingTime = deadline ? deadline - monotonicTime() : 0;
      received = await query(remainingTime);
      pass = !!received;
      return pass === !matcherOptions.isNot;
    }, deadline, 100);
  } catch (e) {
    pass = false;
  }

  const message = () =>
    matcherHint(matcherName, undefined, '', matcherOptions) +
      '\n\n' +
      `Received: ${printReceived(received)}`;

  return { message, pass };
}

export async function toBeChecked(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeChecked', async timeout => {
    return await locator.isChecked({ timeout });
  }, options);
}

export async function toBeEditable(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeEditable', async timeout => {
    return await locator.isEditable({ timeout });
  }, options);
}

export async function toBeEnabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeEnabled', async timeout => {
    return await locator.isEnabled({ timeout });
  }, options);
}

export async function toBeDisabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeDisabled', async timeout => {
    return await locator.isDisabled({ timeout });
  }, options);
}

export async function toBeEmpty(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeEmpty', async timeout => {
    return await locator.evaluate(element => {
      if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA')
        return !(element as HTMLInputElement).value;
      return !element.textContent?.trim();
    }, { timeout });
  }, options);
}

export async function toBeHidden(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeHidden', async timeout => {
    return await locator.isHidden({ timeout });
  }, options);
}

export async function toBeVisible(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeVisible', async timeout => {
    return await locator.isVisible({ timeout });
  }, options);
}

export async function toBeFocused(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeFocused', async timeout => {
    return await locator.evaluate(element => {
      return document.activeElement === element;
    }, { timeout });
  }, options);
}
