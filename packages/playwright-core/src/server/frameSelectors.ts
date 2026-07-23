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

import { NonRecoverableDOMError } from './dom';
import { EvaluationStalledError } from './errors';

import type { ElementHandle, FrameExecutionContext } from './dom';
import type { Frame } from './frames';
import type { InjectedScript } from '@injected/injectedScript';
import type { JSHandle, SmartHandle, Unboxed } from './javascript';
import type * as types from './types';
import type { ParsedSelector } from '@isomorphic/selectorParser';


export type SelectorInfo = {
  parsed: ParsedSelector,
  world: types.World,
  strict: boolean,
};

type SelectorInFrame = {
  frame: Frame;
  info: SelectorInfo;
  scope?: ElementHandle;
};

type MatchedElementsCallback<Arg, R> = (data: { injected: InjectedScript, elements: Element[], info: SelectorInfo }, arg: Unboxed<Arg>) => R | Promise<R>;

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

  private async _resolveFramesForSelector(selector: string, options: types.StrictOptions = {}, scope?: ElementHandle): Promise<SelectorInFrame[]> {
    const { pierce, chunks } = splitSelectorByFrame(selector);
    for (const chunk of chunks) {
      visitAllSelectorParts(chunk, (part, nested) => {
        if (nested && part.name === 'internal:control' && part.body === 'enter-frame') {
          const locator = asLocator(this.frame._page.browserContext._browser.sdkLanguage(), selector);
          throw new InvalidSelectorError(`Frame locators are not allowed inside composite locators, while querying "${locator}"`);
        }
        if (nested && pierce) {
          const locator = asLocator(this.frame._page.browserContext._browser.sdkLanguage(), selector);
          throw new InvalidSelectorError(`Composite locators are not supported with piercing frames, while querying "${locator}"`);
        }
      });
    }

    if (pierce) {
      const parsed = chunks[0];  // Only one chunk is allowed with pierce.
      if (parsed.parts.some((part, index) => part.name === 'nth' && index !== parsed.parts.length - 1)) {
        const locator = asLocator(this.frame._page.browserContext._browser.sdkLanguage(), selector);
        throw new InvalidSelectorError(`nth can only be the last locator when piercing frames, while querying "${locator}"`);
      }
      return await this._resolveFramePiercingSelector(parsed, options, scope);
    }

    const result = await this._resolveChainedSelector(selector, options, chunks, scope);
    return result ? [result] : [];
  }

  private async _resolveChainedSelector(selector: string, options: types.StrictOptions, frameChunks: ParsedSelector[], scope: ElementHandle | undefined): Promise<SelectorInFrame | null> {
    let frame: Frame = this.frame;
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

  private async _resolveFramePiercingSelector(parsed: ParsedSelector, options: types.StrictOptions, scope: ElementHandle | undefined) {
    const candidates = new Map<Frame, Set<number>>();
    const infos = parsed.parts.map(part => this._parseSelector({ parts: [part] }, options));
    for (const frame of this.frame._page.frameManager.frames())
      await this._pierceFramesRecursivelyIfNotSeen(frame, infos, scope, 0, candidates);
    const result: SelectorInFrame[] = [];
    for (const [frame, matches] of candidates) {
      for (const match of matches) {
        const suffix = infos.slice(match);
        const partialInfo: SelectorInfo = {
          parsed: { parts: suffix.map(info => info.parsed.parts[0]) },
          world: suffix.some(info => info.world === 'main') ? 'main' : 'utility',
          strict: !!options.strict,
        };
        result.push({ frame, info: partialInfo });
      }
    }
    return result;
  }

  private async _pierceFramesRecursivelyIfNotSeen(frame: Frame, infos: SelectorInfo[], scope: ElementHandle | undefined, startIndex: number, result: Map<Frame, Set<number>>) {
    let set = result.get(frame);
    if (!set) {
      set = new Set();
      result.set(frame, set);
    }
    if (!set.has(startIndex)) {
      set.add(startIndex);
      await this._pierceFramesRecursively(frame, infos, undefined, startIndex, result);
    }
  }

  private async _pierceFramesRecursively(frame: Frame, infos: SelectorInfo[], scope: ElementHandle | undefined, startIndex: number, result: Map<Frame, Set<number>>) {
    const doWork = async (context: FrameExecutionContext) => {
      const injected = await context.injectedScript();
      const frameCandidatesHandle = await injected.evaluateHandle((injected, { infos, scope, startIndex }) => {
        const frameElements = injected.querySelectorAll(injected.parseSelector('css=frame,iframe'), scope || document);
        const result = frameElements.map(frameElement => ({ frameElement, matches: [] as number[] }));

        let roots = [scope || document];
        for (let index = startIndex; index < infos.length; index++) {
          const next = new Set<Node>();
          for (const root of roots) {
            const all = injected.querySelectorAll(infos[index].parsed, root);
            for (const element of all)
              next.add(element);
          }
          roots = [...next];
          if (index + 1 < infos.length && !['nth', 'visible'].includes(infos[index + 1].parsed.parts[0].name)) {
            for (const { frameElement, matches } of result) {
              if (roots.some(root => injected.utils.isInsideScope(root, frameElement)))
                matches.push(index);
            }
          }
        }
        return result;
      }, { infos, scope, startIndex });

      const count = await frameCandidatesHandle.evaluate(x => x.length).catch(() => 0);
      for (let i = 0; i < count; ++i) {
        try {
          const frameElement = await frameCandidatesHandle.evaluateHandle((list, i) => list[i].frameElement, i) as ElementHandle<Element>;
          const childFrame = await frame._page.delegate.getContentFrame(frameElement).catch(() => null);
          if (childFrame) {
            const matches = await frameCandidatesHandle.evaluate((list, i) => list[i].matches, i) as number[];
            for (const match of matches)
              await this._pierceFramesRecursivelyIfNotSeen(childFrame, infos, undefined, match + 1, result);
          }
        } catch {
          // Ignore errors for this frame candidate.
        }
      }
      frameCandidatesHandle.dispose();
    };

    const noStall = frame !== this.frame;
    const world = infos.some(info => info.world === 'main') ? 'main' : 'utility';
    const context = noStall ? frame.existingContext(world) : await frame.context(world);
    if (!context)
      return;

    if (noStall)
      await frame.raceAgainstEvaluationStallingEvents(() => doWork(context)).catch(() => {});
    else
      await doWork(context);
  }

  private async _callOnSelectorInternal<Arg, R>(
    selector: string,
    options: types.StrictOptions & { mainWorld?: boolean, callWithoutMatches?: boolean, scope?: ElementHandle, markTargets?: 'all' | 'first' | 'none' },
    pageFunction: MatchedElementsCallback<Arg, R>,
    arg: Arg,
    returnByValue: boolean,
  ): Promise<{ frame: Frame, info: SelectorInfo, result: R | SmartHandle<R> } | null> {
    const resolved = await this._resolveFramesForSelector(selector, options, options.scope);
    let aggregatedResult: { frame: Frame, info: SelectorInfo, result: R | SmartHandle<R> } | null = null;
    const noStall = resolved.length > 1;
    for (const { frame, info, scope } of resolved) {
      const world = options.mainWorld ? 'main' : info.world;
      const context = noStall ? frame.existingContext(world) : await frame.context(world);
      if (!context)
        continue;
      const getResult = async () => {
        const injected = await context.injectedScript();
        const method = returnByValue ? 'evaluate' : 'evaluateHandle';
        const evalResult = await injected[method]((injected, params) => {
          const elements = injected.querySelectorAll(params.info.parsed, params.scope || document);
          if (params.markTargets === 'all')
            injected.markTargetElements(new Set(elements));
          else if (params.markTargets === 'first' && elements.length)
            injected.markTargetElements(new Set([elements[0]]));
          else if (params.markTargets === 'first')
            injected.markTargetElements(new Set());
          injected.checkDeprecatedSelectorUsage(params.info.parsed, elements);
          if (params.info.strict && elements.length > 1)
            throw injected.strictModeViolationError(params.info.parsed, elements);
          if (!elements.length && !params.callWithoutMatches)
            return '--playwright--no--result--value--';
          const func = injected.eval('(' + params.functionText + ')') as MatchedElementsCallback<Arg, R>;
          return func({ injected, elements, info: params.info }, params.arg);
        }, { info, scope, functionText: String(pageFunction), arg, callWithoutMatches: options.callWithoutMatches, markTargets: options.markTargets, returnByValue });
        if (returnByValue && evalResult === '--playwright--no--result--value--')
          return;
        if (!returnByValue && (evalResult as JSHandle)._value === '--playwright--no--result--value--') {
          (evalResult as JSHandle).dispose();
          return;
        }
        return { result: evalResult as R | SmartHandle<R> };
      };
      const maybeResult = noStall ? await frame.raceAgainstEvaluationStallingEvents(getResult).catch(e => {
        if (e instanceof EvaluationStalledError)
          return;
        throw e;
      }) : await getResult();
      if (!maybeResult)
        continue;
      if (aggregatedResult)
        throw new NonRecoverableDOMError(`Pierce-frame mode matched elements from multiple frames.`);
      aggregatedResult = { frame, info, result: maybeResult.result };
    }
    return aggregatedResult;
  }

  async callOnSelector<Arg, R>(
    selector: string,
    options: types.StrictOptions & { mainWorld?: boolean, callWithoutMatches?: boolean, scope?: ElementHandle, markTargets?: 'all' | 'first' | 'none' },
    pageFunction: MatchedElementsCallback<Arg, R>,
    arg: Arg,
  ): Promise<{ frame: Frame, info: SelectorInfo, result: R } | null> {
    const result = await this._callOnSelectorInternal(selector, options, pageFunction, arg, true /* returnByValue */);
    return result as { frame: Frame, info: SelectorInfo, result: R } | null;
  }

  async callOnSelectorHandle<Arg, R>(
    selector: string,
    options: types.StrictOptions & { mainWorld?: boolean, scope?: ElementHandle, markTargets?: 'all' | 'first' | 'none' },
    pageFunction: MatchedElementsCallback<Arg, R>,
    arg: Arg,
  ): Promise<{ result: SmartHandle<R> } | null> {
    const result = await this._callOnSelectorInternal(selector, { ...options, callWithoutMatches: false }, pageFunction, arg, false /* returnByValue */);
    return result as { frame: Frame, info: SelectorInfo, result: SmartHandle<R> } | null;
  }
}

async function adoptIfNeeded<T extends Node>(handle: ElementHandle<T>, context: FrameExecutionContext): Promise<ElementHandle<T>> {
  if (handle._context === context)
    return handle;
  const adopted = await handle._page.delegate.adoptElementHandle(handle, context);
  handle.dispose();
  return adopted;
}
