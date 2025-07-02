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

import fs from 'fs';

import * as js from './javascript';
import { isUnderTest } from '../utils';
import { prepareFilesForUpload } from './fileUploadUtils';
import * as rawInjectedScriptSource from '../generated/injectedScriptSource';

import type * as frames from './frames';
import type { ElementState, HitTargetInterceptionResult, InjectedScript, InjectedScriptOptions } from '@injected/injectedScript';
import type { Page } from './page';
import type { Progress } from './progress';
import type { ScreenshotOptions } from './screenshotter';
import type * as types from './types';
import type * as channels from '@protocol/channels';

export type InputFilesItems = {
  filePayloads?: types.FilePayload[],
  localPaths?: string[]
  localDirectory?: string
};

type ActionName = 'click' | 'hover' | 'dblclick' | 'tap' | 'move and up' | 'move and down';
type PerformActionResult = 'error:notvisible' | 'error:notconnected' | 'error:notinviewport' | 'error:optionsnotfound' | 'error:optionnotenabled' | { missingState: ElementState } | { hitTargetDescription: string } | 'done';

export class NonRecoverableDOMError extends Error {
}

export function isNonRecoverableDOMError(error: Error) {
  return error instanceof NonRecoverableDOMError;
}

export class FrameExecutionContext extends js.ExecutionContext {
  readonly frame: frames.Frame;
  private _injectedScriptPromise?: Promise<js.JSHandle>;
  readonly world: types.World | null;

  constructor(delegate: js.ExecutionContextDelegate, frame: frames.Frame, world: types.World|null) {
    super(frame, delegate, world || 'content-script');
    this.frame = frame;
    this.world = world;
  }

  override adoptIfNeeded(handle: js.JSHandle): Promise<js.JSHandle> | null {
    if (handle instanceof ElementHandle && handle._context !== this)
      return this.frame._page.delegate.adoptElementHandle(handle, this);
    return null;
  }

  async evaluate<Arg, R>(pageFunction: js.Func1<Arg, R>, arg?: Arg): Promise<R> {
    return js.evaluate(this, true /* returnByValue */, pageFunction, arg);
  }

  async evaluateHandle<Arg, R>(pageFunction: js.Func1<Arg, R>, arg?: Arg): Promise<js.SmartHandle<R>> {
    return js.evaluate(this, false /* returnByValue */, pageFunction, arg);
  }

  async evaluateExpression(expression: string, options: { isFunction?: boolean }, arg?: any): Promise<any> {
    return js.evaluateExpression(this, expression, { ...options, returnByValue: true }, arg);
  }

  async evaluateExpressionHandle(expression: string, options: { isFunction?: boolean }, arg?: any): Promise<js.JSHandle<any>> {
    return js.evaluateExpression(this, expression, { ...options, returnByValue: false }, arg);
  }

  injectedScript(): Promise<js.JSHandle<InjectedScript>> {
    if (!this._injectedScriptPromise) {
      const customEngines: InjectedScriptOptions['customEngines'] = [];
      const selectorsRegistry = this.frame._page.browserContext.selectors();
      for (const [name, { source }] of selectorsRegistry._engines)
        customEngines.push({ name, source: `(${source})` });
      const sdkLanguage = this.frame._page.browserContext._browser.sdkLanguage();
      const options: InjectedScriptOptions = {
        isUnderTest: isUnderTest(),
        sdkLanguage,
        testIdAttributeName: selectorsRegistry.testIdAttributeName(),
        stableRafCount: this.frame._page.delegate.rafCountForStablePosition(),
        browserName: this.frame._page.browserContext._browser.options.name,
        customEngines,
      };
      const source = `
        (() => {
        const module = {};
        ${rawInjectedScriptSource.source}
        return new (module.exports.InjectedScript())(globalThis, ${JSON.stringify(options)});
        })();
      `;
      this._injectedScriptPromise = this.rawEvaluateHandle(source)
          .then(handle => {
            handle._setPreview('InjectedScript');
            return handle;
          });
    }
    return this._injectedScriptPromise;
  }
}

export class ElementHandle<T extends Node = Node> extends js.JSHandle<T> {
  __elementhandle: T = true as any;
  declare readonly _context: FrameExecutionContext;
  readonly _page: Page;
  declare readonly _objectId: string;
  readonly _frame: frames.Frame;

  constructor(context: FrameExecutionContext, objectId: string) {
    super(context, 'node', undefined, objectId);
    this._page = context.frame._page;
    this._frame = context.frame;
    this._initializePreview().catch(e => {});
  }

  async _initializePreview() {
    const utility = await this._context.injectedScript();
    this._setPreview(await utility.evaluate((injected, e) => 'JSHandle@' + injected.previewNode(e), this));
  }

  override asElement(): ElementHandle<T> | null {
    return this;
  }

