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

import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByRoleSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from './locatorUtils';
import { escapeForTextSelector } from './stringUtils';

import type { ByRoleOptions } from './locatorUtils';

export type ByFilterOptions = {
  has?: By;
  hasNot?: By;
  hasNotText?: string | RegExp;
  hasText?: string | RegExp;
  visible?: boolean;
};

export interface By {
  altText(text: string | RegExp, options?: { exact?: boolean }): By;
  and(by: By): By;
  describe(description: string): By;
  filter(options?: ByFilterOptions): By;
  first(): By;
  get(selectorOrBy: string | By): By;
  label(text: string | RegExp, options?: { exact?: boolean }): By;
  last(): By;
  nth(index: number): By;
  or(by: By): By;
  placeholder(text: string | RegExp, options?: { exact?: boolean }): By;
  role(role: string, options?: ByRoleOptions): By;
  testId(testId: string | RegExp): By;
  text(text: string | RegExp, options?: { exact?: boolean }): By;
  title(text: string | RegExp, options?: { exact?: boolean }): By;
}

type SelectorBuilder = (testIdAttributeName: string) => string;

class ByImpl implements By {
  readonly _build: SelectorBuilder;

  constructor(build: SelectorBuilder) {
    this._build = build;
  }

  private _append(build: SelectorBuilder): ByImpl {
    return new ByImpl(testIdAttributeName => {
      const parent = this._build(testIdAttributeName);
      const child = build(testIdAttributeName);
      return parent ? `${parent} >> ${child}` : child;
    });
  }

  altText(text: string | RegExp, options?: { exact?: boolean }): By {
    return this._append(() => getByAltTextSelector(text, options));
  }

  and(by: By): By {
    return this._append(name => `internal:and=` + JSON.stringify(resolveBy(by, name)));
  }

  describe(description: string): By {
    return this._append(() => `internal:describe=` + JSON.stringify(description));
  }

  filter(options?: ByFilterOptions): By {
    let result: ByImpl = this;
    if (options?.hasText)
      result = result._append(() => `internal:has-text=${escapeForTextSelector(options.hasText!, false)}`);
    if (options?.hasNotText)
      result = result._append(() => `internal:has-not-text=${escapeForTextSelector(options.hasNotText!, false)}`);
    if (options?.has)
      result = result._append(name => `internal:has=` + JSON.stringify(resolveBy(options.has!, name)));
    if (options?.hasNot)
      result = result._append(name => `internal:has-not=` + JSON.stringify(resolveBy(options.hasNot!, name)));
    if (options?.visible !== undefined)
      result = result._append(() => `visible=${options.visible ? 'true' : 'false'}`);
    return result;
  }

  first(): By {
    return this.nth(0);
  }

  get(selectorOrBy: string | By): By {
    return this._append(name => typeof selectorOrBy === 'string' ? selectorOrBy : resolveBy(selectorOrBy, name));
  }

  label(text: string | RegExp, options?: { exact?: boolean }): By {
    return this._append(() => getByLabelSelector(text, options));
  }

  last(): By {
    return this.nth(-1);
  }

  nth(index: number): By {
    return this._append(() => `nth=${index}`);
  }

  or(by: By): By {
    return this._append(name => `internal:or=` + JSON.stringify(resolveBy(by, name)));
  }

  placeholder(text: string | RegExp, options?: { exact?: boolean }): By {
    return this._append(() => getByPlaceholderSelector(text, options));
  }

  role(role: string, options?: ByRoleOptions): By {
    return this._append(() => getByRoleSelector(role, options));
  }

  testId(testId: string | RegExp): By {
    return this._append(name => getByTestIdSelector(name, testId));
  }

  text(text: string | RegExp, options?: { exact?: boolean }): By {
    return this._append(() => getByTextSelector(text, options));
  }

  title(text: string | RegExp, options?: { exact?: boolean }): By {
    return this._append(() => getByTitleSelector(text, options));
  }
}

export const by: By = new ByImpl(() => '');

// The test id attribute is only known once the By is bound to a page, hence the deferred build.
export function resolveBy(by: By, testIdAttributeName: string): string {
  const selector = (by as ByImpl)._build(testIdAttributeName);
  if (!selector)
    throw new Error(`Empty "by" locator. Start with one of by.role(), by.text(), by.testId() and friends.`);
  return selector;
}
