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

import { asLocator } from '@isomorphic/locatorGenerators';
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByRoleSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from '@isomorphic/locatorUtils';
import { escapeForTextSelector } from '@isomorphic/stringUtils';

import type { InjectedScript } from './injectedScript';
import type { Language } from '@isomorphic/locatorGenerators';
import type { ByRoleOptions } from '@isomorphic/locatorUtils';

const selectorSymbol = Symbol('selector');

class Locator {
  [selectorSymbol]: string;
  element: Element | undefined;
  elements: Element[] | undefined;

  constructor(injectedScript: InjectedScript, selector: string, options?: { hasText?: string | RegExp, hasNotText?: string | RegExp, has?: Locator, hasNot?: Locator, visible?: boolean }) {
    if (options?.hasText)
      selector += ` >> internal:has-text=${escapeForTextSelector(options.hasText, false)}`;
    if (options?.hasNotText)
      selector += ` >> internal:has-not-text=${escapeForTextSelector(options.hasNotText, false)}`;
    if (options?.has)
      selector += ` >> internal:has=` + JSON.stringify(options.has[selectorSymbol]);
    if (options?.hasNot)
      selector += ` >> internal:has-not=` + JSON.stringify(options.hasNot[selectorSymbol]);
    if (options?.visible !== undefined)
      selector += ` >> visible=${options.visible ? 'true' : 'false'}`;
    this[selectorSymbol] = selector;
    if (selector) {
      const parsed = injectedScript.parseSelector(selector);
      this.element = injectedScript.querySelector(parsed, injectedScript.document, false);
      this.elements = injectedScript.querySelectorAll(parsed, injectedScript.document);
    }
    const selectorBase = selector;
    const self = this as any;
    self.locator = (selector: string, options?: { hasText?: string | RegExp, hasNotText?: string | RegExp, has?: Locator, hasNot?: Locator }): Locator => {
      return new Locator(injectedScript, selectorBase ? selectorBase + ' >> ' + selector : selector, options);
    };
    self.getByTestId = (testId: string): Locator => self.locator(getByTestIdSelector(injectedScript.testIdAttributeNameForStrictErrorAndConsoleCodegen(), testId));
    self.getByAltText = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByAltTextSelector(text, options));
    self.getByLabel = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByLabelSelector(text, options));
    self.getByPlaceholder = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByPlaceholderSelector(text, options));
    self.getByText = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByTextSelector(text, options));
    self.getByTitle = (text: string | RegExp, options?: { exact?: boolean }): Locator => self.locator(getByTitleSelector(text, options));
    self.getByRole = (role: string, options: ByRoleOptions = {}): Locator => self.locator(getByRoleSelector(role, options));
    self.filter = (options?: { hasText?: string | RegExp, hasNotText?: string | RegExp, has?: Locator, hasNot?: Locator, visible?: boolean }): Locator => new Locator(injectedScript, selector, options);
    self.first = (): Locator => self.locator('nth=0');
    self.last = (): Locator => self.locator('nth=-1');
    self.nth = (index: number): Locator => self.locator(`nth=${index}`);
    self.and = (locator: Locator): Locator => new Locator(injectedScript, selectorBase + ` >> internal:and=` + JSON.stringify(locator[selectorSymbol]));
    self.or = (locator: Locator): Locator => new Locator(injectedScript, selectorBase + ` >> internal:or=` + JSON.stringify(locator[selectorSymbol]));
  }
}

declare global {
  interface Window {
    playwright?: any;
    inspect: (element: Element | undefined) => void;
    __pw_resume: () => Promise<void>;
  }
}

export class ConsoleAPI {
  private _injectedScript: InjectedScript;

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;
  }

  install() {
    if (this._injectedScript.window.playwright)
      return;
    this._injectedScript.window.playwright = {
      $: (selector: string, strict?: boolean) => this._querySelector(selector, !!strict),
      $$: (selector: string) => this._querySelectorAll(selector),
      inspect: (selector: string) => this._inspect(selector),
      selector: (element: Element) => this._selector(element),
      generateLocator: (element: Element, language?: Language) => this._generateLocator(element, language),
      ariaSnapshot: (element?: Element, options?: { forAI?: boolean }) => {
        return this._injectedScript.ariaSnapshot(element || this._injectedScript.document.body, options);
      },
      resume: () => this._resume(),
      ...new Locator(this._injectedScript, ''),
    };
    delete this._injectedScript.window.playwright.filter;
    delete this._injectedScript.window.playwright.first;
    delete this._injectedScript.window.playwright.last;
    delete this._injectedScript.window.playwright.nth;
    delete this._injectedScript.window.playwright.and;
    delete this._injectedScript.window.playwright.or;
  }

  private _querySelector(selector: string, strict: boolean): (Element | undefined) {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.query('Playwright >> selector').`);
    const parsed = this._injectedScript.parseSelector(selector);
    return this._injectedScript.querySelector(parsed, this._injectedScript.document, strict);
  }

  private _querySelectorAll(selector: string): Element[] {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.$$('Playwright >> selector').`);
    const parsed = this._injectedScript.parseSelector(selector);
    return this._injectedScript.querySelectorAll(parsed, this._injectedScript.document);
  }

  private _inspect(selector: string) {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.inspect('Playwright >> selector').`);
    this._injectedScript.window.inspect(this._querySelector(selector, false));
  }

  private _selector(element: Element) {
    if (!(element instanceof Element))
      throw new Error(`Usage: playwright.selector(element).`);
    return this._injectedScript.generateSelectorSimple(element);
  }

  private _generateLocator(element: Element, language?: Language) {
    if (!(element instanceof Element))
      throw new Error(`Usage: playwright.locator(element).`);
    const selector = this._injectedScript.generateSelectorSimple(element);
    return asLocator(language || 'javascript', selector);
  }

  private _resume() {
    this._injectedScript.window.__pw_resume().catch(() => {});
  }
}