  async evaluateInUtility<R, Arg>(pageFunction: js.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<R | 'error:notconnected'> {
    try {
      const utility = await this._frame._utilityContext();
      return await utility.evaluate(pageFunction, [await utility.injectedScript(), this, arg]);
    } catch (e) {
      if (this._frame.isNonRetriableError(e))
        throw e;
      return 'error:notconnected';
    }
  }

  async evaluateHandleInUtility<R, Arg>(pageFunction: js.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<js.JSHandle<R> | 'error:notconnected'> {
    try {
      const utility = await this._frame._utilityContext();
      return await utility.evaluateHandle(pageFunction, [await utility.injectedScript(), this, arg]);
    } catch (e) {
      if (this._frame.isNonRetriableError(e))
        throw e;
      return 'error:notconnected';
    }
  }

  async ownerFrame(): Promise<frames.Frame | null> {
    const frameId = await this._page.delegate.getOwnerFrame(this);
    if (!frameId)
      return null;
    const frame = this._page.frameManager.frame(frameId);
    if (frame)
      return frame;
    for (const page of this._page.browserContext.pages()) {
      const frame = page.frameManager.frame(frameId);
      if (frame)
        return frame;
    }
    return null;
  }

  async isIframeElement(): Promise<boolean | 'error:notconnected'> {
    return this.evaluateInUtility(([injected, node]) => node && (node.nodeName === 'IFRAME' || node.nodeName === 'FRAME'), {});
  }

  async contentFrame(): Promise<frames.Frame | null> {
    const isFrameElement = throwRetargetableDOMError(await this.isIframeElement());
    if (!isFrameElement)
      return null;
    return this._page.delegate.getContentFrame(this);
  }

  async getAttribute(progress: Progress, name: string): Promise<string | null> {
    return this._frame.getAttribute(progress, ':scope', name, {}, this);
  }

  async inputValue(progress: Progress): Promise<string> {
    return this._frame.inputValue(progress, ':scope', {}, this);
  }

  async textContent(progress: Progress): Promise<string | null> {
    return this._frame.textContent(progress, ':scope', {}, this);
  }

  async innerText(progress: Progress): Promise<string> {
    return this._frame.innerText(progress, ':scope', {}, this);
  }

  async innerHTML(progress: Progress): Promise<string> {
    return this._frame.innerHTML(progress, ':scope', {}, this);
  }

  async dispatchEvent(progress: Progress, type: string, eventInit: Object = {}) {
    return this._frame.dispatchEvent(progress, ':scope', type, eventInit, {}, this);
  }

  async _scrollRectIntoViewIfNeeded(progress: Progress, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return await progress.race(this._page.delegate.scrollRectIntoViewIfNeeded(this, rect));
  }

  async _waitAndScrollIntoViewIfNeeded(progress: Progress, waitForVisible: boolean): Promise<void> {
    const result = await this._retryAction(progress, 'scroll into view', async () => {
      progress.log(`  waiting for element to be stable`);
      const waitResult = await progress.race(this.evaluateInUtility(async ([injected, node, { waitForVisible }]) => {
        return await injected.checkElementStates(node, waitForVisible ? ['visible', 'stable'] : ['stable']);
      }, { waitForVisible }));
      if (waitResult)
        return waitResult;
      return await this._scrollRectIntoViewIfNeeded(progress);
    }, {});
    assertDone(throwRetargetableDOMError(result));
  }

  async scrollIntoViewIfNeeded(progress: Progress) {
    await this._waitAndScrollIntoViewIfNeeded(progress, false /* waitForVisible */);
  }

  private async _clickablePoint(): Promise<types.Point | 'error:notvisible' | 'error:notinviewport' | 'error:notconnected'> {
    const intersectQuadWithViewport = (quad: types.Quad): types.Quad => {
      return quad.map(point => ({
        x: Math.min(Math.max(point.x, 0), metrics.width),
        y: Math.min(Math.max(point.y, 0), metrics.height),
      })) as types.Quad;
    };

    const computeQuadArea = (quad: types.Quad) => {
      // Compute sum of all directed areas of adjacent triangles
      // https://en.wikipedia.org/wiki/Polygon#Simple_polygons
      let area = 0;
      for (let i = 0; i < quad.length; ++i) {
        const p1 = quad[i];
        const p2 = quad[(i + 1) % quad.length];
        area += (p1.x * p2.y - p2.x * p1.y) / 2;
      }
      return Math.abs(area);
    };

    const [quads, metrics] = await Promise.all([
      this._page.delegate.getContentQuads(this),
      this._page.mainFrame()._utilityContext().then(utility => utility.evaluate(() => ({ width: innerWidth, height: innerHeight }))),
    ] as const);
    if (quads === 'error:notconnected')
      return quads;
    if (!quads || !quads.length)
      return 'error:notvisible';

    // Allow 1x1 elements. Compensate for rounding errors by comparing with 0.99 instead.
    const filtered = quads.map(quad => intersectQuadWithViewport(quad)).filter(quad => computeQuadArea(quad) > 0.99);
    if (!filtered.length)
      return 'error:notinviewport';
    if (this._page.browserContext._browser.options.name === 'firefox') {
      // Firefox internally uses integer coordinates, so 8.x is converted to 8 or 9 when clicking.
      //
      // This does not work nicely for small elements. For example, 1x1 square with corners
      // (8;8) and (9;9) is targeted when clicking at (8;8) but not when clicking at (9;9).
      // So, clicking at (8.x;8.y) will sometimes click at (9;9) and miss the target.
      //
      // Therefore, we try to find an integer point within a quad to make sure we click inside the element.
      for (const quad of filtered) {
        const integerPoint = findIntegerPointInsideQuad(quad);
        if (integerPoint)
          return integerPoint;
      }
    }
    // Return the middle point of the first quad.
    return quadMiddlePoint(filtered[0]);
  }

  private async _offsetPoint(offset: types.Point): Promise<types.Point | 'error:notvisible' | 'error:notconnected'> {
    const [box, border] = await Promise.all([
      this.boundingBox(),
      this.evaluateInUtility(([injected, node]) => injected.getElementBorderWidth(node), {}).catch(e => {}),
    ]);
    if (!box || !border)
      return 'error:notvisible';
    if (border === 'error:notconnected')
      return border;
    // Make point relative to the padding box to align with offsetX/offsetY.
    return {
      x: box.x + border.left + offset.x,
      y: box.y + border.top + offset.y,
    };
  }

  async _retryAction(progress: Progress, actionName: string, action: (retry: number) => Promise<PerformActionResult>, options: { trial?: boolean, force?: boolean, skipActionPreChecks?: boolean }): Promise<'error:notconnected' | 'done'> {
    let retry = 0;
    // We progressively wait longer between retries, up to 500ms.
    const waitTime = [0, 20, 100, 100, 500];

    while (true) {
      if (retry) {
        progress.log(`retrying ${actionName} action${options.trial ? ' (trial run)' : ''}`);
        const timeout = waitTime[Math.min(retry - 1, waitTime.length - 1)];
        if (timeout) {
          progress.log(`  waiting ${timeout}ms`);
          const result = await progress.race(this.evaluateInUtility(([injected, node, timeout]) => new Promise<void>(f => setTimeout(f, timeout)), timeout));
          if (result === 'error:notconnected')
            return result;
        }
      } else {
        progress.log(`attempting ${actionName} action${options.trial ? ' (trial run)' : ''}`);
      }
      if (!options.skipActionPreChecks && !options.force)
        await this._frame._page.performActionPreChecks(progress);
      const result = await action(retry);
      ++retry;
      if (result === 'error:notvisible') {
        if (options.force)
          throw new NonRecoverableDOMError('Element is not visible');
        progress.log('  element is not visible');
        continue;
      }
      if (result === 'error:notinviewport') {
        if (options.force)
          throw new NonRecoverableDOMError('Element is outside of the viewport');
        progress.log('  element is outside of the viewport');
        continue;
      }
      if (result === 'error:optionsnotfound') {
        progress.log('  did not find some options');
        continue;
      }
      if (result === 'error:optionnotenabled') {
        progress.log('  option being selected is not enabled');
        continue;
      }
      if (typeof result === 'object' && 'hitTargetDescription' in result) {
        progress.log(`  ${result.hitTargetDescription} intercepts pointer events`);
        continue;
      }
      if (typeof result === 'object' && 'missingState' in result) {
        progress.log(`  element is not ${result.missingState}`);
        continue;
      }
      return result;
    }
  }

  async _retryPointerAction(progress: Progress, actionName: ActionName, waitForEnabled: boolean, action: (point: types.Point) => Promise<void>,
    options: { waitAfter: boolean | 'disabled' } & types.PointerActionOptions & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    // Note: do not perform locator handlers checkpoint to avoid moving the mouse in the middle of a drag operation.
    const skipActionPreChecks = actionName === 'move and up';
    return await this._retryAction(progress, actionName, async retry => {
      // By default, we scroll with protocol method to reveal the action point.
      // However, that might not work to scroll from under position:sticky elements
      // that overlay the target element. To fight this, we cycle through different
      // scroll alignments. This works in most scenarios.
      const scrollOptions: (ScrollIntoViewOptions | undefined)[] = [
        undefined,
        { block: 'end', inline: 'end' },
        { block: 'center', inline: 'center' },
        { block: 'start', inline: 'start' },
      ];
      const forceScrollOptions = scrollOptions[retry % scrollOptions.length];
      return await this._performPointerAction(progress, actionName, waitForEnabled, action, forceScrollOptions, options);
    }, { ...options, skipActionPreChecks });
  }

  async _performPointerAction(
    progress: Progress,
    actionName: ActionName,
    waitForEnabled: boolean,
    action: (point: types.Point) => Promise<void>,
    forceScrollOptions: ScrollIntoViewOptions | undefined,
    options: { waitAfter: boolean | 'disabled' } & types.PointerActionOptions & types.PointerActionWaitOptions,
  ): Promise<PerformActionResult> {
    const { force = false, position } = options;

    const doScrollIntoView = async () => {
      if (forceScrollOptions) {
        return await this.evaluateInUtility(([injected, node, options]) => {
          if (node.nodeType === 1 /* Node.ELEMENT_NODE */)
            (node as Node as Element).scrollIntoView(options);
          return 'done' as const;
        }, forceScrollOptions);
      }
      return await this._scrollRectIntoViewIfNeeded(progress, position ? { x: position.x, y: position.y, width: 0, height: 0 } : undefined);
    };

    if (this._frame.parentFrame()) {
      // Best-effort scroll to make sure any iframes containing this element are scrolled
      // into view and visible, so they are not throttled.
      // See https://github.com/microsoft/playwright/issues/27196 for an example.
      await progress.race(doScrollIntoView().catch(() => {}));
    }

    if ((options as any).__testHookBeforeStable)
      await progress.race((options as any).__testHookBeforeStable());

    if (!force) {
      const elementStates: ElementState[] = waitForEnabled ? ['visible', 'enabled', 'stable'] : ['visible', 'stable'];
      progress.log(`  waiting for element to be ${waitForEnabled ? 'visible, enabled and stable' : 'visible and stable'}`);
      const result = await progress.race(this.evaluateInUtility(async ([injected, node, { elementStates }]) => {
        return await injected.checkElementStates(node, elementStates);
      }, { elementStates }));
      if (result)
        return result;
      progress.log(`  element is ${waitForEnabled ? 'visible, enabled and stable' : 'visible and stable'}`);
    }

    if ((options as any).__testHookAfterStable)
      await progress.race((options as any).__testHookAfterStable());

    progress.log('  scrolling into view if needed');
    const scrolled = await progress.race(doScrollIntoView());
    if (scrolled !== 'done')
      return scrolled;
    progress.log('  done scrolling');

    const maybePoint = position ? await progress.race(this._offsetPoint(position)) : await progress.race(this._clickablePoint());
    if (typeof maybePoint === 'string')
      return maybePoint;
    const point = roundPoint(maybePoint);
    progress.metadata.point = point;
    await progress.race(this.instrumentation.onBeforeInputAction(this, progress.metadata));

    let hitTargetInterceptionHandle: js.JSHandle<HitTargetInterceptionResult> | undefined;
    if (force) {
      progress.log(`  forcing action`);
    } else {
      if ((options as any).__testHookBeforeHitTarget)
        await progress.race((options as any).__testHookBeforeHitTarget());

      const frameCheckResult = await progress.race(this._checkFrameIsHitTarget(point));
      if (frameCheckResult === 'error:notconnected' || ('hitTargetDescription' in frameCheckResult))
        return frameCheckResult;
      const hitPoint = frameCheckResult.framePoint;
      const actionType = actionName === 'move and up' ? 'drag' : ((actionName === 'hover' || actionName === 'tap') ? actionName : 'mouse');
      const handle = await progress.race(this.evaluateHandleInUtility(([injected, node, { actionType, hitPoint, trial }]) => injected.setupHitTargetInterceptor(node, actionType, hitPoint, trial), { actionType, hitPoint, trial: !!options.trial } as const));
      if (handle === 'error:notconnected')
        return handle;
      if (!handle._objectId) {
        const error = handle.rawValue() as string;
        if (error === 'error:notconnected')
          return error;
        return { hitTargetDescription: error };
      }
      hitTargetInterceptionHandle = handle as any;
      progress.cleanupWhenAborted(() => {
        // Do not await here, just in case the renderer is stuck (e.g. on alert)
        // and we won't be able to cleanup.
        hitTargetInterceptionHandle!.evaluate(h => h.stop()).catch(e => {});
        hitTargetInterceptionHandle!.dispose();
      });
    }

    const actionResult = await this._page.frameManager.waitForSignalsCreatedBy(progress, options.waitAfter === true, async () => {
      if ((options as any).__testHookBeforePointerAction)
        await progress.race((options as any).__testHookBeforePointerAction());
      let restoreModifiers: types.KeyboardModifier[] | undefined;
      if (options && options.modifiers)
        restoreModifiers = await this._page.keyboard.ensureModifiers(progress, options.modifiers);
      progress.log(`  performing ${actionName} action`);
      await action(point);
      if (restoreModifiers)
        await this._page.keyboard.ensureModifiers(progress, restoreModifiers);
      if (hitTargetInterceptionHandle) {
        const stopHitTargetInterception = this._frame.raceAgainstEvaluationStallingEvents(() => {
          return hitTargetInterceptionHandle.evaluate(h => h.stop());
        }).catch(e => 'done' as const).finally(() => {
          hitTargetInterceptionHandle?.dispose();
        });
        if (options.waitAfter !== false) {
          // When noWaitAfter is passed, we do not want to accidentally stall on
          // non-committed navigation blocking the evaluate.
          const hitTargetResult = await progress.race(stopHitTargetInterception);
          if (hitTargetResult !== 'done')
            return hitTargetResult;
        }
      }
      progress.log(`  ${options.trial ? 'trial ' : ''}${actionName} action done`);
      progress.log('  waiting for scheduled navigations to finish');
      if ((options as any).__testHookAfterPointerAction)
        await progress.race((options as any).__testHookAfterPointerAction());
      return 'done';
    });
    if (actionResult !== 'done')
      return actionResult;
    progress.log('  navigations have finished');
    return 'done';
  }

  private async _markAsTargetElement(progress: Progress) {
    if (!progress.metadata.id)
      return;
    await progress.race(this.evaluateInUtility(([injected, node, callId]) => {
      if (node.nodeType === 1 /* Node.ELEMENT_NODE */)
        injected.markTargetElements(new Set([node as Node as Element]), callId);
    }, progress.metadata.id));
  }

  async hover(progress: Progress, options: types.PointerActionOptions & types.PointerActionWaitOptions): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._hover(progress, options);
    return assertDone(throwRetargetableDOMError(result));
  }

  _hover(progress: Progress, options: types.PointerActionOptions & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'hover', false /* waitForEnabled */, point => this._page.mouse.move(progress, point.x, point.y), { ...options, waitAfter: 'disabled' });
  }

