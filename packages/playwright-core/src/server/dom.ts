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

import { mime } from '../utilsBundle';
import * as injectedScriptSource from '../generated/injectedScriptSource';
import type * as channels from '../protocol/channels';
import { isSessionClosedError } from './protocolError';
import type { ScreenshotOptions } from './screenshotter';
import type * as frames from './frames';
import type { InjectedScript, InjectedScriptPoll, LogEntry, HitTargetInterceptionResult, ElementState } from './injected/injectedScript';
import type { CallMetadata } from './instrumentation';
import * as js from './javascript';
import type { Page } from './page';
import type { Progress } from './progress';
import { ProgressController } from './progress';
import type { SelectorInfo } from './selectors';
import type * as types from './types';
import type { TimeoutOptions } from '../common/types';
import { experimentalFeaturesEnabled, isUnderTest } from '../utils';

type SetInputFilesFiles = channels.ElementHandleSetInputFilesParams['files'];
export type InputFilesItems = { files?: SetInputFilesFiles, localPaths?: string[] };
type ActionName = 'click' | 'hover' | 'dblclick' | 'tap' | 'move and up' | 'move and down';

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
    super(frame, delegate);
    this.frame = frame;
    this.world = world;
  }

  override async waitForSignalsCreatedBy<T>(action: () => Promise<T>): Promise<T> {
    return this.frame._page._frameManager.waitForSignalsCreatedBy(null, false, action);
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

  async evaluateExpression(expression: string, isFunction: boolean | undefined, arg?: any): Promise<any> {
    return js.evaluateExpression(this, true /* returnByValue */, expression, isFunction, arg);
  }

  async evaluateExpressionAndWaitForSignals(expression: string, isFunction: boolean | undefined, arg?: any): Promise<any> {
    return await this.frame._page._frameManager.waitForSignalsCreatedBy(null, false /* noWaitFor */, async () => {
      return this.evaluateExpression(expression, isFunction, arg);
    });
  }

  async evaluateExpressionHandleAndWaitForSignals(expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return await this.frame._page._frameManager.waitForSignalsCreatedBy(null, false /* noWaitFor */, async () => {
      return js.evaluateExpression(this, false /* returnByValue */, expression, isFunction, arg);
    });
  }

  override createHandle(remoteObject: js.RemoteObject): js.JSHandle {
    if (this.frame._page._delegate.isElementHandle(remoteObject))
      return new ElementHandle(this, remoteObject.objectId!);
    return super.createHandle(remoteObject);
  }

  injectedScript(): Promise<js.JSHandle<InjectedScript>> {
    if (!this._injectedScriptPromise) {
      const custom: string[] = [];
      for (const [name, { source }] of this.frame._page.selectors._engines)
        custom.push(`{ name: '${name}', engine: (${source}) }`);
      const source = `
        (() => {
        const module = {};
        ${injectedScriptSource.source}
        return new module.exports(
          ${isUnderTest()},
          ${this.frame._page._delegate.rafCountForStablePosition()},
          "${this.frame._page._browserContext._browser.options.name}",
          ${experimentalFeaturesEnabled()},
          [${custom.join(',\n')}]
        );
        })();
      `;
      this._injectedScriptPromise = this.rawEvaluateHandle(source).then(objectId => new js.JSHandle(this, 'object', undefined, objectId));
    }
    return this._injectedScriptPromise;
  }

  override async doSlowMo() {
    return this.frame._page._doSlowMo();
  }
}

export class ElementHandle<T extends Node = Node> extends js.JSHandle<T> {
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

