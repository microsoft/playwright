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

import { InvalidSelectorError,  splitSelectorByFrame, stringifySelector, visitAllSelectorParts } from '@isomorphic/selectorParser';
import { asLocator } from '@isomorphic/locatorGenerators';

import type { ElementHandle, FrameExecutionContext } from './dom';
import type { Frame } from './frames';
import type { InjectedScript } from '@injected/injectedScript';
import type { JSHandle, SmartHandle } from './javascript';
import type * as types from './types';
import type { ParsedSelector } from '@isomorphic/selectorParser';


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

type MatchedElementsCallback<Arg, R> = (data: { injected: InjectedScript, elements: Element[], info: SelectorInfo }, arg: Arg) => R | Promise<R>;

export class FrameSelectors {
  readonly frame: Frame;

  constructor(frame: Frame) {
    this.frame = frame;
  }

  private _parseSelector(selector: string | ParsedSelector, options?: types.StrictOptions): SelectorInfo {
    const strict = typeof options?.strict === 'boolean' ? options.strict : !!this.frame._page.browserContext._options.strictSelectors;
    return this.frame._page.browserContext.selectors().parseSelector(selector, strict);
  }

  async query(selector: string, options?: types.StrictOptions & { mainWorld?: boolean }, scope?: ElementHandle): Promise<ElementHandle<Element> | null> {
    const resolved = await this.callOnSelectorHandle(selector, { ...options, scope }, ({ elements }) => elements[0], {});
    if (!resolved)
      return null;
    const handle = resolved.result;
    const elementHandle = handle.asElement() as ElementHandle<Element> | null;
    if (!elementHandle) {
      handle.dispose();
      return null;
    }
    return adoptIfNeeded(elementHandle, await elementHandle._frame.mainContext());
  }

  async queryArrayInMainWorld(selector: string, scope?: ElementHandle): Promise<JSHandle<Element[]>> {
    const resolved = await this.callOnSelectorHandle(selector, { mainWorld: true, strict: false, scope }, ({ elements }) => elements, {});
    if (!resolved) {
      const context = await this.frame.context('main');
      return await context.evaluateHandle(() => []);
    }
    return resolved.result;
  }

  async queryCount(selector: string): Promise<number> {
    const resolved = await this.callOnSelector(selector, { strict: false }, ({ elements }) => elements.length, {});
    return resolved ? resolved.result : 0;
  }

  async queryAll(selector: string, scope?: ElementHandle): Promise<ElementHandle<Element>[]> {
    const resolved = await this.callOnSelectorHandle(selector, { strict: false, scope }, ({ elements }) => elements, {});
    if (!resolved)
      return [];

    const arrayHandle = resolved.result;
    const properties = await arrayHandle.internalGetProperties();
    const elementHandles: ElementHandle<Element>[] = [];
    for (const property of properties.values()) {
      const elementHandle = property.asElement() as ElementHandle<Element> | null;
      if (elementHandle)
        elementHandles.push(elementHandle);
      else
        property.dispose();
    }
    arrayHandle.dispose();
    if (!elementHandles.length)
      return [];

    // Note: adopting elements one by one may be slow. If we encounter the issue here,
    // we might introduce 'useMainContext' option or similar to speed things up.
    const targetContext = await elementHandles[0]._frame.mainContext();
    return Promise.all(elementHandles.map(handle => adoptIfNeeded(handle, targetContext)));
  }

  private _jumpToAriaRefFrameIfNeeded(selector: string, info: SelectorInfo, frame: Frame): Frame {
    if (info.parsed.parts[0].name !== 'aria-ref')
      return frame;
    const body = info.parsed.parts[0].body as string;
    const match = body.match(/^f(\d+)e\d+$/);
    if (!match)
      return frame;
    const frameSeq = +match[1];
    const jumptToFrame = this.frame._page.frameManager.frames().find(frame => frame.seq === frameSeq);
    if (!jumptToFrame)
      throw new InvalidSelectorError(`Invalid frame in aria-ref selector "${selector}"`);
    return jumptToFrame;
  }