  async click(progress: Progress, options: { noWaitAfter?: boolean } & types.MouseClickOptions & types.PointerActionWaitOptions): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._click(progress, { ...options, waitAfter: !options.noWaitAfter });
    return assertDone(throwRetargetableDOMError(result));
  }

  _click(progress: Progress, options: { waitAfter: boolean | 'disabled' } & types.MouseClickOptions & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'click', true /* waitForEnabled */, point => this._page.mouse.click(progress, point.x, point.y, options), options);
  }

  async dblclick(progress: Progress, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._dblclick(progress, options);
    return assertDone(throwRetargetableDOMError(result));
  }

  _dblclick(progress: Progress, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'dblclick', true /* waitForEnabled */, point => this._page.mouse.click(progress, point.x, point.y, { ...options, clickCount: 2 }), { ...options, waitAfter: 'disabled' });
  }

  async tap(progress: Progress, options: types.PointerActionWaitOptions): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._tap(progress, options);
    return assertDone(throwRetargetableDOMError(result));
  }

  _tap(progress: Progress, options: types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'tap', true /* waitForEnabled */, point => this._page.touchscreen.tap(progress, point.x, point.y), { ...options, waitAfter: 'disabled' });
  }

  async selectOption(progress: Progress, elements: ElementHandle[], values: types.SelectOption[], options: types.CommonActionOptions): Promise<string[]> {
    await this._markAsTargetElement(progress);
    const result = await this._selectOption(progress, elements, values, options);
    return throwRetargetableDOMError(result);
  }

  async _selectOption(progress: Progress, elements: ElementHandle[], values: types.SelectOption[], options: types.CommonActionOptions): Promise<string[] | 'error:notconnected'> {
    let resultingOptions: string[] = [];
    const result = await this._retryAction(progress, 'select option', async () => {
      await progress.race(this.instrumentation.onBeforeInputAction(this, progress.metadata));
      if (!options.force)
        progress.log(`  waiting for element to be visible and enabled`);
      const optionsToSelect = [...elements, ...values];
      const result = await progress.race(this.evaluateInUtility(async ([injected, node, { optionsToSelect, force }]) => {
        if (!force) {
          const checkResult = await injected.checkElementStates(node, ['visible', 'enabled']);
          if (checkResult)
            return checkResult;
        }
        return injected.selectOptions(node, optionsToSelect);
      }, { optionsToSelect, force: options.force }));
      if (Array.isArray(result)) {
        progress.log('  selected specified option(s)');
        resultingOptions = result;
        return 'done';
      }
      return result;
    }, options);
    if (result === 'error:notconnected')
      return result;
    return resultingOptions;
  }

  async fill(progress: Progress, value: string, options: types.CommonActionOptions): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._fill(progress, value, options);
    assertDone(throwRetargetableDOMError(result));
  }

  async _fill(progress: Progress, value: string, options: types.CommonActionOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`  fill("${value}")`);
    return await this._retryAction(progress, 'fill', async () => {
      await progress.race(this.instrumentation.onBeforeInputAction(this, progress.metadata));
      if (!options.force)
        progress.log('  waiting for element to be visible, enabled and editable');
      const result = await progress.race(this.evaluateInUtility(async ([injected, node, { value, force }]) => {
        if (!force) {
          const checkResult = await injected.checkElementStates(node, ['visible', 'enabled', 'editable']);
          if (checkResult)
            return checkResult;
        }
        return injected.fill(node, value);
      }, { value, force: options.force }));
      if (result === 'needsinput') {
        if (value)
          await this._page.keyboard.insertText(progress, value);
        else
          await this._page.keyboard.press(progress, 'Delete');
        return 'done';
      } else {
        return result;
      }
    }, options);
  }

  async selectText(progress: Progress, options: types.CommonActionOptions): Promise<void> {
    const result = await this._retryAction(progress, 'selectText', async () => {
      if (!options.force)
        progress.log('  waiting for element to be visible');
      return await progress.race(this.evaluateInUtility(async ([injected, node, { force }]) => {
        if (!force) {
          const checkResult = await injected.checkElementStates(node, ['visible']);
          if (checkResult)
            return checkResult;
        }
        return injected.selectText(node);
      }, { force: options.force }));
    }, options);
    assertDone(throwRetargetableDOMError(result));
  }

  async setInputFiles(progress: Progress, params: Omit<channels.ElementHandleSetInputFilesParams, 'timeout'>) {
    const inputFileItems = await progress.race(prepareFilesForUpload(this._frame, params));
    await this._markAsTargetElement(progress);
    const result = await this._setInputFiles(progress, inputFileItems);
    return assertDone(throwRetargetableDOMError(result));
  }

  async _setInputFiles(progress: Progress, items: InputFilesItems): Promise<'error:notconnected' | 'done'> {
    const { filePayloads, localPaths, localDirectory } = items;
    const multiple = filePayloads && filePayloads.length > 1 || localPaths && localPaths.length > 1;
    const result = await progress.race(this.evaluateHandleInUtility(([injected, node, { multiple, directoryUpload }]): Element | undefined => {
      const element = injected.retarget(node, 'follow-label');
      if (!element)
        return;
      if (element.tagName !== 'INPUT')
        throw injected.createStacklessError('Node is not an HTMLInputElement');
      const inputElement = element as HTMLInputElement;
      if (multiple && !inputElement.multiple && !inputElement.webkitdirectory)
        throw injected.createStacklessError('Non-multiple file input can only accept single file');
      if (directoryUpload && !inputElement.webkitdirectory)
        throw injected.createStacklessError('File input does not support directories, pass individual files instead');
      if (!directoryUpload && inputElement.webkitdirectory)
        throw injected.createStacklessError('[webkitdirectory] input requires passing a path to a directory');
      return inputElement;
    }, { multiple, directoryUpload: !!localDirectory }));
    if (result === 'error:notconnected' || !result.asElement())
      return 'error:notconnected';
    const retargeted = result.asElement() as ElementHandle<HTMLInputElement>;
    await progress.race(this.instrumentation.onBeforeInputAction(this, progress.metadata));
    if (localPaths || localDirectory) {
      const localPathsOrDirectory = localDirectory ? [localDirectory] : localPaths!;
      await progress.race(Promise.all((localPathsOrDirectory).map(localPath => (
        fs.promises.access(localPath, fs.constants.F_OK)
      ))));
      // Browsers traverse the given directory asynchronously and we want to ensure all files are uploaded.
      const waitForInputEvent = localDirectory ? this.evaluate(node => new Promise<any>(fulfill => {
        node.addEventListener('input', fulfill, { once: true });
      })).catch(() => {}) : Promise.resolve();
      await progress.race(this._page.delegate.setInputFilePaths(retargeted, localPathsOrDirectory));
      await progress.race(waitForInputEvent);
    } else {
      await progress.race(retargeted.evaluateInUtility(([injected, node, files]) =>
        injected.setInputFiles(node, files), filePayloads!));
    }
    return 'done';
  }

  async focus(progress: Progress): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._focus(progress);
    return assertDone(throwRetargetableDOMError(result));
  }

  async _focus(progress: Progress, resetSelectionIfNotFocused?: boolean): Promise<'error:notconnected' | 'done'> {
    return await progress.race(this.evaluateInUtility(([injected, node, resetSelectionIfNotFocused]) => injected.focusNode(node, resetSelectionIfNotFocused), resetSelectionIfNotFocused));
  }

  async _blur(progress: Progress): Promise<'error:notconnected' | 'done'> {
    return await progress.race(this.evaluateInUtility(([injected, node]) => injected.blurNode(node), {}));
  }

  async type(progress: Progress, text: string, options: { delay?: number } & types.StrictOptions): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._type(progress, text, options);
    return assertDone(throwRetargetableDOMError(result));
  }

  async _type(progress: Progress, text: string, options: { delay?: number } & types.StrictOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`elementHandle.type("${text}")`);
    await progress.race(this.instrumentation.onBeforeInputAction(this, progress.metadata));
    const result = await this._focus(progress, true /* resetSelectionIfNotFocused */);
    if (result !== 'done')
      return result;
    await this._page.keyboard.type(progress, text, options);
    return 'done';
  }

  async press(progress: Progress, key: string, options: { delay?: number, noWaitAfter?: boolean } & types.StrictOptions): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._press(progress, key, options);
    return assertDone(throwRetargetableDOMError(result));
  }

  async _press(progress: Progress, key: string, options: { delay?: number, noWaitAfter?: boolean } & types.StrictOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`elementHandle.press("${key}")`);
    await progress.race(this.instrumentation.onBeforeInputAction(this, progress.metadata));
    return this._page.frameManager.waitForSignalsCreatedBy(progress, !options.noWaitAfter, async () => {
      const result = await this._focus(progress, true /* resetSelectionIfNotFocused */);
      if (result !== 'done')
        return result;
      await this._page.keyboard.press(progress, key, options);
      return 'done';
    });
  }

  async check(progress: Progress, options: { position?: types.Point } & types.PointerActionWaitOptions) {
    const result = await this._setChecked(progress, true, options);
    return assertDone(throwRetargetableDOMError(result));
  }

  async uncheck(progress: Progress, options: { position?: types.Point } & types.PointerActionWaitOptions) {
    const result = await this._setChecked(progress, false, options);
    return assertDone(throwRetargetableDOMError(result));
  }

  async _setChecked(progress: Progress, state: boolean, options: { position?: types.Point } & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    const isChecked = async () => {
      const result = await progress.race(this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'checked'), {}));
      if (result === 'error:notconnected' || result.received === 'error:notconnected')
        throwElementIsNotAttached();
      return result.matches;
    };
    await this._markAsTargetElement(progress);
    if (await isChecked() === state)
      return 'done';
    const result = await this._click(progress, { ...options, waitAfter: 'disabled' });
    if (result !== 'done')
      return result;
    if (options.trial)
      return 'done';
    if (await isChecked() !== state)
      throw new NonRecoverableDOMError('Clicking the checkbox did not change its state');
    return 'done';
  }

  async boundingBox(): Promise<types.Rect | null> {
    return this._page.delegate.getBoundingBox(this);
  }

  async ariaSnapshot(options?: { forAI?: boolean, refPrefix?: string }): Promise<string> {
    return await this.evaluateInUtility(([injected, element, options]) => injected.ariaSnapshot(element, options), options);
  }

  async screenshot(progress: Progress, options: ScreenshotOptions): Promise<Buffer> {
    return await this._page.screenshotter.screenshotElement(progress, this, options);
  }

  async querySelector(selector: string, options: types.StrictOptions): Promise<ElementHandle | null> {
    return this._frame.selectors.query(selector, options, this);
  }

  async querySelectorAll(selector: string): Promise<ElementHandle<Element>[]> {
    return this._frame.selectors.queryAll(selector, this);
  }

  async evalOnSelector(selector: string, strict: boolean, expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return this._frame.evalOnSelector(selector, strict, expression, isFunction, arg, this);
  }

  async evalOnSelectorAll(selector: string, expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return this._frame.evalOnSelectorAll(selector, expression, isFunction, arg, this);
  }

  async isVisible(progress: Progress): Promise<boolean> {
    return this._frame.isVisible(progress, ':scope', {}, this);
  }

  async isHidden(progress: Progress): Promise<boolean> {
    return this._frame.isHidden(progress, ':scope', {}, this);
  }

  async isEnabled(progress: Progress): Promise<boolean> {
    return this._frame.isEnabled(progress, ':scope', {}, this);
  }

  async isDisabled(progress: Progress): Promise<boolean> {
    return this._frame.isDisabled(progress, ':scope', {}, this);
  }

  async isEditable(progress: Progress): Promise<boolean> {
    return this._frame.isEditable(progress, ':scope', {}, this);
  }

  async isChecked(progress: Progress): Promise<boolean> {
    return this._frame.isChecked(progress, ':scope', {}, this);
  }

  async waitForElementState(progress: Progress, state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled' | 'editable'): Promise<void> {
    const actionName = `wait for ${state}`;
    const result = await this._retryAction(progress, actionName, async () => {
      return await progress.race(this.evaluateInUtility(async ([injected, node, state]) => {
        return (await injected.checkElementStates(node, [state])) || 'done';
      }, state));
    }, {});
    assertDone(throwRetargetableDOMError(result));
  }

  async waitForSelector(progress: Progress, selector: string, options: types.WaitForElementOptions): Promise<ElementHandle<Element> | null> {
    return await this._frame.waitForSelector(progress, selector, true, options, this);
  }

  async _adoptTo(context: FrameExecutionContext): Promise<ElementHandle<T>> {
    if (this._context !== context) {
      const adopted = await this._page.delegate.adoptElementHandle(this, context);
      this.dispose();
      return adopted;
    }
    return this;
  }

  async _checkFrameIsHitTarget(point: types.Point): Promise<{ framePoint: types.Point | undefined } | 'error:notconnected' | { hitTargetDescription: string }> {
    let frame = this._frame;
    const data: { frame: frames.Frame, frameElement: ElementHandle<Element> | null, pointInFrame: types.Point }[] = [];
    while (frame.parentFrame()) {
      const frameElement = await frame.frameElement() as ElementHandle<Element>;
      const box = await frameElement.boundingBox();
      const style = await frameElement.evaluateInUtility(([injected, iframe]) => injected.describeIFrameStyle(iframe), {}).catch(e => 'error:notconnected' as const);
      if (!box || style === 'error:notconnected')
        return 'error:notconnected';
      if (style === 'transformed') {
        // We cannot translate coordinates when iframe has any transform applied.
        // The best we can do right now is to skip the hitPoint check,
        // and solely rely on the event interceptor.
        return { framePoint: undefined };
      }
      // Translate from viewport coordinates to frame coordinates.
      const pointInFrame = { x: point.x - box.x - style.left, y: point.y - box.y - style.top };
      data.push({ frame, frameElement, pointInFrame });
      frame = frame.parentFrame()!;
    }
    // Add main frame.
    data.push({ frame, frameElement: null, pointInFrame: point });

    for (let i = data.length - 1; i > 0; i--) {
      const element = data[i - 1].frameElement!;
      const point = data[i].pointInFrame;
      // Hit target in the parent frame should hit the child frame element.
      const hitTargetResult = await element.evaluateInUtility(([injected, element, hitPoint]) => {
        return injected.expectHitTarget(hitPoint, element);
      }, point);
      if (hitTargetResult !== 'done')
        return hitTargetResult;
    }
    return { framePoint: data[0].pointInFrame };
  }
}

