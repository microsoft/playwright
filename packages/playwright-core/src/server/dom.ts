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
import type * as channels from '@protocol/channels';
import * as injectedScriptSource from '../generated/injectedScriptSource';
import { isSessionClosedError } from './protocolError';
import type { ScreenshotOptions } from './screenshotter';
import type * as frames from './frames';
import type { InjectedScript, HitTargetInterceptionResult, ElementState } from './injected/injectedScript';
import type { CallMetadata } from './instrumentation';
import * as js from './javascript';
import type { Page } from './page';
import type { Progress } from './progress';
import { ProgressController } from './progress';
import type * as types from './types';
import type { TimeoutOptions } from '../common/types';
import { isUnderTest } from '../utils';
import { prepareFilesForUpload } from './fileUploadUtils';

export type InputFilesItems = {
  filePayloads?: types.FilePayload[],
  localPaths?: string[]
  localDirectory?: string
};

type ActionName = 'click' | 'hover' | 'dblclick' | 'tap' | 'move and up' | 'move and down';
type PerformActionResult = 'error:notvisible' | 'error:notconnected' | 'error:notinviewport' | 'error:optionsnotfound' | { missingState: ElementState } | { hitTargetDescription: string } | 'done';

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
      return this.frame._page._delegate.adoptElementHandle(handle, this);
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

  override createHandle(remoteObject: js.RemoteObject): js.JSHandle {
    if (this.frame._page._delegate.isElementHandle(remoteObject))
      return new ElementHandle(this, remoteObject.objectId!);
    return super.createHandle(remoteObject);
  }

  injectedScript(): Promise<js.JSHandle<InjectedScript>> {
    if (!this._injectedScriptPromise) {
      const custom: string[] = [];
      const selectorsRegistry = this.frame._page.context().selectors();
      for (const [name, { source }] of selectorsRegistry._engines)
        custom.push(`{ name: '${name}', engine: (${source}) }`);
      const sdkLanguage = this.frame.attribution.playwright.options.sdkLanguage;
      const source = `
        (() => {
        const module = {};
        ${injectedScriptSource.source}
        return new (module.exports.InjectedScript())(
          globalThis,
          ${isUnderTest()},
          "${sdkLanguage}",
          ${JSON.stringify(selectorsRegistry.testIdAttributeName())},
          ${this.frame._page._delegate.rafCountForStablePosition()},
          "${this.frame._page._browserContext._browser.options.name}",
          [${custom.join(',\n')}]
        );
        })();
      `;
      this._injectedScriptPromise = this.rawEvaluateHandle(source).then(objectId => new js.JSHandle(this, 'object', 'InjectedScript', objectId));
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
      if (js.isJavaScriptErrorInEvaluate(e) || isSessionClosedError(e))
        throw e;
      return 'error:notconnected';
    }
  }

  async evaluateHandleInUtility<R, Arg>(pageFunction: js.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<js.JSHandle<R> | 'error:notconnected'> {
    try {
      const utility = await this._frame._utilityContext();
      return await utility.evaluateHandle(pageFunction, [await utility.injectedScript(), this, arg]);
    } catch (e) {
      if (js.isJavaScriptErrorInEvaluate(e) || isSessionClosedError(e))
        throw e;
      return 'error:notconnected';
    }
  }

  async ownerFrame(): Promise<frames.Frame | null> {
    const frameId = await this._page._delegate.getOwnerFrame(this);
    if (!frameId)
      return null;
    const frame = this._page._frameManager.frame(frameId);
    if (frame)
      return frame;
    for (const page of this._page._browserContext.pages()) {
      const frame = page._frameManager.frame(frameId);
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
    return this._page._delegate.getContentFrame(this);
  }

  async getAttribute(metadata: CallMetadata, name: string): Promise<string | null> {
    return this._frame.getAttribute(metadata, ':scope', name, {}, this);
  }

  async inputValue(metadata: CallMetadata): Promise<string> {
    return this._frame.inputValue(metadata, ':scope', {}, this);
  }

  async textContent(metadata: CallMetadata): Promise<string | null> {
    return this._frame.textContent(metadata, ':scope', {}, this);
  }

  async innerText(metadata: CallMetadata): Promise<string> {
    return this._frame.innerText(metadata, ':scope', {}, this);
  }

  async innerHTML(metadata: CallMetadata): Promise<string> {
    return this._frame.innerHTML(metadata, ':scope', {}, this);
  }

  async dispatchEvent(metadata: CallMetadata, type: string, eventInit: Object = {}) {
    return this._frame.dispatchEvent(metadata, ':scope', type, eventInit, {}, this);
  }

  async _scrollRectIntoViewIfNeeded(rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return await this._page._delegate.scrollRectIntoViewIfNeeded(this, rect);
  }

  async _waitAndScrollIntoViewIfNeeded(progress: Progress, waitForVisible: boolean): Promise<void> {
    const result = await this._retryAction(progress, 'scroll into view', async () => {
      progress.log(`  waiting for element to be stable`);
      const waitResult = await this.evaluateInUtility(async ([injected, node, { waitForVisible }]) => {
        return await injected.checkElementStates(node, waitForVisible ? ['visible', 'stable'] : ['stable']);
      }, { waitForVisible });
      if (waitResult)
        return waitResult;
      return await this._scrollRectIntoViewIfNeeded();
    }, {});
    assertDone(throwRetargetableDOMError(result));
  }

  async scrollIntoViewIfNeeded(metadata: CallMetadata, options: types.TimeoutOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(
        progress => this._waitAndScrollIntoViewIfNeeded(progress, false /* waitForVisible */),
        this._page._timeoutSettings.timeout(options));
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
      this._page._delegate.getContentQuads(this),
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
    // Return the middle point of the first quad.
    const result = { x: 0, y: 0 };
    for (const point of filtered[0]) {
      result.x += point.x / 4;
      result.y += point.y / 4;
    }
    compensateHalfIntegerRoundingError(result);
    return result;
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

  async _retryAction(progress: Progress, actionName: string, action: (retry: number) => Promise<PerformActionResult>, options: { trial?: boolean, force?: boolean, skipLocatorHandlersCheckpoint?: boolean }): Promise<'error:notconnected' | 'done'> {
    let retry = 0;
    // We progressively wait longer between retries, up to 500ms.
    const waitTime = [0, 20, 100, 100, 500];

    while (progress.isRunning()) {
      if (retry) {
        progress.log(`retrying ${actionName} action${options.trial ? ' (trial run)' : ''}, attempt #${retry}`);
        const timeout = waitTime[Math.min(retry - 1, waitTime.length - 1)];
        if (timeout) {
          progress.log(`  waiting ${timeout}ms`);
          const result = await this.evaluateInUtility(([injected, node, timeout]) => new Promise<void>(f => setTimeout(f, timeout)), timeout);
          if (result === 'error:notconnected')
            return result;
        }
      } else {
        progress.log(`attempting ${actionName} action${options.trial ? ' (trial run)' : ''}`);
      }
      if (!options.skipLocatorHandlersCheckpoint && !options.force)
        await this._frame._page.performLocatorHandlersCheckpoint(progress);
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
    return 'done';
  }

  async _retryPointerAction(progress: Progress, actionName: ActionName, waitForEnabled: boolean, action: (point: types.Point) => Promise<void>,
    options: { waitAfter: boolean | 'disabled' } & types.PointerActionOptions & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    // Note: do not perform locator handlers checkpoint to avoid moving the mouse in the middle of a drag operation.
    const skipLocatorHandlersCheckpoint = actionName === 'move and up';
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
    }, { ...options, skipLocatorHandlersCheckpoint });
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
      return await this._scrollRectIntoViewIfNeeded(position ? { x: position.x, y: position.y, width: 0, height: 0 } : undefined);
    };

    if (this._frame.parentFrame()) {
      // Best-effort scroll to make sure any iframes containing this element are scrolled
      // into view and visible, so they are not throttled.
      // See https://github.com/microsoft/playwright/issues/27196 for an example.
      progress.throwIfAborted();  // Avoid action that has side-effects.
      await doScrollIntoView().catch(() => {});
    }

    if ((options as any).__testHookBeforeStable)
      await (options as any).__testHookBeforeStable();

    if (!force) {
      const elementStates: ElementState[] = waitForEnabled ? ['visible', 'enabled', 'stable'] : ['visible', 'stable'];
      progress.log(`  waiting for element to be ${waitForEnabled ? 'visible, enabled and stable' : 'visible and stable'}`);
      const result = await this.evaluateInUtility(async ([injected, node, { elementStates }]) => {
        return await injected.checkElementStates(node, elementStates);
      }, { elementStates });
      if (result)
        return result;
      progress.log(`  element is ${waitForEnabled ? 'visible, enabled and stable' : 'visible and stable'}`);
    }

    if ((options as any).__testHookAfterStable)
      await (options as any).__testHookAfterStable();

    progress.log('  scrolling into view if needed');
    progress.throwIfAborted();  // Avoid action that has side-effects.
    const scrolled = await doScrollIntoView();
    if (scrolled !== 'done')
      return scrolled;
    progress.log('  done scrolling');

    const maybePoint = position ? await this._offsetPoint(position) : await this._clickablePoint();
    if (typeof maybePoint === 'string')
      return maybePoint;
    const point = roundPoint(maybePoint);
    progress.metadata.point = point;
    await progress.beforeInputAction(this);

    let hitTargetInterceptionHandle: js.JSHandle<HitTargetInterceptionResult> | undefined;
    if (force) {
      progress.log(`  forcing action`);
    } else {
      if ((options as any).__testHookBeforeHitTarget)
        await (options as any).__testHookBeforeHitTarget();

      const frameCheckResult = await this._checkFrameIsHitTarget(point);
      if (frameCheckResult === 'error:notconnected' || ('hitTargetDescription' in frameCheckResult))
        return frameCheckResult;
      const hitPoint = frameCheckResult.framePoint;
      const actionType = actionName === 'move and up' ? 'drag' : ((actionName === 'hover' || actionName === 'tap') ? actionName : 'mouse');
      const handle = await this.evaluateHandleInUtility(([injected, node, { actionType, hitPoint, trial }]) => injected.setupHitTargetInterceptor(node, actionType, hitPoint, trial), { actionType, hitPoint, trial: !!options.trial } as const);
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

    const actionResult = await this._page._frameManager.waitForSignalsCreatedBy(progress, options.waitAfter === true, async () => {
      if ((options as any).__testHookBeforePointerAction)
        await (options as any).__testHookBeforePointerAction();
      progress.throwIfAborted();  // Avoid action that has side-effects.
      let restoreModifiers: types.KeyboardModifier[] | undefined;
      if (options && options.modifiers)
        restoreModifiers = await this._page.keyboard.ensureModifiers(options.modifiers);
      progress.log(`  performing ${actionName} action`);
      await action(point);
      if (restoreModifiers)
        await this._page.keyboard.ensureModifiers(restoreModifiers);
      if (hitTargetInterceptionHandle) {
        const stopHitTargetInterception = this._frame.raceAgainstEvaluationStallingEvents(() => {
          return hitTargetInterceptionHandle.evaluate(h => h.stop());
        }).catch(e => 'done' as const).finally(() => {
          hitTargetInterceptionHandle?.dispose();
        });
        if (options.waitAfter !== false) {
          // When noWaitAfter is passed, we do not want to accidentally stall on
          // non-committed navigation blocking the evaluate.
          const hitTargetResult = await stopHitTargetInterception;
          if (hitTargetResult !== 'done')
            return hitTargetResult;
        }
      }
      progress.log(`  ${options.trial ? 'trial ' : ''}${actionName} action done`);
      progress.log('  waiting for scheduled navigations to finish');
      if ((options as any).__testHookAfterPointerAction)
        await (options as any).__testHookAfterPointerAction();
      return 'done';
    });
    if (actionResult !== 'done')
      return actionResult;
    progress.log('  navigations have finished');
    return 'done';
  }

  async hover(metadata: CallMetadata, options: types.PointerActionOptions & types.PointerActionWaitOptions): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._hover(progress, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  _hover(progress: Progress, options: types.PointerActionOptions & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'hover', false /* waitForEnabled */, point => this._page.mouse.move(point.x, point.y), { ...options, waitAfter: 'disabled' });
  }

  async click(metadata: CallMetadata, options: { noWaitAfter?: boolean } & types.MouseClickOptions & types.PointerActionWaitOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._click(progress, { ...options, waitAfter: !options.noWaitAfter });
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  _click(progress: Progress, options: { waitAfter: boolean | 'disabled' } & types.MouseClickOptions & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'click', true /* waitForEnabled */, point => this._page.mouse.click(point.x, point.y, options), options);
  }

  async dblclick(metadata: CallMetadata, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._dblclick(progress, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  _dblclick(progress: Progress, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'dblclick', true /* waitForEnabled */, point => this._page.mouse.dblclick(point.x, point.y, options), { ...options, waitAfter: 'disabled' });
  }

  async tap(metadata: CallMetadata, options: types.PointerActionWaitOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._tap(progress, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  _tap(progress: Progress, options: types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'tap', true /* waitForEnabled */, point => this._page.touchscreen.tap(point.x, point.y), { ...options, waitAfter: 'disabled' });
  }

  async selectOption(metadata: CallMetadata, elements: ElementHandle[], values: types.SelectOption[], options: types.CommonActionOptions): Promise<string[]> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._selectOption(progress, elements, values, options);
      return throwRetargetableDOMError(result);
    }, this._page._timeoutSettings.timeout(options));
  }

  async _selectOption(progress: Progress, elements: ElementHandle[], values: types.SelectOption[], options: types.CommonActionOptions): Promise<string[] | 'error:notconnected'> {
    let resultingOptions: string[] = [];
    await this._retryAction(progress, 'select option', async () => {
      await progress.beforeInputAction(this);
      if (!options.force)
        progress.log(`  waiting for element to be visible and enabled`);
      const optionsToSelect = [...elements, ...values];
      const result = await this.evaluateInUtility(async ([injected, node, { optionsToSelect, force }]) => {
        if (!force) {
          const checkResult = await injected.checkElementStates(node, ['visible', 'enabled']);
          if (checkResult)
            return checkResult;
        }
        return injected.selectOptions(node, optionsToSelect);
      }, { optionsToSelect, force: options.force });
      if (Array.isArray(result)) {
        progress.log('  selected specified option(s)');
        resultingOptions = result;
        return 'done';
      }
      return result;
    }, options);
    return resultingOptions;
  }

  async fill(metadata: CallMetadata, value: string, options: types.CommonActionOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._fill(progress, value, options);
      assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _fill(progress: Progress, value: string, options: types.CommonActionOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`  fill("${value}")`);
    return await this._retryAction(progress, 'fill', async () => {
      await progress.beforeInputAction(this);
      if (!options.force)
        progress.log('  waiting for element to be visible, enabled and editable');
      const result = await this.evaluateInUtility(async ([injected, node, { value, force }]) => {
        if (!force) {
          const checkResult = await injected.checkElementStates(node, ['visible', 'enabled', 'editable']);
          if (checkResult)
            return checkResult;
        }
        return injected.fill(node, value);
      }, { value, force: options.force });
      progress.throwIfAborted();  // Avoid action that has side-effects.
      if (result === 'needsinput') {
        if (value)
          await this._page.keyboard.insertText(value);
        else
          await this._page.keyboard.press('Delete');
        return 'done';
      } else {
        return result;
      }
    }, options);
  }

  async selectText(metadata: CallMetadata, options: types.CommonActionOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._retryAction(progress, 'selectText', async () => {
        if (!options.force)
          progress.log('  waiting for element to be visible');
        return await this.evaluateInUtility(async ([injected, node, { force }]) => {
          if (!force) {
            const checkResult = await injected.checkElementStates(node, ['visible']);
            if (checkResult)
              return checkResult;
          }
          return injected.selectText(node);
        }, { force: options.force });
      }, options);
      assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async setInputFiles(metadata: CallMetadata, params: channels.ElementHandleSetInputFilesParams) {
    const inputFileItems = await prepareFilesForUpload(this._frame, params);
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._setInputFiles(progress, inputFileItems);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(params));
  }

  async _setInputFiles(progress: Progress, items: InputFilesItems): Promise<'error:notconnected' | 'done'> {
    const { filePayloads, localPaths, localDirectory } = items;
    const multiple = filePayloads && filePayloads.length > 1 || localPaths && localPaths.length > 1;
    const result = await this.evaluateHandleInUtility(([injected, node, { multiple, directoryUpload }]): Element | undefined => {
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
    }, { multiple, directoryUpload: !!localDirectory });
    if (result === 'error:notconnected' || !result.asElement())
      return 'error:notconnected';
    const retargeted = result.asElement() as ElementHandle<HTMLInputElement>;
    await progress.beforeInputAction(this);
    progress.throwIfAborted();  // Avoid action that has side-effects.
    if (localPaths || localDirectory) {
      const localPathsOrDirectory = localDirectory ? [localDirectory] : localPaths!;
      await Promise.all((localPathsOrDirectory).map(localPath => (
        fs.promises.access(localPath, fs.constants.F_OK)
      )));
      // Browsers traverse the given directory asynchronously and we want to ensure all files are uploaded.
      const waitForInputEvent = localDirectory ? this.evaluate(node => new Promise<any>(fulfill => {
        node.addEventListener('input', fulfill, { once: true });
      })).catch(() => {}) : Promise.resolve();
      await this._page._delegate.setInputFilePaths(retargeted, localPathsOrDirectory);
      await waitForInputEvent;
    } else {
      await this._page._delegate.setInputFiles(retargeted, filePayloads!);
    }
    return 'done';
  }

  async focus(metadata: CallMetadata): Promise<void> {
    const controller = new ProgressController(metadata, this);
    await controller.run(async progress => {
      const result = await this._focus(progress);
      return assertDone(throwRetargetableDOMError(result));
    }, 0);
  }

  async _focus(progress: Progress, resetSelectionIfNotFocused?: boolean): Promise<'error:notconnected' | 'done'> {
    progress.throwIfAborted();  // Avoid action that has side-effects.
    return await this.evaluateInUtility(([injected, node, resetSelectionIfNotFocused]) => injected.focusNode(node, resetSelectionIfNotFocused), resetSelectionIfNotFocused);
  }

  async _blur(progress: Progress): Promise<'error:notconnected' | 'done'> {
    progress.throwIfAborted();  // Avoid action that has side-effects.
    return await this.evaluateInUtility(([injected, node]) => injected.blurNode(node), {});
  }

  async type(metadata: CallMetadata, text: string, options: { delay?: number } & types.TimeoutOptions & types.StrictOptions): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._type(progress, text, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _type(progress: Progress, text: string, options: { delay?: number } & types.TimeoutOptions & types.StrictOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`elementHandle.type("${text}")`);
    await progress.beforeInputAction(this);
    const result = await this._focus(progress, true /* resetSelectionIfNotFocused */);
    if (result !== 'done')
      return result;
    progress.throwIfAborted();  // Avoid action that has side-effects.
    await this._page.keyboard.type(text, options);
    return 'done';
  }

  async press(metadata: CallMetadata, key: string, options: { delay?: number, noWaitAfter?: boolean } & types.TimeoutOptions & types.StrictOptions): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._press(progress, key, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _press(progress: Progress, key: string, options: { delay?: number, noWaitAfter?: boolean } & types.TimeoutOptions & types.StrictOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`elementHandle.press("${key}")`);
    await progress.beforeInputAction(this);
    return this._page._frameManager.waitForSignalsCreatedBy(progress, !options.noWaitAfter, async () => {
      const result = await this._focus(progress, true /* resetSelectionIfNotFocused */);
      if (result !== 'done')
        return result;
      progress.throwIfAborted();  // Avoid action that has side-effects.
      await this._page.keyboard.press(key, options);
      return 'done';
    });
  }

  async check(metadata: CallMetadata, options: { position?: types.Point } & types.PointerActionWaitOptions) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._setChecked(progress, true, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async uncheck(metadata: CallMetadata, options: { position?: types.Point } & types.PointerActionWaitOptions) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._setChecked(progress, false, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _setChecked(progress: Progress, state: boolean, options: { position?: types.Point } & types.PointerActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    const isChecked = async () => {
      const result = await this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'checked'), {});
      return throwRetargetableDOMError(result);
    };
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
    return this._page._delegate.getBoundingBox(this);
  }

  async screenshot(metadata: CallMetadata, options: ScreenshotOptions & TimeoutOptions = {}): Promise<Buffer> {
    const controller = new ProgressController(metadata, this);
    return controller.run(
        progress => this._page._screenshotter.screenshotElement(progress, this, options),
        this._page._timeoutSettings.timeout(options));
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

  async isVisible(metadata: CallMetadata): Promise<boolean> {
    return this._frame.isVisible(metadata, ':scope', {}, this);
  }

  async isHidden(metadata: CallMetadata): Promise<boolean> {
    return this._frame.isHidden(metadata, ':scope', {}, this);
  }

  async isEnabled(metadata: CallMetadata): Promise<boolean> {
    return this._frame.isEnabled(metadata, ':scope', {}, this);
  }

  async isDisabled(metadata: CallMetadata): Promise<boolean> {
    return this._frame.isDisabled(metadata, ':scope', {}, this);
  }

  async isEditable(metadata: CallMetadata): Promise<boolean> {
    return this._frame.isEditable(metadata, ':scope', {}, this);
  }

  async isChecked(metadata: CallMetadata): Promise<boolean> {
    return this._frame.isChecked(metadata, ':scope', {}, this);
  }

  async waitForElementState(metadata: CallMetadata, state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled' | 'editable', options: types.TimeoutOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const actionName = `wait for ${state}`;
      const result = await this._retryAction(progress, actionName, async () => {
        return await this.evaluateInUtility(async ([injected, node, state]) => {
          return (await injected.checkElementStates(node, [state])) || 'done';
        }, state);
      }, {});
      assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async waitForSelector(metadata: CallMetadata, selector: string, options: types.WaitForElementOptions = {}): Promise<ElementHandle<Element> | null> {
    return this._frame.waitForSelector(metadata, selector, options, this);
  }

  async _adoptTo(context: FrameExecutionContext): Promise<ElementHandle<T>> {
    if (this._context !== context) {
      const adopted = await this._page._delegate.adoptElementHandle(this, context);
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
    throw new Error('Element is not attached to the DOM');
  return result;
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

function compensateHalfIntegerRoundingError(point: types.Point) {
  // Firefox internally uses integer coordinates, so 8.5 is converted to 9 when clicking.
  //
  // This does not work nicely for small elements. For example, 1x1 square with corners
  // (8;8) and (9;9) is targeted when clicking at (8;8) but not when clicking at (9;9).
  // So, clicking at (8.5;8.5) will effectively click at (9;9) and miss the target.
  //
  // Therefore, we skew half-integer values from the interval (8.49, 8.51) towards
  // (8.47, 8.49) that is rounded towards 8. This means clicking at (8.5;8.5) will
  // be replaced with (8.48;8.48) and will effectively click at (8;8).
  //
  // Other browsers use float coordinates, so this change should not matter.
  const remainderX = point.x - Math.floor(point.x);
  if (remainderX > 0.49 && remainderX < 0.51)
    point.x -= 0.02;
  const remainderY = point.y - Math.floor(point.y);
  if (remainderY > 0.49 && remainderY < 0.51)
    point.y -= 0.02;
}

export const kUnableToAdoptErrorMessage = 'Unable to adopt element handle from a different document';