  async evaluatePoll<R, Arg>(progress: Progress, pageFunction: js.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], InjectedScriptPoll<R>>, arg: Arg): Promise<R | 'error:notconnected'> {
    try {
      const utility = await this._frame._utilityContext();
      const poll = await utility.evaluateHandle(pageFunction, [await utility.injectedScript(), this, arg]);
      const pollHandler = new InjectedScriptPollHandler(progress, poll);
      return await pollHandler.finish();
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

  async getAttribute(name: string): Promise<string | null> {
    return throwRetargetableDOMError(await this.evaluateInUtility(([injected, node, name]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw injected.createStacklessError('Node is not an element');
      const element = node as unknown as Element;
      return { value: element.getAttribute(name) };
    }, name)).value;
  }

  async inputValue(): Promise<string> {
    return throwRetargetableDOMError(await this.evaluateInUtility(([injected, node]) => {
      const element = injected.retarget(node, 'follow-label');
      if (!element || (element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA' && element.nodeName !== 'SELECT'))
        throw injected.createStacklessError('Node is not an <input>, <textarea> or <select> element');
      return { value: (element as HTMLInputElement | HTMLTextAreaElement).value };
    }, undefined)).value;
  }

  async textContent(): Promise<string | null> {
    return throwRetargetableDOMError(await this.evaluateInUtility(([injected, node]) => {
      return { value: node.textContent };
    }, undefined)).value;
  }

  async innerText(): Promise<string> {
    return throwRetargetableDOMError(await this.evaluateInUtility(([injected, node]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw injected.createStacklessError('Node is not an element');
      if ((node as unknown as Element).namespaceURI !== 'http://www.w3.org/1999/xhtml')
        throw injected.createStacklessError('Node is not an HTMLElement');
      const element = node as unknown as HTMLElement;
      return { value: element.innerText };
    }, undefined)).value;
  }

  async innerHTML(): Promise<string> {
    return throwRetargetableDOMError(await this.evaluateInUtility(([injected, node]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw injected.createStacklessError('Node is not an element');
      const element = node as unknown as Element;
      return { value: element.innerHTML };
    }, undefined)).value;
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    const main = await this._frame._mainContext();
    await this._page._frameManager.waitForSignalsCreatedBy(null, false /* noWaitFor */, async () => {
      return main.evaluate(([injected, node, { type, eventInit }]) => injected.dispatchEvent(node, type, eventInit), [await main.injectedScript(), this, { type, eventInit }] as const);
    });
    await this._page._doSlowMo();
  }

  async _scrollRectIntoViewIfNeeded(rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return await this._page._delegate.scrollRectIntoViewIfNeeded(this, rect);
  }

  async _waitAndScrollIntoViewIfNeeded(progress: Progress, waitForVisible: boolean): Promise<void> {
    const timeouts = [0, 50, 100, 250];
    while (progress.isRunning()) {
      assertDone(throwRetargetableDOMError(await this._waitForElementStates(progress, waitForVisible ? ['visible', 'stable'] : ['stable'], false /* force */)));
      progress.throwIfAborted();  // Avoid action that has side-effects.
      const result = throwRetargetableDOMError(await this._scrollRectIntoViewIfNeeded());
      if (result === 'error:notvisible') {
        if (!waitForVisible) {
          // Wait for a timeout to avoid retrying too often when not waiting for visible.
          // If we wait for visible, this should be covered by _waitForElementStates instead.
          const timeout = timeouts.shift() ?? 500;
          progress.log(`  element is not displayed, retrying in ${timeout}ms`);
          await new Promise(f => setTimeout(f, timeout));
        }
        continue;
      }
      assertDone(result);
      return;
    }
  }

  async scrollIntoViewIfNeeded(metadata: CallMetadata, options: types.TimeoutOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(
        progress => this._waitAndScrollIntoViewIfNeeded(progress, false /* waitForVisible */),
        this._page._timeoutSettings.timeout(options));
  }

  private async _clickablePoint(): Promise<types.Point | 'error:notvisible' | 'error:notinviewport'> {
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

  async _retryPointerAction(progress: Progress, actionName: ActionName, waitForEnabled: boolean, action: (point: types.Point) => Promise<void>,
    options: types.PointerActionOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    let retry = 0;
    // We progressively wait longer between retries, up to 500ms.
    const waitTime = [0, 20, 100, 100, 500];

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
      const forceScrollOptions = scrollOptions[retry % scrollOptions.length];
      const result = await this._performPointerAction(progress, actionName, waitForEnabled, action, forceScrollOptions, options);
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
      if (typeof result === 'object' && 'hitTargetDescription' in result) {
        progress.log(`  ${result.hitTargetDescription} intercepts pointer events`);
        continue;
      }
      return result;
    }
    return 'done';
  }

  async _performPointerAction(progress: Progress, actionName: ActionName, waitForEnabled: boolean, action: (point: types.Point) => Promise<void>, forceScrollOptions: ScrollIntoViewOptions | undefined, options: types.PointerActionOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<'error:notvisible' | 'error:notconnected' | 'error:notinviewport' | { hitTargetDescription: string } | 'done'> {
    const { force = false, position } = options;
    if ((options as any).__testHookBeforeStable)
      await (options as any).__testHookBeforeStable();
    const result = await this._waitForElementStates(progress, waitForEnabled ? ['visible', 'enabled', 'stable'] : ['visible', 'stable'], force);
    if (result !== 'done')
      return result;
    if ((options as any).__testHookAfterStable)
      await (options as any).__testHookAfterStable();

    progress.log('  scrolling into view if needed');
    progress.throwIfAborted();  // Avoid action that has side-effects.
    if (forceScrollOptions) {
      const scrolled = await this.evaluateInUtility(([injected, node, options]) => {
        if (node.nodeType === 1 /* Node.ELEMENT_NODE */)
          (node as Node as Element).scrollIntoView(options);
      }, forceScrollOptions);
      if (scrolled === 'error:notconnected')
        return scrolled;
    } else {
      const scrolled = await this._scrollRectIntoViewIfNeeded(position ? { x: position.x, y: position.y, width: 0, height: 0 } : undefined);
      if (scrolled !== 'done')
        return scrolled;
    }
    progress.log('  done scrolling');

    const maybePoint = position ? await this._offsetPoint(position) : await this._clickablePoint();
    if (typeof maybePoint === 'string')
      return maybePoint;
    const point = roundPoint(maybePoint);
    progress.metadata.point = point;
    await progress.beforeInputAction(this);

    let hitTargetInterceptionHandle: js.JSHandle<HitTargetInterceptionResult> | undefined;
    if (!options.force) {
      if ((options as any).__testHookBeforeHitTarget)
        await (options as any).__testHookBeforeHitTarget();

      if (actionName === 'move and up') {
        // When dropping, the "element that is being dragged" often stays under the cursor,
        // so hit target check at the moment we receive mousedown does not work -
        // it finds the "element that is being dragged" instead of the
        // "element that we drop onto".
        progress.log(`  checking that element receives pointer events at (${point.x},${point.y})`);
        const hitTargetResult = await this._checkHitTargetAt(point);
        if (hitTargetResult !== 'done')
          return hitTargetResult;
        progress.log(`  element does receive pointer events`);
        if (options.trial) {
          progress.log(`  trial ${actionName} has finished`);
          return 'done';
        }
      } else {
        const actionType = (actionName === 'hover' || actionName === 'tap') ? actionName : 'mouse';
        const handle = await this.evaluateHandleInUtility(([injected, node, { actionType, trial }]) => injected.setupHitTargetInterceptor(node, actionType, trial), { actionType, trial: !!options.trial } as const);
        if (handle === 'error:notconnected')
          return handle;
        if (!handle._objectId)
          return handle.rawValue() as 'error:notconnected';
        hitTargetInterceptionHandle = handle as any;
        progress.cleanupWhenAborted(() => {
          // Do not await here, just in case the renderer is stuck (e.g. on alert)
          // and we won't be able to cleanup.
          hitTargetInterceptionHandle!.evaluate(h => h.stop()).catch(e => {});
        });
      }
    }

    const actionResult = await this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      if ((options as any).__testHookBeforePointerAction)
        await (options as any).__testHookBeforePointerAction();
      progress.throwIfAborted();  // Avoid action that has side-effects.
      let restoreModifiers: types.KeyboardModifier[] | undefined;
      if (options && options.modifiers)
        restoreModifiers = await this._page.keyboard._ensureModifiers(options.modifiers);
      progress.log(`  performing ${actionName} action`);
      await action(point);
      if (restoreModifiers)
        await this._page.keyboard._ensureModifiers(restoreModifiers);
      if (hitTargetInterceptionHandle) {
        const stopHitTargetInterception = hitTargetInterceptionHandle.evaluate(h => h.stop()).catch(e => 'done' as const);
        if (!options.noWaitAfter) {
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
    }, 'input');
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
    return this._retryPointerAction(progress, 'hover', false /* waitForEnabled */, point => this._page.mouse.move(point.x, point.y), options);
  }

  async click(metadata: CallMetadata, options: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._click(progress, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  _click(progress: Progress, options: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'click', true /* waitForEnabled */, point => this._page.mouse.click(point.x, point.y, options), options);
  }

  async dblclick(metadata: CallMetadata, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._dblclick(progress, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  _dblclick(progress: Progress, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'dblclick', true /* waitForEnabled */, point => this._page.mouse.dblclick(point.x, point.y, options), options);
  }

  async tap(metadata: CallMetadata, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._tap(progress, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  _tap(progress: Progress, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    return this._retryPointerAction(progress, 'tap', true /* waitForEnabled */, point => this._page.touchscreen.tap(point.x, point.y), options);
  }

  async selectOption(metadata: CallMetadata, elements: ElementHandle[], values: types.SelectOption[], options: types.NavigatingActionWaitOptions & types.ForceOptions): Promise<string[]> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._selectOption(progress, elements, values, options);
      return throwRetargetableDOMError(result);
    }, this._page._timeoutSettings.timeout(options));
  }

  async _selectOption(progress: Progress, elements: ElementHandle[], values: types.SelectOption[], options: types.NavigatingActionWaitOptions & types.ForceOptions): Promise<string[] | 'error:notconnected'> {
    const optionsToSelect = [...elements, ...values];
    await progress.beforeInputAction(this);
    return this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      progress.throwIfAborted();  // Avoid action that has side-effects.
      progress.log('  selecting specified option(s)');
      const result = await this.evaluatePoll(progress, ([injected, node, { optionsToSelect, force }]) => {
        return injected.waitForElementStatesAndPerformAction(node, ['visible', 'enabled'], force, injected.selectOptions.bind(injected, optionsToSelect));
      }, { optionsToSelect, force: options.force });
      await this._page._doSlowMo();
      return result;
    });
  }

  async fill(metadata: CallMetadata, value: string, options: types.NavigatingActionWaitOptions & types.ForceOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._fill(progress, value, options);
      assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _fill(progress: Progress, value: string, options: types.NavigatingActionWaitOptions & types.ForceOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`elementHandle.fill("${value}")`);
    await progress.beforeInputAction(this);
    return this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      progress.log('  waiting for element to be visible, enabled and editable');
      const filled = await this.evaluatePoll(progress, ([injected, node, { value, force }]) => {
        return injected.waitForElementStatesAndPerformAction(node, ['visible', 'enabled', 'editable'], force, injected.fill.bind(injected, value));
      }, { value, force: options.force });
      progress.throwIfAborted();  // Avoid action that has side-effects.
      if (filled === 'error:notconnected')
        return filled;
      progress.log('  element is visible, enabled and editable');
      if (filled === 'needsinput') {
        progress.throwIfAborted();  // Avoid action that has side-effects.
        if (value)
          await this._page.keyboard.insertText(value);
        else
          await this._page.keyboard.press('Delete');
      } else {
        assertDone(filled);
      }
      return 'done';
    }, 'input');
  }

  async selectText(metadata: CallMetadata, options: types.TimeoutOptions & types.ForceOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      progress.throwIfAborted();  // Avoid action that has side-effects.
      const result = await this.evaluatePoll(progress, ([injected, node, force]) => {
        return injected.waitForElementStatesAndPerformAction(node, ['visible'], force, injected.selectText.bind(injected));
      }, options.force);
      assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async setInputFiles(metadata: CallMetadata, items: InputFilesItems, options: types.NavigatingActionWaitOptions) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._setInputFiles(progress, items, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _setInputFiles(progress: Progress, items: InputFilesItems, options: types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    const { files, localPaths } = items;
    if (files) {
      for (const payload of files) {
        if (!payload.mimeType)
          payload.mimeType = mime.getType(payload.name) || 'application/octet-stream';
      }
    }
    const multiple = files && files.length > 1 || localPaths && localPaths.length > 1;
    const result = await this.evaluateHandleInUtility(([injected, node, multiple]): Element | undefined => {
      const element = injected.retarget(node, 'follow-label');
      if (!element)
        return;
      if (element.tagName !== 'INPUT')
        throw injected.createStacklessError('Node is not an HTMLInputElement');
      if (multiple && !(element as HTMLInputElement).multiple)
        throw injected.createStacklessError('Non-multiple file input can only accept single file');
      return element;
    }, multiple);
    if (result === 'error:notconnected' || !result.asElement())
      return 'error:notconnected';
    const retargeted = result.asElement() as ElementHandle<HTMLInputElement>;
    await progress.beforeInputAction(this);
    await this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      progress.throwIfAborted();  // Avoid action that has side-effects.
      if (localPaths)
        await this._page._delegate.setInputFilePaths(retargeted, localPaths);
      else
        await this._page._delegate.setInputFiles(retargeted, files as types.FilePayload[]);
    });
    await this._page._doSlowMo();
    return 'done';
  }

  async focus(metadata: CallMetadata): Promise<void> {
    const controller = new ProgressController(metadata, this);
    await controller.run(async progress => {
      const result = await this._focus(progress);
      await this._page._doSlowMo();
      return assertDone(throwRetargetableDOMError(result));
    }, 0);
  }

  async _focus(progress: Progress, resetSelectionIfNotFocused?: boolean): Promise<'error:notconnected' | 'done'> {
    progress.throwIfAborted();  // Avoid action that has side-effects.
    return await this.evaluateInUtility(([injected, node, resetSelectionIfNotFocused]) => injected.focusNode(node, resetSelectionIfNotFocused), resetSelectionIfNotFocused);
  }

  async type(metadata: CallMetadata, text: string, options: { delay?: number } & types.NavigatingActionWaitOptions): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._type(progress, text, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _type(progress: Progress, text: string, options: { delay?: number } & types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`elementHandle.type("${text}")`);
    await progress.beforeInputAction(this);
    return this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      const result = await this._focus(progress, true /* resetSelectionIfNotFocused */);
      if (result !== 'done')
        return result;
      progress.throwIfAborted();  // Avoid action that has side-effects.
      await this._page.keyboard.type(text, options);
      return 'done';
    }, 'input');
  }

  async press(metadata: CallMetadata, key: string, options: { delay?: number } & types.NavigatingActionWaitOptions): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._press(progress, key, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _press(progress: Progress, key: string, options: { delay?: number } & types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    progress.log(`elementHandle.press("${key}")`);
    await progress.beforeInputAction(this);
    return this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      const result = await this._focus(progress, true /* resetSelectionIfNotFocused */);
      if (result !== 'done')
        return result;
      progress.throwIfAborted();  // Avoid action that has side-effects.
      await this._page.keyboard.press(key, options);
      return 'done';
    }, 'input');
  }

  async check(metadata: CallMetadata, options: { position?: types.Point } & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._setChecked(progress, true, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async uncheck(metadata: CallMetadata, options: { position?: types.Point } & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._setChecked(progress, false, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _setChecked(progress: Progress, state: boolean, options: { position?: types.Point } & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    const isChecked = async () => {
      const result = await this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'checked'), {});
      return throwRetargetableDOMError(result);
    };
    if (await isChecked() === state)
      return 'done';
    const result = await this._click(progress, options);
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
    const pair = await this._frame.resolveFrameForSelectorNoWait(selector, options, this);
    if (!pair)
      return null;
    const { frame, info } = pair;
    // If we end up in the same frame => use the scope again, line above was noop.
    return this._page.selectors.query(frame, info, this._frame === frame ? this : undefined);
  }

  async querySelectorAll(selector: string): Promise<ElementHandle<Element>[]> {
    const pair = await this._frame.resolveFrameForSelectorNoWait(selector, {}, this);
    if (!pair)
      return [];
    const { frame, info } = pair;
    // If we end up in the same frame => use the scope again, line above was noop.
    return this._page.selectors._queryAll(frame, info, this._frame === frame ? this : undefined, true /* adoptToMain */);
  }

  async evalOnSelectorAndWaitForSignals(selector: string, strict: boolean, expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    const pair = await this._frame.resolveFrameForSelectorNoWait(selector, { strict }, this);
    // If we end up in the same frame => use the scope again, line above was noop.
    const handle = pair ? await this._page.selectors.query(pair.frame, pair.info, this._frame === pair.frame ? this : undefined) : null;
    if (!handle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await handle.evaluateExpressionAndWaitForSignals(expression, isFunction, true, arg);
    handle.dispose();
    return result;
  }

  async evalOnSelectorAllAndWaitForSignals(selector: string, expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    const pair = await this._frame.resolveFrameForSelectorNoWait(selector, {}, this);
    if (!pair)
      throw new Error(`Error: failed to find frame for selector "${selector}"`);
    const { frame, info } = pair;
    // If we end up in the same frame => use the scope again, line above was noop.
    const arrayHandle = await this._page.selectors._queryArrayInMainWorld(frame, info, this._frame === frame ? this : undefined);
    const result = await arrayHandle.evaluateExpressionAndWaitForSignals(expression, isFunction, true, arg);
    arrayHandle.dispose();
    return result;
  }

  async isVisible(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'visible'), {});
    if (result === 'error:notconnected')
      return false;
    return result;
  }

  async isHidden(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'hidden'), {});
    return throwRetargetableDOMError(result);
  }

  async isEnabled(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'enabled'), {});
    return throwRetargetableDOMError(result);
  }

  async isDisabled(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'disabled'), {});
    return throwRetargetableDOMError(result);
  }

  async isEditable(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'editable'), {});
    return throwRetargetableDOMError(result);
  }

  async isChecked(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.elementState(node, 'checked'), {});
    return throwRetargetableDOMError(result);
  }

  async waitForElementState(metadata: CallMetadata, state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled' | 'editable', options: types.TimeoutOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      progress.log(`  waiting for element to be ${state}`);
      const result = await this.evaluatePoll(progress, ([injected, node, state]) => {
        return injected.waitForElementStatesAndPerformAction(node, [state], false, () => 'done' as const);
      }, state);
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

  async _waitForElementStates(progress: Progress, states: ElementState[], force: boolean): Promise<'error:notconnected' | 'done'> {
    const title = joinWithAnd(states);
    progress.log(`  waiting for element to be ${title}`);
    const result = await this.evaluatePoll(progress, ([injected, node, { states, force }]) => {
      return injected.waitForElementStatesAndPerformAction(node, states, force, () => 'done' as const);
    }, { states, force });
    if (result === 'error:notconnected')
      return result;
    progress.log(`  element is ${title}`);
    return result;
  }

  async _checkHitTargetAt(point: types.Point): Promise<'error:notconnected' | { hitTargetDescription: string } | 'done'> {
    const frame = await this.ownerFrame();
    if (frame && frame.parentFrame()) {
      const element = await frame.frameElement();
      const box = await element.boundingBox();
      if (!box)
        return 'error:notconnected';
      // Translate from viewport coordinates to frame coordinates.
      point = { x: point.x - box.x, y: point.y - box.y };
    }
    return this.evaluateInUtility(([injected, node, point]) => injected.checkHitTargetAt(node, point), point);
  }
}

