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

import { ParsedSelector, parseSelector } from '../../server/common/selectorParser';
import type InjectedScript from '../../server/injected/injectedScript';

export class ConsoleAPI {
  private _injectedScript: InjectedScript;

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;
    (window as any).playwright = {
      $: (selector: string) => this._querySelector(selector),
      $$: (selector: string) => this._querySelectorAll(selector),
      inspect: (selector: string) => this._inspect(selector),
    };
  }

  private _checkSelector(parsed: ParsedSelector) {
    for (const {name} of parsed.parts) {
      if (!this._injectedScript.engines.has(name))
        throw new Error(`Unknown engine "${name}"`);
    }
  }

  _querySelector(selector: string): (Element | undefined) {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.query('Playwright >> selector').`);
    const parsed = parseSelector(selector);
    this._checkSelector(parsed);
    const elements = this._injectedScript.querySelectorAll(parsed, document);
    return elements[0];
  }

  _querySelectorAll(selector: string): Element[] {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.$$('Playwright >> selector').`);
    const parsed = parseSelector(selector);
    this._checkSelector(parsed);
    const elements = this._injectedScript.querySelectorAll(parsed, document);
    return elements;
  }

  _inspect(selector: string) {
    if (typeof (window as any).inspect !== 'function')
      return;
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.inspect('Playwright >> selector').`);
    (window as any).inspect(this._querySelector(selector));
  }
}
