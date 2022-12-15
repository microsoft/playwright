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

import type { ByRoleOptions } from '../../utils/isomorphic/locatorUtils';
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByRoleSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from '../../utils/isomorphic/locatorUtils';
import { escapeForTextSelector } from '../../utils/isomorphic/stringUtils';
import { asLocator } from '../isomorphic/locatorGenerators';
import type { Language } from '../isomorphic/locatorGenerators';
import { type InjectedScript } from './injectedScript';
import { generateSelector } from './selectorGenerator';

const selectorSymbol = Symbol('selector');
const injectedScriptSymbol = Symbol('injectedScript');

class Locator {
  element: Element | undefined;
  elements: Element[] | undefined;

  constructor(injectedScript: InjectedScript, selector: string, options?: { hasText?: string | RegExp, has?: Locator }) {
    (this as any)[selectorSymbol] = selector;
    (this as any)[injectedScriptSymbol] = injectedScript;
    if (options?.hasText)
      selector += ` >> internal:has-text=${escapeForTextSelector(options.hasText, false)}`;
    if (options?.has)
      selector += ` >> internal:has=` + JSON.stringify((options.has as any)[selectorSymbol]);
    if (selector) {
      const parsed = injectedScript.parseSelector(selector);
      this.element = injectedScript.querySelector(parsed, document, false);
      this.elements = injectedScript.querySelectorAll(parsed, document);
    }
    const selectorBase = selector;
    const self = this as any;
    self.locator = (selector: string, options?: { hasText?: string | RegExp, has?: Locator }): Locator => {
      return new Locator(injectedScript, selectorBase ? selectorBase + ' >> ' + selector : selector, options);
    };
    self.getByTestId = (testId: string): Locator => self.locator(getByTestIdSelector(injectedScript.testIdAttributeNameForStrictErrorAndConsoleCodegen(), testId));
    self.getByAltText = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByAltTextSelector(text, options));
    self.getByLabel = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByLabelSelector(text, options));
    self.getByPlaceholder = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByPlaceholderSelector(text, options));
    self.getByText = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByTextSelector(text, options));
    self.getByTitle = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByTitleSelector(text, options));
    self.getByRole = (role: string, options: ByRoleOptions = {}): Locator => self.locator(getByRoleSelector(role, options));
    self.filter = (options?: { hasText?: string | RegExp, has?: Locator }): Locator => new Locator(injectedScript, selector, options);
  }
}

declare global {
  interface Window {
    playwright?: any;
    inspect: (element: Element | undefined) => void;
    __pw_resume: () => Promise<void>;
  }
}

class ConsoleAPI {
  private _injectedScript: InjectedScript;

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;
    if (window.playwright)
      return;
    window.playwright = {
      $: (selector: string, strict?: boolean) => this._querySelector(selector, !!strict),
      $$: (selector: string) => this._querySelectorAll(selector),
      inspect: (selector: string) => this._inspect(selector),
      selector: (element: Element) => this._selector(element),
      generateLocator: (element: Element, language?: Language) => this._generateLocator(element, language),
      resume: () => this._resume(),
      ...new Locator(injectedScript, ''),
    };
    delete window.playwright.filter;
  }

  private _querySelector(selector: string, strict: boolean): (Element | undefined) {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.query('Playwright >> selector').`);
    const parsed = this._injectedScript.parseSelector(selector);
    return this._injectedScript.querySelector(parsed, document, strict);
  }

  private _querySelectorAll(selector: string): Element[] {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.$$('Playwright >> selector').`);
    const parsed = this._injectedScript.parseSelector(selector);
    return this._injectedScript.querySelectorAll(parsed, document);
  }

  private _inspect(selector: string) {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.inspect('Playwright >> selector').`);
    window.inspect(this._querySelector(selector, false));
  }

  private _selector(element: Element) {
    if (!(element instanceof Element))
      throw new Error(`Usage: playwright.selector(element).`);
    return generateSelector(this._injectedScript, element, this._injectedScript.testIdAttributeNameForStrictErrorAndConsoleCodegen()).selector;
  }

  private _generateLocator(element: Element, language?: Language) {
    if (!(element instanceof Element))
      throw new Error(`Usage: playwright.locator(element).`);
    const selector = generateSelector(this._injectedScript, element, this._injectedScript.testIdAttributeNameForStrictErrorAndConsoleCodegen()).selector;
    return asLocator(language || 'javascript', selector);
  }

  private _resume() {
    window.__pw_resume().catch(() => {});
  }
}

module.exports = ConsoleAPI;
