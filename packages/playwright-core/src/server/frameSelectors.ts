/**
 * Copyright (c) Microsoft Corporation.
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

import type { Frame } from './frames';
import type * as types from './types';
import { stringifySelector, type ParsedSelector, splitSelectorByFrame, InvalidSelectorError, visitAllSelectorParts } from '../utils/isomorphic/selectorParser';
import type { FrameExecutionContext, ElementHandle } from './dom';
import type { JSHandle } from './javascript';
import type { InjectedScript } from './injected/injectedScript';
import { asLocator } from '../utils';

export type SelectorInfo = {
  parsed: ParsedSelector,
  world: types.World,
  strict: boolean,
};

export type SelectorInFrame = {
  frame: Frame;
  info: SelectorInfo;
  scope?: ElementHandle;
};

export class FrameSelectors {
  readonly frame: Frame;

  constructor(frame: Frame) {
    this.frame = frame;
  }

  private _parseSelector(selector: string | ParsedSelector, options?: types.StrictOptions): SelectorInfo {
    const strict = typeof options?.strict === 'boolean' ? options.strict : !!this.frame._page.context()._options.strictSelectors;
    return this.frame._page.context().selectors().parseSelector(selector, strict);
  }

  async query(selector: string, options?: types.StrictOptions, scope?: ElementHandle): Promise<ElementHandle<Element> | null> {
    const resolved = await this.resolveInjectedForSelector(selector, options, scope);
    // Be careful, |this.frame| can be different from |resolved.frame|.
    if (!resolved)
      return null;
    const handle = await resolved.injected.evaluateHandle((injected, { info, scope }) => {
      return injected.querySelector(info.parsed, scope || document, info.strict);
    }, { info: resolved.info, scope: resolved.scope });
    const elementHandle = handle.asElement() as ElementHandle<Element> | null;
    if (!elementHandle) {
      handle.dispose();
      return null;
    }
    return adoptIfNeeded(elementHandle, await resolved.frame._mainContext());
  }

  async queryArrayInMainWorld(selector: string, scope?: ElementHandle): Promise<JSHandle<Element[]>> {
    const resolved = await this.resolveInjectedForSelector(selector, { mainWorld: true }, scope);
    // Be careful, |this.frame| can be different from |resolved.frame|.
    if (!resolved)
      throw new Error(`Failed to find frame for selector "${selector}"`);
    return await resolved.injected.evaluateHandle((injected, { info, scope }) => {
      return injected.querySelectorAll(info.parsed, scope || document);
    }, { info: resolved.info, scope: resolved.scope });
  }

  async queryCount(selector: string): Promise<number> {
    const resolved = await this.resolveInjectedForSelector(selector);
    // Be careful, |this.frame| can be different from |resolved.frame|.
    if (!resolved)
      throw new Error(`Failed to find frame for selector "${selector}"`);
    return await resolved.injected.evaluate((injected, { info }) => {
      return injected.querySelectorAll(info.parsed, document).length;
    }, { info: resolved.info });
  }

  async queryAll(selector: string, scope?: ElementHandle): Promise<ElementHandle<Element>[]> {
    const resolved = await this.resolveInjectedForSelector(selector, {}, scope);
    // Be careful, |this.frame| can be different from |resolved.frame|.
    if (!resolved)
      return [];
    const arrayHandle = await resolved.injected.evaluateHandle((injected, { info, scope }) => {
      return injected.querySelectorAll(info.parsed, scope || document);
    }, { info: resolved.info, scope: resolved.scope });

    const properties = await arrayHandle.getProperties();
    arrayHandle.dispose();

    // Note: adopting elements one by one may be slow. If we encounter the issue here,
    // we might introduce 'useMainContext' option or similar to speed things up.
    const targetContext = await resolved.frame._mainContext();
    const result: Promise<ElementHandle<Element>>[] = [];
    for (const property of properties.values()) {
      const elementHandle = property.asElement() as ElementHandle<Element>;
      if (elementHandle)
        result.push(adoptIfNeeded(elementHandle, targetContext));
      else
        property.dispose();
    }
    return Promise.all(result);
  }

  async resolveFrameForSelector(selector: string, options: types.StrictOptions = {}, scope?: ElementHandle): Promise<SelectorInFrame | null> {
    let frame: Frame = this.frame;
    const frameChunks = splitSelectorByFrame(selector);

    for (const chunk of frameChunks) {
      visitAllSelectorParts(chunk, (part, nested) => {
        if (nested && part.name === 'internal:control' && part.body === 'enter-frame') {
          const locator = asLocator(this.frame._page.attribution.playwright.options.sdkLanguage, selector);
          throw new InvalidSelectorError(`Frame locators are not allowed inside composite locators, while querying "${locator}"`);
        }
      });
    }

    for (let i = 0; i < frameChunks.length - 1; ++i) {
      const info = this._parseSelector(frameChunks[i], options);
      const context = await frame._context(info.world);
      const injectedScript = await context.injectedScript();
      const handle = await injectedScript.evaluateHandle((injected, { info, scope, selectorString }) => {
        const element = injected.querySelector(info.parsed, scope || document, info.strict);
        if (element && element.nodeName !== 'IFRAME' && element.nodeName !== 'FRAME')
          throw injected.createStacklessError(`Selector "${selectorString}" resolved to ${injected.previewNode(element)}, <iframe> was expected`);
        return element;
      }, { info, scope: i === 0 ? scope : undefined, selectorString: stringifySelector(info.parsed) });
      const element = handle.asElement() as ElementHandle<Element> | null;
      if (!element)
        return null;
      const maybeFrame = await frame._page._delegate.getContentFrame(element);
      element.dispose();
      if (!maybeFrame)
        return null;
      frame = maybeFrame;
    }
    // If we end up in the different frame, we should start from the frame root, so throw away the scope.
    if (frame !== this.frame)
      scope = undefined;
    return { frame, info: frame.selectors._parseSelector(frameChunks[frameChunks.length - 1], options), scope };
  }

  async resolveInjectedForSelector(selector: string, options?: { strict?: boolean, mainWorld?: boolean }, scope?: ElementHandle): Promise<{ injected: JSHandle<InjectedScript>, info: SelectorInfo, frame: Frame, scope?: ElementHandle } | undefined> {
    const resolved = await this.resolveFrameForSelector(selector, options, scope);
    // Be careful, |this.frame| can be different from |resolved.frame|.
    if (!resolved)
      return;
    const context = await resolved.frame._context(options?.mainWorld ? 'main' : resolved.info.world);
    const injected = await context.injectedScript();
    return { injected, info: resolved.info, frame: resolved.frame, scope: resolved.scope };
  }
}

async function adoptIfNeeded<T extends Node>(handle: ElementHandle<T>, context: FrameExecutionContext): Promise<ElementHandle<T>> {
  if (handle._context === context)
    return handle;
  const adopted = handle._page._delegate.adoptElementHandle(handle, context);
  handle.dispose();
  return adopted;
}
