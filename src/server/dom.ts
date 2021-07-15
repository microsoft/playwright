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

import * as channels from '../protocol/channels';
import * as frames from './frames';
import type { ElementStateWithoutStable, InjectedScript, InjectedScriptPoll } from './injected/injectedScript';
import * as injectedScriptSource from '../generated/injectedScriptSource';
import * as js from './javascript';
import * as mime from 'mime';
import { Page } from './page';
import { SelectorInfo } from './selectors';
import * as types from './types';
import { Progress, ProgressController } from './progress';
import { FatalDOMError, RetargetableDOMError } from './common/domErrors';
import { CallMetadata } from './instrumentation';

type SetInputFilesFiles = channels.ElementHandleSetInputFilesParams['files'];

export class FrameExecutionContext extends js.ExecutionContext {
  readonly frame: frames.Frame;
  private _injectedScriptPromise?: Promise<js.JSHandle>;
  readonly world: types.World | null;

  constructor(delegate: js.ExecutionContextDelegate, frame: frames.Frame, world: types.World|null) {
    super(frame, delegate);
    this.frame = frame;
    this.world = world;
  }

  async waitForSignalsCreatedBy<T>(action: () => Promise<T>): Promise<T> {
    return this.frame._page._frameManager.waitForSignalsCreatedBy(null, false, action);
  }