// Handles an InjectedScriptPoll running in injected script:
// - streams logs into progress;
// - cancels the poll when progress cancels.
export class InjectedScriptPollHandler<T> {
  private _progress: Progress;
  private _poll: js.JSHandle<InjectedScriptPoll<T>> | null;

  constructor(progress: Progress, poll: js.JSHandle<InjectedScriptPoll<T>>) {
    this._progress = progress;
    this._poll = poll;
    // Ensure we cancel the poll before progress aborts and returns:
    //   - no unnecessary work in the page;
    //   - no possible side effects after progress promsie rejects.
    this._progress.cleanupWhenAborted(() => this.cancel());
    this._streamLogs();
  }

  private async _streamLogs() {
    while (this._poll && this._progress.isRunning()) {
      const log = await this._poll.evaluate(poll => poll.takeNextLogs()).catch(e => [] as LogEntry[]);
      if (!this._poll || !this._progress.isRunning())
        return;
      for (const entry of log)
        this._progress.logEntry(entry);
    }
  }

  async finishHandle(): Promise<js.SmartHandle<T>> {
    try {
      const result = await this._poll!.evaluateHandle(poll => poll.run());
      await this._finishInternal();
      return result;
    } finally {
      await this.cancel();
    }
  }

  async finish(): Promise<T> {
    try {
      const result = await this._poll!.evaluate(poll => poll.run());
      await this._finishInternal();
      return result;
    } finally {
      await this.cancel();
    }
  }