export function throwRetargetableDOMError<T>(result: T | 'error:notconnected'): T {
  if (result === 'error:notconnected')
    throwElementIsNotAttached();
  return result;
}

export function throwElementIsNotAttached(): never {
  throw new Error('Element is not attached to the DOM');
}

export function assertDone(result: 'done'): void {
  // This function converts 'done' to void and ensures typescript catches unhandled errors.
}

function roundPoint(point: types.Point): types.Point {
  return {
    x: (point.x * 100 | 0) / 100,
    y: (point.y * 100 | 0) / 100,
  };
}

function quadMiddlePoint(quad: types.Quad): types.Point {
  const result = { x: 0, y: 0 };
  for (const point of quad) {
    result.x += point.x / 4;
    result.y += point.y / 4;
  }
  return result;
}

function triangleArea(p1: types.Point, p2: types.Point, p3: types.Point): number {
  return Math.abs(p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2;
}

function isPointInsideQuad(point: types.Point, quad: types.Quad): boolean {
  const area1 = triangleArea(point, quad[0], quad[1]) + triangleArea(point, quad[1], quad[2]) + triangleArea(point, quad[2], quad[3]) + triangleArea(point, quad[3], quad[0]);
  const area2 = triangleArea(quad[0], quad[1], quad[2]) + triangleArea(quad[1], quad[2], quad[3]);
  // Check that point is inside the quad.
  if (Math.abs(area1 - area2) > 0.1)
    return false;
  // Check that point is not on the right/bottom edge, because clicking
  // there does not actually click the element.
  return point.x < Math.max(quad[0].x, quad[1].x, quad[2].x, quad[3].x) &&
         point.y < Math.max(quad[0].y, quad[1].y, quad[2].y, quad[3].y);
}

function findIntegerPointInsideQuad(quad: types.Quad): types.Point | undefined {
  // Try all four rounding directions of the middle point.
  const point = quadMiddlePoint(quad);
  point.x = Math.floor(point.x);
  point.y = Math.floor(point.y);
  if (isPointInsideQuad(point, quad))
    return point;
  point.x += 1;
  if (isPointInsideQuad(point, quad))
    return point;
  point.y += 1;
  if (isPointInsideQuad(point, quad))
    return point;
  point.x -= 1;
  if (isPointInsideQuad(point, quad))
    return point;
}

export const kUnableToAdoptErrorMessage = 'Unable to adopt element handle from a different document';