  adoptIfNeeded(handle: js.JSHandle): Promise<js.JSHandle> | null {
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

  async evaluateAndWaitForSignals<Arg, R>(pageFunction: js.Func1<Arg, R>, arg?: Arg): Promise<R> {
    return await this.frame._page._frameManager.waitForSignalsCreatedBy(null, false /* noWaitFor */, async () => {
      return this.evaluate(pageFunction, arg);
    });
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

  createHandle(remoteObject: js.RemoteObject): js.JSHandle {
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
        ${injectedScriptSource.source}
        return new pwExport(
          ${this.frame._page._delegate.rafCountForStablePosition()},
          ${!!process.env.PWTEST_USE_TIMEOUT_FOR_RAF},
          [${custom.join(',\n')}]
        );
        })();
      `;
      this._injectedScriptPromise = this._delegate.rawEvaluateHandle(source).then(objectId => new js.JSHandle(this, 'object', objectId));
    }
    return this._injectedScriptPromise;
  }

  async doSlowMo() {
    return this.frame._page._doSlowMo();
  }
}

export class ElementHandle<T extends Node = Node> extends js.JSHandle<T> {
  readonly _context: FrameExecutionContext;
  readonly _page: Page;
  readonly _objectId: string;

  constructor(context: FrameExecutionContext, objectId: string) {
    super(context, 'node', objectId);
    this._objectId = objectId;
    this._context = context;
    this._page = context.frame._page;
    this._initializePreview().catch(e => {});
  }

  async _initializePreview() {
    const utility = await this._context.injectedScript();
    this._setPreview(await utility.evaluate((injected, e) => 'JSHandle@' + injected.previewNode(e), this));
  }

  asElement(): ElementHandle<T> | null {
    return this;
  }

  private async _evaluateInMainAndWaitForSignals<R, Arg>(pageFunction: js.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<R> {
    const main = await this._context.frame._mainContext();
    return main.evaluateAndWaitForSignals(pageFunction, [await main.injectedScript(), this, arg]);
  }

  async evaluateInUtility<R, Arg>(pageFunction: js.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<R> {
    const utility = await this._context.frame._utilityContext();
    return utility.evaluate(pageFunction, [await utility.injectedScript(), this, arg]);
  }

  async evaluateHandleInUtility<R, Arg>(pageFunction: js.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<js.JSHandle<R>> {
    const utility = await this._context.frame._utilityContext();
    return utility.evaluateHandle(pageFunction, [await utility.injectedScript(), this, arg]);
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

  async contentFrame(): Promise<frames.Frame | null> {
    const isFrameElement = await this.evaluateInUtility(([injected, node]) => node && (node.nodeName === 'IFRAME' || node.nodeName === 'FRAME'), {});
    if (!isFrameElement)
      return null;
    return this._page._delegate.getContentFrame(this);
  }

  async getAttribute(name: string): Promise<string | null> {
    return throwFatalDOMError(await this.evaluateInUtility(([injeced, node, name]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        return 'error:notelement';
      const element = node as unknown as Element;
      return { value: element.getAttribute(name) };
    }, name)).value;
  }

  async inputValue(): Promise<string> {
    return throwFatalDOMError(await this.evaluateInUtility(([injeced, node]) => {
      if (node.nodeType !== Node.ELEMENT_NODE || (node.nodeName !== 'INPUT' && node.nodeName !== 'TEXTAREA'))
        return 'error:notinputvalue';
      const element = node as unknown as (HTMLInputElement | HTMLTextAreaElement);
      return { value: element.value };
    }, undefined)).value;
  }

  async textContent(): Promise<string | null> {
    return this.evaluateInUtility(([injected, node]) => node.textContent, {});
  }

  async innerText(): Promise<string> {
    return throwFatalDOMError(await this.evaluateInUtility(([injected, node]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        return 'error:notelement';
      if (node.namespaceURI !== 'http://www.w3.org/1999/xhtml')
        return 'error:nothtmlelement';
      const element = node as unknown as HTMLElement;
      return { value: element.innerText };
    }, {})).value;
  }

  async innerHTML(): Promise<string> {
    return throwFatalDOMError(await this.evaluateInUtility(([injected, node]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        return 'error:notelement';
      const element = node as unknown as Element;
      return { value: element.innerHTML };
    }, {})).value;
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    await this._evaluateInMainAndWaitForSignals(([injected, node, { type, eventInit }]) =>
      injected.dispatchEvent(node, type, eventInit), { type, eventInit });
    await this._page._doSlowMo();
  }

  async _scrollRectIntoViewIfNeeded(rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return await this._page._delegate.scrollRectIntoViewIfNeeded(this, rect);
  }

  async _waitAndScrollIntoViewIfNeeded(progress: Progress): Promise<void> {
    while (progress.isRunning()) {
      assertDone(throwRetargetableDOMError(await this._waitForDisplayedAtStablePosition(progress, false /* force */, false /* waitForEnabled */)));

      progress.throwIfAborted();  // Avoid action that has side-effects.
      const result = throwRetargetableDOMError(await this._scrollRectIntoViewIfNeeded());
      if (result === 'error:notvisible')
        continue;
      assertDone(result);
      return;
    }
  }

  async scrollIntoViewIfNeeded(metadata: CallMetadata, options: types.TimeoutOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(
        progress => this._waitAndScrollIntoViewIfNeeded(progress),
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
      this._page.mainFrame()._utilityContext().then(utility => utility.evaluate(() => ({width: innerWidth, height: innerHeight}))),
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

  private async _offsetPoint(offset: types.Point): Promise<types.Point | 'error:notvisible'> {
    const [box, border] = await Promise.all([
      this.boundingBox(),
      this.evaluateInUtility(([injected, node]) => injected.getElementBorderWidth(node), {}).catch(e => {}),
    ]);
    if (!box || !border)
      return 'error:notvisible';
    // Make point relative to the padding box to align with offsetX/offsetY.
    return {
      x: box.x + border.left + offset.x,
      y: box.y + border.top + offset.y,
    };
  }

  async _retryPointerAction(progress: Progress, actionName: string, waitForEnabled: boolean, action: (point: types.Point) => Promise<void>,
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
          await this.evaluateInUtility(([injected, node, timeout]) => new Promise(f => setTimeout(f, timeout)), timeout);
        }
      } else {
        progress.log(`attempting ${actionName} action${options.trial ? ' (trial run)' : ''}`);
      }
      const forceScrollOptions = scrollOptions[retry % scrollOptions.length];
      const result = await this._performPointerAction(progress, actionName, waitForEnabled, action, forceScrollOptions, options);
      ++retry;
      if (result === 'error:notvisible') {
        if (options.force)
          throw new Error('Element is not visible');
        progress.log('  element is not visible');
        continue;
      }
      if (result === 'error:notinviewport') {
        if (options.force)
          throw new Error('Element is outside of the viewport');
        progress.log('  element is outside of the viewport');
        continue;
      }
      if (typeof result === 'object' && 'hitTargetDescription' in result) {
        if (options.force)
          throw new Error(`Element does not receive pointer events, ${result.hitTargetDescription} intercepts them`);
        progress.log(`  ${result.hitTargetDescription} intercepts pointer events`);
        continue;
      }
      return result;
    }
    return 'done';
  }

  async _performPointerAction(progress: Progress, actionName: string, waitForEnabled: boolean, action: (point: types.Point) => Promise<void>, forceScrollOptions: ScrollIntoViewOptions | undefined, options: types.PointerActionOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<'error:notvisible' | 'error:notconnected' | 'error:notinviewport' | { hitTargetDescription: string } | 'done'> {
    const { force = false, position } = options;
    if ((options as any).__testHookBeforeStable)
      await (options as any).__testHookBeforeStable();
    const result = await this._waitForDisplayedAtStablePosition(progress, force, waitForEnabled);
    if (result !== 'done')
      return result;
    if ((options as any).__testHookAfterStable)
      await (options as any).__testHookAfterStable();

    progress.log('  scrolling into view if needed');
    progress.throwIfAborted();  // Avoid action that has side-effects.
    if (forceScrollOptions) {
      await this.evaluateInUtility(([injected, node, options]) => {
        if (node.nodeType === 1 /* Node.ELEMENT_NODE */)
          (node as Node as Element).scrollIntoView(options);
      }, forceScrollOptions);
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

    if (!force) {
      if ((options as any).__testHookBeforeHitTarget)
        await (options as any).__testHookBeforeHitTarget();
      progress.log(`  checking that element receives pointer events at (${point.x},${point.y})`);
      const hitTargetResult = await this._checkHitTargetAt(point);
      if (hitTargetResult !== 'done')
        return hitTargetResult;
      progress.log(`  element does receive pointer events`);
    }

    progress.metadata.point = point;
    if (options.trial)  {
      progress.log(`  trial ${actionName} has finished`);
      return 'done';
    }

    await progress.beforeInputAction(this);
    await this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      if ((options as any).__testHookBeforePointerAction)
        await (options as any).__testHookBeforePointerAction();
      progress.throwIfAborted();  // Avoid action that has side-effects.
      let restoreModifiers: types.KeyboardModifier[] | undefined;
      if (options && options.modifiers)
        restoreModifiers = await this._page.keyboard._ensureModifiers(options.modifiers);
      progress.log(`  performing ${actionName} action`);
      await action(point);
      progress.log(`  ${actionName} action done`);
      progress.log('  waiting for scheduled navigations to finish');
      if ((options as any).__testHookAfterPointerAction)
        await (options as any).__testHookAfterPointerAction();
      if (restoreModifiers)
        await this._page.keyboard._ensureModifiers(restoreModifiers);
    }, 'input');
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
      const poll = await this.evaluateHandleInUtility(([injected, node, { optionsToSelect, force }]) => {
        return injected.waitForElementStatesAndPerformAction(node, ['visible', 'enabled'], force, injected.selectOptions.bind(injected, optionsToSelect));
      }, { optionsToSelect, force: options.force });
      const pollHandler = new InjectedScriptPollHandler(progress, poll);
      const result = throwFatalDOMError(await pollHandler.finish());
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
      const poll = await this.evaluateHandleInUtility(([injected, node, { value, force }]) => {
        return injected.waitForElementStatesAndPerformAction(node, ['visible', 'enabled', 'editable'], force, injected.fill.bind(injected, value));
      }, { value, force: options.force });
      const pollHandler = new InjectedScriptPollHandler(progress, poll);
      const filled = throwFatalDOMError(await pollHandler.finish());
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
      const poll = await this.evaluateHandleInUtility(([injected, node, force]) => {
        return injected.waitForElementStatesAndPerformAction(node, ['visible'], force, injected.selectText.bind(injected));
      }, options.force);
      const pollHandler = new InjectedScriptPollHandler(progress, poll);
      const result = throwFatalDOMError(await pollHandler.finish());
      assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async setInputFiles(metadata: CallMetadata, files: SetInputFilesFiles, options: types.NavigatingActionWaitOptions) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      const result = await this._setInputFiles(progress, files, options);
      return assertDone(throwRetargetableDOMError(result));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _setInputFiles(progress: Progress, files: SetInputFilesFiles, options: types.NavigatingActionWaitOptions): Promise<'error:notconnected' | 'done'> {
    for (const payload of files) {
      if (!payload.mimeType)
        payload.mimeType = mime.getType(payload.name) || 'application/octet-stream';
    }
    const retargeted = await this.evaluateHandleInUtility(([injected, node, multiple]): FatalDOMError | 'error:notconnected' | Element => {
      const element = injected.retarget(node, 'follow-label');
      if (!element)
        return 'error:notconnected';
      if (element.tagName !== 'INPUT')
        return 'error:notinput';
      if (multiple && !(element as HTMLInputElement).multiple)
        return 'error:notmultiplefileinput';
      return element;
    }, files.length > 1);
    if (!retargeted._objectId)
      return throwFatalDOMError(retargeted.rawValue() as FatalDOMError | 'error:notconnected');
    await progress.beforeInputAction(this);
    await this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      progress.throwIfAborted();  // Avoid action that has side-effects.
      await this._page._delegate.setInputFiles(retargeted as ElementHandle<HTMLInputElement>, files as types.FilePayload[]);
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
    const result = await this.evaluateInUtility(([injected, node, resetSelectionIfNotFocused]) => injected.focusNode(node, resetSelectionIfNotFocused), resetSelectionIfNotFocused);
    return throwFatalDOMError(result);
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
      const result = await this.evaluateInUtility(([injected, node]) => injected.checkElementState(node, 'checked'), {});
      return throwRetargetableDOMError(throwFatalDOMError(result));
    };
    if (await isChecked() === state)
      return 'done';
    const result = await this._click(progress, options);
    if (result !== 'done')
      return result;
    if (options.trial)
      return 'done';
    if (await isChecked() !== state)
      throw new Error('Clicking the checkbox did not change its state');
    return 'done';
  }

  async boundingBox(): Promise<types.Rect | null> {
    return this._page._delegate.getBoundingBox(this);
  }

  async screenshot(metadata: CallMetadata, options: types.ElementScreenshotOptions = {}): Promise<Buffer> {
    const controller = new ProgressController(metadata, this);
    return controller.run(
        progress => this._page._screenshotter.screenshotElement(progress, this, options),
        this._page._timeoutSettings.timeout(options));
  }

  async $(selector: string): Promise<ElementHandle | null> {
    return this._page.selectors._query(this._context.frame, selector, this);
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    return this._page.selectors._queryAll(this._context.frame, selector, this, true /* adoptToMain */);
  }

  async evalOnSelectorAndWaitForSignals(selector: string, expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    const handle = await this._page.selectors._query(this._context.frame, selector, this);
    if (!handle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await handle.evaluateExpressionAndWaitForSignals(expression, isFunction, true, arg);
    handle.dispose();
    return result;
  }

  async evalOnSelectorAllAndWaitForSignals(selector: string, expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    const arrayHandle = await this._page.selectors._queryArray(this._context.frame, selector, this);
    const result = await arrayHandle.evaluateExpressionAndWaitForSignals(expression, isFunction, true, arg);
    arrayHandle.dispose();
    return result;
  }

  async isVisible(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.checkElementState(node, 'visible'), {});
    return throwRetargetableDOMError(throwFatalDOMError(result));
  }

  async isHidden(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.checkElementState(node, 'hidden'), {});
    return throwRetargetableDOMError(throwFatalDOMError(result));
  }

  async isEnabled(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.checkElementState(node, 'enabled'), {});
    return throwRetargetableDOMError(throwFatalDOMError(result));
  }

  async isDisabled(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.checkElementState(node, 'disabled'), {});
    return throwRetargetableDOMError(throwFatalDOMError(result));
  }

  async isEditable(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.checkElementState(node, 'editable'), {});
    return throwRetargetableDOMError(throwFatalDOMError(result));
  }

  async isChecked(): Promise<boolean> {
    const result = await this.evaluateInUtility(([injected, node]) => injected.checkElementState(node, 'checked'), {});
    return throwRetargetableDOMError(throwFatalDOMError(result));
  }

  async waitForElementState(metadata: CallMetadata, state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled' | 'editable', options: types.TimeoutOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      progress.log(`  waiting for element to be ${state}`);
      const poll = await this.evaluateHandleInUtility(([injected, node, state]) => {
        return injected.waitForElementStatesAndPerformAction(node, [state], false, () => 'done' as const);
      }, state);
      const pollHandler = new InjectedScriptPollHandler(progress, poll);
      assertDone(throwRetargetableDOMError(throwFatalDOMError(await pollHandler.finish())));
    }, this._page._timeoutSettings.timeout(options));
  }

  async waitForSelector(metadata: CallMetadata, selector: string, options: types.WaitForElementOptions = {}): Promise<ElementHandle<Element> | null> {
    const { state = 'visible' } = options;
    if (!['attached', 'detached', 'visible', 'hidden'].includes(state))
      throw new Error(`state: expected one of (attached|detached|visible|hidden)`);
    const info = this._page.selectors._parseSelector(selector);
    const task = waitForSelectorTask(info, state, this);
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      progress.log(`waiting for selector "${selector}"${state === 'attached' ? '' : ' to be ' + state}`);
      const context = await this._context.frame._context(info.world);
      const injected = await context.injectedScript();
      const pollHandler = new InjectedScriptPollHandler(progress, await task(injected));
      const result = await pollHandler.finishHandle();
      if (!result.asElement()) {
        result.dispose();
        return null;
      }
      const handle = result.asElement() as ElementHandle<Element>;
      return handle._adoptTo(await this._context.frame._mainContext());
    }, this._page._timeoutSettings.timeout(options));
  }

  async _adoptTo(context: FrameExecutionContext): Promise<ElementHandle<T>> {
    if (this._context !== context) {
      const adopted = await this._page._delegate.adoptElementHandle(this, context);
      this.dispose();
      return adopted;
    }
    return this;
  }

  async _waitForDisplayedAtStablePosition(progress: Progress, force: boolean, waitForEnabled: boolean): Promise<'error:notconnected' | 'done'> {
    if (waitForEnabled)
      progress.log(`  waiting for element to be visible, enabled and stable`);
    else
      progress.log(`  waiting for element to be visible and stable`);
    const poll = this.evaluateHandleInUtility(([injected, node, { waitForEnabled, force }]) => {
      return injected.waitForElementStatesAndPerformAction(node,
          waitForEnabled ? ['visible', 'stable', 'enabled'] : ['visible', 'stable'], force, () => 'done' as const);
    }, { waitForEnabled, force });
    const pollHandler = new InjectedScriptPollHandler(progress, await poll);
    const result = await pollHandler.finish();
    if (waitForEnabled)
      progress.log('  element is visible, enabled and stable');
    else
      progress.log('  element is visible and stable');
    return throwFatalDOMError(result);
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
      const messages = await this._poll.evaluate(poll => poll.takeNextLogs()).catch(e => [] as string[]);
      if (!this._poll || !this._progress.isRunning())
        return;
      for (const message of messages)
        this._progress.log(message);
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
    const messages = await this._poll.evaluate(poll => poll.takeLastLogs()).catch(e => [] as string[]);
    for (const message of messages)
      this._progress.log(message);
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

export function throwFatalDOMError<T>(result: T | FatalDOMError): T {
  if (result === 'error:notelement')
    throw new Error('Node is not an element');
  if (result === 'error:nothtmlelement')
    throw new Error('Not an HTMLElement');
  if (result === 'error:notfillableelement')
    throw new Error('Element is not an <input>, <textarea> or [contenteditable] element');
  if (result === 'error:notfillableinputtype')
    throw new Error('Input of this type cannot be filled');
  if (result === 'error:notfillablenumberinput')
    throw new Error('Cannot type text into input[type=number]');
  if (result === 'error:notvaliddate')
    throw new Error(`Malformed value`);
  if (result === 'error:notinput')
    throw new Error('Node is not an HTMLInputElement');
  if (result === 'error:notinputvalue')
    throw new Error('Node is not an HTMLInputElement or HTMLTextAreaElement');
  if (result === 'error:notselect')
    throw new Error('Element is not a <select> element.');
  if (result === 'error:notcheckbox')
    throw new Error('Not a checkbox or radio button');
  if (result === 'error:notmultiplefileinput')
    throw new Error('Non-multiple file input can only accept single file');
  return result;
}

export function throwRetargetableDOMError<T>(result: T | RetargetableDOMError): T {
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

export function waitForSelectorTask(selector: SelectorInfo, state: 'attached' | 'detached' | 'visible' | 'hidden', root?: ElementHandle): SchedulableTask<Element | undefined> {
  return injectedScript => injectedScript.evaluateHandle((injected, { parsed, state, root }) => {
    let lastElement: Element | undefined;

    return injected.pollRaf((progress, continuePolling) => {
      const elements = injected.querySelectorAll(parsed, root || document);
      const element = elements[0];
      const visible = element ? injected.isVisible(element) : false;

      if (lastElement !== element) {
        lastElement = element;
        if (!element) {
          progress.log(`  selector did not resolve to any element`);
        } else {
          if (elements.length > 1)
            progress.log(`  selector resolved to ${elements.length} elements. Proceeding with the first one.`);
          progress.log(`  selector resolved to ${visible ? 'visible' : 'hidden'} ${injected.previewNode(element)}`);
        }
      }

      switch (state) {
        case 'attached':
          return element ? element : continuePolling;
        case 'detached':
          return !element ? undefined : continuePolling;
        case 'visible':
          return visible ? element : continuePolling;
        case 'hidden':
          return !visible ? undefined : continuePolling;
      }
    });
  }, { parsed: selector.parsed, state, root });
}

export function dispatchEventTask(selector: SelectorInfo, type: string, eventInit: Object): SchedulableTask<undefined> {
  return injectedScript => injectedScript.evaluateHandle((injected, { parsed, type, eventInit }) => {
    return injected.pollRaf<undefined>((progress, continuePolling) => {
      const element = injected.querySelector(parsed, document);
      if (!element)
        return continuePolling;
      progress.log(`  selector resolved to ${injected.previewNode(element)}`);
      injected.dispatchEvent(element, type, eventInit);
    });
  }, { parsed: selector.parsed, type, eventInit });
}

export function textContentTask(selector: SelectorInfo): SchedulableTask<string | null> {
  return injectedScript => injectedScript.evaluateHandle((injected, parsed) => {
    return injected.pollRaf((progress, continuePolling) => {
      const element = injected.querySelector(parsed, document);
      if (!element)
        return continuePolling;
      progress.log(`  selector resolved to ${injected.previewNode(element)}`);
      return element.textContent;
    });
  }, selector.parsed);
}

export function innerTextTask(selector: SelectorInfo): SchedulableTask<'error:nothtmlelement' | { innerText: string }> {
  return injectedScript => injectedScript.evaluateHandle((injected, parsed) => {
    return injected.pollRaf((progress, continuePolling) => {
      const element = injected.querySelector(parsed, document);
      if (!element)
        return continuePolling;
      progress.log(`  selector resolved to ${injected.previewNode(element)}`);
      if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml')
        return 'error:nothtmlelement';
      return { innerText: (element as HTMLElement).innerText };
    });
  }, selector.parsed);
}

export function innerHTMLTask(selector: SelectorInfo): SchedulableTask<string> {
  return injectedScript => injectedScript.evaluateHandle((injected, parsed) => {
    return injected.pollRaf((progress, continuePolling) => {
      const element = injected.querySelector(parsed, document);
      if (!element)
        return continuePolling;
      progress.log(`  selector resolved to ${injected.previewNode(element)}`);
      return element.innerHTML;
    });
  }, selector.parsed);
}

export function getAttributeTask(selector: SelectorInfo, name: string): SchedulableTask<string | null> {
  return injectedScript => injectedScript.evaluateHandle((injected, { parsed, name }) => {
    return injected.pollRaf((progress, continuePolling) => {
      const element = injected.querySelector(parsed, document);
      if (!element)
        return continuePolling;
      progress.log(`  selector resolved to ${injected.previewNode(element)}`);
      return element.getAttribute(name);
    });
  }, { parsed: selector.parsed, name });
}

export function inputValueTask(selector: SelectorInfo): SchedulableTask<string> {
  return injectedScript => injectedScript.evaluateHandle((injected, { parsed }) => {
    return injected.pollRaf((progress, continuePolling) => {
      const element = injected.querySelector(parsed, document);
      if (!element)
        return continuePolling;
      progress.log(`  selector resolved to ${injected.previewNode(element)}`);
      if (element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA')
        return 'error:notinputvalue';
      return (element as any).value;
    });
  }, { parsed: selector.parsed });
}

export function elementStateTask(selector: SelectorInfo, state: ElementStateWithoutStable): SchedulableTask<boolean | 'error:notconnected' | FatalDOMError> {
  return injectedScript => injectedScript.evaluateHandle((injected, { parsed, state }) => {
    return injected.pollRaf((progress, continuePolling) => {
      const element = injected.querySelector(parsed, document);
      if (!element)
        return continuePolling;
      progress.log(`  selector resolved to ${injected.previewNode(element)}`);
      return injected.checkElementState(element, state);
    });
  }, { parsed: selector.parsed, state });
}

export const kUnableToAdoptErrorMessage = 'Unable to adopt element handle from a different document';