  private async _finishInternal() {
    if (!this._poll)
      return;
    // Retrieve all the logs before continuing.
    const log = await this._poll.evaluate(poll => poll.takeLastLogs()).catch(e => [] as LogEntry[]);
    for (const entry of log)
      this._progress.logEntry(entry);
  }

  async cancel() {
    if (!this._poll)
      return;
    const copy = this._poll;
    this._poll = null;
    await copy.evaluate(p => p.cancel()).catch(e => {});
    copy.dispose();
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

export type SchedulableTask<T> = (injectedScript: js.JSHandle<InjectedScript>) => Promise<js.JSHandle<InjectedScriptPoll<T>>>;

export function waitForSelectorTask(selector: SelectorInfo, state: 'attached' | 'detached' | 'visible' | 'hidden', omitReturnValue?: boolean, root?: ElementHandle): SchedulableTask<Element | undefined> {
  return injectedScript => injectedScript.evaluateHandle((injected, { parsed, strict, state, omitReturnValue, root }) => {
    let lastElement: Element | undefined;

    return injected.pollRaf(progress => {
      const elements = injected.querySelectorAll(parsed, root || document);
      let element: Element | undefined  = elements[0];
      const visible = element ? injected.isVisible(element) : false;

      if (lastElement !== element) {
        lastElement = element;
        if (!element) {
          progress.log(`  selector did not resolve to any element`);
        } else {
          if (elements.length > 1) {
            if (strict)
              throw injected.strictModeViolationError(parsed, elements);
            progress.log(`  selector resolved to ${elements.length} elements. Proceeding with the first one.`);
          }
          progress.log(`  selector resolved to ${visible ? 'visible' : 'hidden'} ${injected.previewNode(element)}`);
        }
      }

      const hasElement = !!element;
      if (omitReturnValue)
        element = undefined;

      switch (state) {
        case 'attached':
          return hasElement ? element : progress.continuePolling;
        case 'detached':
          return !hasElement ? undefined : progress.continuePolling;
        case 'visible':
          return visible ? element : progress.continuePolling;
        case 'hidden':
          return !visible ? undefined : progress.continuePolling;
      }
    });
  }, { parsed: selector.parsed, strict: selector.strict, state, omitReturnValue, root });
}

function joinWithAnd(strings: string[]): string {
  if (strings.length < 1)
    return strings.join(', ');
  return strings.slice(0, strings.length - 1).join(', ') + ' and ' + strings[strings.length - 1];
}

export const kUnableToAdoptErrorMessage = 'Unable to adopt element handle from a different document';