  private async _resolveFrameForSelector(selector: string, options: types.StrictOptions = {}, scope?: ElementHandle): Promise<SelectorInFrame | null> {
    let frame: Frame = this.frame;
    const frameChunks = splitSelectorByFrame(selector);

    for (const chunk of frameChunks) {
      visitAllSelectorParts(chunk, (part, nested) => {
        if (nested && part.name === 'internal:control' && part.body === 'enter-frame') {
          const locator = asLocator(this.frame._page.browserContext._browser.sdkLanguage(), selector);
          throw new InvalidSelectorError(`Frame locators are not allowed inside composite locators, while querying "${locator}"`);
        }
      });
    }

    for (let i = 0; i < frameChunks.length - 1; ++i) {
      const info = this._parseSelector(frameChunks[i], options);
      frame = this._jumpToAriaRefFrameIfNeeded(selector, info, frame);
      const context = await frame.context(info.world);
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
      const maybeFrame = await frame._page.delegate.getContentFrame(element);
      element.dispose();
      if (!maybeFrame)
        return null;
      frame = maybeFrame;
    }
    // If we end up in the different frame, we should start from the frame root, so throw away the scope.
    if (frame !== this.frame)
      scope = undefined;
    const lastChunk = frame.selectors._parseSelector(frameChunks[frameChunks.length - 1], options);
    frame = this._jumpToAriaRefFrameIfNeeded(selector, lastChunk, frame);
    return { frame, info: lastChunk, scope };
  }

  private async _resolveInjectedForSelector(selector: string, options: types.StrictOptions & { mainWorld?: boolean }, scope?: ElementHandle): Promise<{ frame: Frame, info: SelectorInfo, injected: JSHandle<InjectedScript>, scope?: ElementHandle } | null> {
    const resolved = await this._resolveFrameForSelector(selector, options, scope);
    if (!resolved)
      return null;
    const context = await resolved.frame.context(options.mainWorld ? 'main' : resolved.info.world);
    const injected = await context.injectedScript();
    return { frame: resolved.frame, info: resolved.info, injected, scope: resolved.scope };
  }

  async callOnSelector<Arg, R>(
    selector: string,
    options: types.StrictOptions & { mainWorld?: boolean, callWithoutMatches?: boolean, scope?: ElementHandle, markTargets?: 'all' | 'first' | 'none' },
    pageFunction: MatchedElementsCallback<Arg, R>,
    arg: Arg,
  ): Promise<{ frame: Frame, info: SelectorInfo, result: R } | null> {
    const resolved = await this._resolveInjectedForSelector(selector, options, options.scope);
    if (!resolved)
      return null;
    const result = await resolved.injected.evaluate(callMatchedElements, { info: resolved.info, scope: resolved.scope, functionText: String(pageFunction), arg, callWithoutMatches: !!options.callWithoutMatches, markTargets: options.markTargets }) as R;
    // callMatchedElements returns undefined when there were no matches and it skipped the page function.
    if (!options.callWithoutMatches && result === undefined)
      return null;
    return { frame: resolved.frame, info: resolved.info, result };
  }

  async callOnSelectorHandle<Arg, R>(
    selector: string,
    options: types.StrictOptions & { mainWorld?: boolean, scope?: ElementHandle, markTargets?: 'all' | 'first' | 'none' },
    pageFunction: MatchedElementsCallback<Arg, R>,
    arg: Arg,
  ): Promise<{ result: SmartHandle<R> } | null> {
    const resolved = await this._resolveInjectedForSelector(selector, options, options.scope);
    if (!resolved)
      return null;
    const result = await resolved.injected.evaluateHandle(callMatchedElements, { info: resolved.info, scope: resolved.scope, functionText: String(pageFunction), arg, callWithoutMatches: false, markTargets: options.markTargets }) as SmartHandle<R>;
    // A skipped page function returns undefined, which has no object id (unlike a matched element/object).
    if (!result._objectId) {
      result.dispose();
      return null;
    }
    return { result };
  }
}

function callMatchedElements(injected: InjectedScript, { info, scope, functionText, arg, callWithoutMatches, markTargets }: { info: SelectorInfo, scope: Node | undefined, functionText: string, arg: any, callWithoutMatches: boolean, markTargets?: 'all' | 'first' | 'none' }): any {
  const elements = injected.querySelectorAll(info.parsed, scope || document);
  if (markTargets === 'all')
    injected.markTargetElements(new Set(elements));
  else if (markTargets === 'first' && elements.length)
    injected.markTargetElements(new Set([elements[0]]));
  else if (markTargets === 'first')
    injected.markTargetElements(new Set());
  injected.checkDeprecatedSelectorUsage(info.parsed, elements);
  if (info.strict && elements.length > 1)
    throw injected.strictModeViolationError(info.parsed, elements);
  if (!elements.length && !callWithoutMatches)
    return undefined;
  const pageFunction = injected.eval('(' + functionText + ')');
  return pageFunction({ injected, elements, info }, arg);
}

async function adoptIfNeeded<T extends Node>(handle: ElementHandle<T>, context: FrameExecutionContext): Promise<ElementHandle<T>> {
  if (handle._context === context)
    return handle;
  const adopted = await handle._page.delegate.adoptElementHandle(handle, context);
  handle.dispose();
  return adopted;
}
