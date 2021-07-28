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
  MatcherHintOptions
} from 'jest-matcher-utils';
import { Locator } from '../../..';
import { currentTestInfo } from '../globals';
import type { Expect } from '../types';
import { expectLocator, monotonicTime, pollUntilDeadline } from '../util';

async function toBeTruthyImpl<T>(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  locator: Locator,
  query: (timeout: number) => Promise<T>,
  options: { timeout?: number } = {},
) {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`${matcherName} must be called during the test`);
  expectLocator(locator, matcherName);

  const matcherOptions: MatcherHintOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  let received: T;
  let pass = false;
  const timeout = options.timeout === 0 ? 0 : options.timeout || testInfo.timeout;
  const deadline = timeout ? monotonicTime() + timeout : 0;

  // TODO: interrupt on timeout for nice message.
  await pollUntilDeadline(async () => {
    const remainingTime = deadline ? deadline - monotonicTime() : 0;
    received = await query(remainingTime);
    pass = !!received;
    return pass === !matcherOptions.isNot;
  }, deadline, 100);

  const message = () => {
    return matcherHint(matcherName, undefined, '', matcherOptions);
  };

  return { message, pass };
}

export async function toBeChecked(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeChecked', locator, async timeout => {
    return await locator.isChecked({ timeout });
  }, options);
}

export async function toBeEditable(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeEditable', locator, async timeout => {
    return await locator.isEditable({ timeout });
  }, options);
}

export async function toBeEnabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeEnabled', locator, async timeout => {
    return await locator.isEnabled({ timeout });
  }, options);
}

export async function toBeDisabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeDisabled', locator, async timeout => {
    return await locator.isDisabled({ timeout });
  }, options);
}

export async function toBeEmpty(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeEmpty', locator, async timeout => {
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
  return toBeTruthyImpl.call(this, 'toBeHidden', locator, async timeout => {
    return await locator.isHidden({ timeout });
  }, options);
}

export async function toBeVisible(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeVisible', locator, async timeout => {
    return await locator.isVisible({ timeout });
  }, options);
}

export async function toBeFocused(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeFocused', locator, async timeout => {
    return await locator.evaluate(element => {
      return document.activeElement === element;
    }, { timeout });
  }, options);
}

export async function toBeSelected(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthyImpl.call(this, 'toBeSelected', locator, async timeout => {
    return await locator.evaluate(element => {
      return (element as HTMLOptionElement).selected;
    }, { timeout });
  }, options);
}
