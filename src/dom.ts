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

import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';
import * as util from 'util';
import * as frames from './frames';
import { assert, helper } from './helper';
import InjectedScript from './injected/injectedScript';
import * as injectedScriptSource from './generated/injectedScriptSource';
import * as debugScriptSource from './generated/debugScriptSource';
import * as input from './input';
import * as js from './javascript';
import { Page } from './page';
import { selectors } from './selectors';
import * as types from './types';
import { NotConnectedError } from './errors';
import { apiLog } from './logger';
import { Progress, runAbortableTask } from './progress';
import DebugScript from './debug/injected/debugScript';

export type PointerActionOptions = {
  modifiers?: input.Modifier[];
  position?: types.Point;
};

export type ClickOptions = PointerActionOptions & input.MouseClickOptions;

export type MultiClickOptions = PointerActionOptions & input.MouseMultiClickOptions;

export class FrameExecutionContext extends js.ExecutionContext {
  readonly frame: frames.Frame;
  private _injectedScriptPromise?: Promise<js.JSHandle>;
  private _debugScriptPromise?: Promise<js.JSHandle | undefined>;

  constructor(delegate: js.ExecutionContextDelegate, frame: frames.Frame) {
    super(delegate);
    this.frame = frame;
  }

  adoptIfNeeded(handle: js.JSHandle): Promise<js.JSHandle> | null {
    if (handle instanceof ElementHandle && handle._context !== this)
      return this.frame._page._delegate.adoptElementHandle(handle, this);
    return null;
  }

  async evaluateInternal<R>(pageFunction: types.Func0<R>): Promise<R>;
  async evaluateInternal<Arg, R>(pageFunction: types.Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluateInternal(pageFunction: never, ...args: never[]): Promise<any> {
    return await this.frame._page._frameManager.waitForSignalsCreatedBy(null, false /* noWaitFor */, async () => {
      return js.evaluate(this, true /* returnByValue */, pageFunction, ...args);
    });
  }

  async evaluateHandleInternal<R>(pageFunction: types.Func0<R>): Promise<types.SmartHandle<R>>;
  async evaluateHandleInternal<Arg, R>(pageFunction: types.Func1<Arg, R>, arg: Arg): Promise<types.SmartHandle<R>>;
  async evaluateHandleInternal(pageFunction: never, ...args: never[]): Promise<any> {
    return await this.frame._page._frameManager.waitForSignalsCreatedBy(null, false /* noWaitFor */, async () => {
      return js.evaluate(this, false /* returnByValue */, pageFunction, ...args);
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
      for (const [name, { source }] of selectors._engines)
        custom.push(`{ name: '${name}', engine: (${source}) }`);
      const source = `
        new (${injectedScriptSource.source})([
          ${custom.join(',\n')}
        ])
      `;
      this._injectedScriptPromise = this._delegate.rawEvaluate(source).then(objectId => new js.JSHandle(this, 'object', objectId));
    }
    return this._injectedScriptPromise;
  }

  debugScript(): Promise<js.JSHandle<DebugScript> | undefined> {
    if (!helper.isDebugMode())
      return Promise.resolve(undefined);

    if (!this._debugScriptPromise) {
      const source = `new (${debugScriptSource.source})()`;
      this._debugScriptPromise = this._delegate.rawEvaluate(source).then(objectId => new js.JSHandle(this, 'object', objectId)).then(async debugScript => {
        const injectedScript = await this.injectedScript();
        await debugScript.evaluate((debugScript: DebugScript, injectedScript) => debugScript.initialize(injectedScript), injectedScript);
        return debugScript;
      }).catch(e => undefined);
    }
    return this._debugScriptPromise;
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
  }

  asElement(): ElementHandle<T> | null {
    return this;
  }

  async _evaluateInMain<R, Arg>(pageFunction: types.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<R> {
    const main = await this._context.frame._mainContext();
    return main.evaluateInternal(pageFunction, [await main.injectedScript(), this, arg]);
  }

  async _evaluateInUtility<R, Arg>(pageFunction: types.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<R> {
    const utility = await this._context.frame._utilityContext();
    return utility.evaluateInternal(pageFunction, [await utility.injectedScript(), this, arg]);
  }

  async _evaluateHandleInUtility<R, Arg>(pageFunction: types.Func1<[js.JSHandle<InjectedScript>, ElementHandle<T>, Arg], R>, arg: Arg): Promise<js.JSHandle<R>> {
    const utility = await this._context.frame._utilityContext();
    return utility.evaluateHandleInternal(pageFunction, [await utility.injectedScript(), this, arg]);
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
    const isFrameElement = await this._evaluateInUtility(([injected, node]) => node && (node.nodeName === 'IFRAME' || node.nodeName === 'FRAME'), {});
    if (!isFrameElement)
      return null;
    return this._page._delegate.getContentFrame(this);
  }

  async getAttribute(name: string): Promise<string | null> {
    return this._evaluateInUtility(([injeced, node, name]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw new Error('Not an element');
      const element = node as unknown as Element;
      return element.getAttribute(name);
    }, name);
  }

  async textContent(): Promise<string | null> {
    return this._evaluateInUtility(([injected, node]) => node.textContent, {});
  }

  async innerText(): Promise<string> {
    return this._evaluateInUtility(([injected, node]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw new Error('Not an element');
      if (node.namespaceURI !== 'http://www.w3.org/1999/xhtml')
        throw new Error('Not an HTMLElement');
      const element = node as unknown as HTMLElement;
      return element.innerText;
    }, {});
  }

  async innerHTML(): Promise<string> {
    return this._evaluateInUtility(([injected, node]) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw new Error('Not an element');
      const element = node as unknown as Element;
      return element.innerHTML;
    }, {});
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    await this._evaluateInMain(([injected, node, { type, eventInit }]) =>
      injected.dispatchEvent(node, type, eventInit), { type, eventInit });
  }

  async _scrollRectIntoViewIfNeeded(rect?: types.Rect): Promise<'success' | 'invisible'> {
    return await this._page._delegate.scrollRectIntoViewIfNeeded(this, rect);
  }

  async scrollIntoViewIfNeeded() {
    await this._scrollRectIntoViewIfNeeded();
  }

  private async _clickablePoint(): Promise<types.Point | 'invisible' | 'outsideviewport'> {
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
      this._page._delegate.layoutViewport(),
    ] as const);
    if (!quads || !quads.length)
      return 'invisible';

    const filtered = quads.map(quad => intersectQuadWithViewport(quad)).filter(quad => computeQuadArea(quad) > 1);
    if (!filtered.length)
      return 'outsideviewport';
    // Return the middle point of the first quad.
    const result = { x: 0, y: 0 };
    for (const point of filtered[0]) {
      result.x += point.x / 4;
      result.y += point.y / 4;
    }
    return result;
  }

  private async _offsetPoint(offset: types.Point): Promise<types.Point | 'invisible'> {
    const [box, border] = await Promise.all([
      this.boundingBox(),
      this._evaluateInUtility(([injected, node]) => injected.getElementBorderWidth(node), {}).catch(e => {}),
    ]);
    if (!box || !border)
      return 'invisible';
    // Make point relative to the padding box to align with offsetX/offsetY.
    return {
      x: box.x + border.left + offset.x,
      y: box.y + border.top + offset.y,
    };
  }

  async _retryPointerAction(progress: Progress, action: (point: types.Point) => Promise<void>, options: PointerActionOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    let first = true;
    while (progress.isRunning()) {
      progress.log(apiLog, `${first ? 'attempting' : 'retrying'} ${progress.apiName} action`);
      const result = await this._performPointerAction(progress, action, options);
      if (result === 'done')
        return;
      first = false;
    }
  }

  async _performPointerAction(progress: Progress, action: (point: types.Point) => Promise<void>, options: PointerActionOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<'done' | 'retry'> {
    const { force = false, position } = options;
    if (!force)
      await this._waitForDisplayedAtStablePositionAndEnabled(progress);

    progress.log(apiLog, '  scrolling into view if needed');
    progress.throwIfAborted();  // Avoid action that has side-effects.
    const scrolled = await this._scrollRectIntoViewIfNeeded(position ? { x: position.x, y: position.y, width: 0, height: 0 } : undefined);
    if (scrolled === 'invisible') {
      if (force)
        throw new Error('Element is not visible');
      progress.log(apiLog, '  element is not visible');
      return 'retry';
    }
    progress.log(apiLog, '  done scrolling');

    const maybePoint = position ? await this._offsetPoint(position) : await this._clickablePoint();
    if (maybePoint === 'invisible') {
      if (force)
        throw new Error('Element is not visible');
      progress.log(apiLog, '  element is not visibile');
      return 'retry';
    }
    if (maybePoint === 'outsideviewport') {
      if (force)
        throw new Error('Element is outside of the viewport');
      progress.log(apiLog, '  element is outside of the viewport');
      return 'retry';
    }
    const point = roundPoint(maybePoint);

    if (!force) {
      if ((options as any).__testHookBeforeHitTarget)
        await (options as any).__testHookBeforeHitTarget();
      progress.log(apiLog, `  checking that element receives pointer events at (${point.x},${point.y})`);
      const matchesHitTarget = await this._checkHitTargetAt(point);
      if (!matchesHitTarget) {
        progress.log(apiLog, '  element does not receive pointer events');
        return 'retry';
      }
      progress.log(apiLog, `  element does receive pointer events, continuing input action`);
    }

    await this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      if ((options as any).__testHookBeforePointerAction)
        await (options as any).__testHookBeforePointerAction();
      progress.throwIfAborted();  // Avoid action that has side-effects.
      let restoreModifiers: input.Modifier[] | undefined;
      if (options && options.modifiers)
        restoreModifiers = await this._page.keyboard._ensureModifiers(options.modifiers);
      progress.log(apiLog, `  performing ${progress.apiName} action`);
      await action(point);
      progress.log(apiLog, `  ${progress.apiName} action done`);
      progress.log(apiLog, '  waiting for scheduled navigations to finish');
      if ((options as any).__testHookAfterPointerAction)
        await (options as any).__testHookAfterPointerAction();
      if (restoreModifiers)
        await this._page.keyboard._ensureModifiers(restoreModifiers);
    }, 'input');
    progress.log(apiLog, '  navigations have finished');

    return 'done';
  }

  hover(options: PointerActionOptions & types.PointerActionWaitOptions = {}): Promise<void> {
    return runAbortableTask(progress => this._hover(progress, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  _hover(progress: Progress, options: PointerActionOptions & types.PointerActionWaitOptions): Promise<void> {
    return this._retryPointerAction(progress, point => this._page.mouse.move(point.x, point.y), options);
  }

  click(options: ClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    return runAbortableTask(progress => this._click(progress, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  _click(progress: Progress, options: ClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    return this._retryPointerAction(progress, point => this._page.mouse.click(point.x, point.y, options), options);
  }

  dblclick(options: MultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    return runAbortableTask(progress => this._dblclick(progress, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  _dblclick(progress: Progress, options: MultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    return this._retryPointerAction(progress, point => this._page.mouse.dblclick(point.x, point.y, options), options);
  }

  async selectOption(values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions = {}): Promise<string[]> {
    return runAbortableTask(progress => this._selectOption(progress, values, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  async _selectOption(progress: Progress, values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions): Promise<string[]> {
    let vals: string[] | ElementHandle[] | types.SelectOption[];
    if (values === null)
      vals = [];
    else if (!Array.isArray(values))
      vals = [ values ] as (string[] | ElementHandle[] | types.SelectOption[]);
    else
      vals = values;
    const selectOptions = (vals as any).map((value: any) => typeof value === 'object' ? value : { value });
    for (const option of selectOptions) {
      assert(option !== null, 'Value items must not be null');
      if (option instanceof ElementHandle)
        continue;
      if (option.value !== undefined)
        assert(helper.isString(option.value), 'Values must be strings. Found value "' + option.value + '" of type "' + (typeof option.value) + '"');
      if (option.label !== undefined)
        assert(helper.isString(option.label), 'Labels must be strings. Found label "' + option.label + '" of type "' + (typeof option.label) + '"');
      if (option.index !== undefined)
        assert(helper.isNumber(option.index), 'Indices must be numbers. Found index "' + option.index + '" of type "' + (typeof option.index) + '"');
    }
    return this._page._frameManager.waitForSignalsCreatedBy<string[]>(progress, options.noWaitAfter, async () => {
      progress.throwIfAborted();  // Avoid action that has side-effects.
      const injectedResult = await this._evaluateInUtility(([injected, node, selectOptions]) => injected.selectOptions(node, selectOptions), selectOptions);
      return handleInjectedResult(injectedResult);
    });
  }

  async fill(value: string, options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    return runAbortableTask(progress => this._fill(progress, value, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  async _fill(progress: Progress, value: string, options: types.NavigatingActionWaitOptions): Promise<void> {
    progress.log(apiLog, `elementHandle.fill("${value}")`);
    assert(helper.isString(value), 'Value must be string. Found value "' + value + '" of type "' + (typeof value) + '"');
    await this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      progress.log(apiLog, '  waiting for element to be visible, enabled and editable');
      const poll = await this._evaluateHandleInUtility(([injected, node, value]) => {
        return injected.waitForEnabledAndFill(node, value);
      }, value);
      const pollHandler = new InjectedScriptPollHandler(progress, poll);
      const injectedResult = await pollHandler.finish();
      const needsInput = handleInjectedResult(injectedResult);
      progress.log(apiLog, '  element is visible, enabled and editable');
      progress.throwIfAborted();  // Avoid action that has side-effects.
      if (needsInput) {
        if (value)
          await this._page.keyboard.insertText(value);
        else
          await this._page.keyboard.press('Delete');
      }
    }, 'input');
  }

  async selectText(): Promise<void> {
    return runAbortableTask(async progress => {
      progress.throwIfAborted();  // Avoid action that has side-effects.
      const injectedResult = await this._evaluateInUtility(([injected, node]) => injected.selectText(node), {});
      handleInjectedResult(injectedResult);
    }, this._page._logger, 0);
  }

  async setInputFiles(files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions = {}) {
    return runAbortableTask(async progress => this._setInputFiles(progress, files, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  async _setInputFiles(progress: Progress, files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions) {
    const injectedResult = await this._evaluateInUtility(([injected, node]): types.InjectedScriptResult<boolean> => {
      if (node.nodeType !== Node.ELEMENT_NODE || (node as Node as Element).tagName !== 'INPUT')
        return { status: 'error', error: 'Node is not an HTMLInputElement' };
      if (!node.isConnected)
        return { status: 'notconnected' };
      const input = node as Node as HTMLInputElement;
      return { status: 'success', value: input.multiple };
    }, {});
    const multiple = handleInjectedResult(injectedResult);
    let ff: string[] | types.FilePayload[];
    if (!Array.isArray(files))
      ff = [ files ] as string[] | types.FilePayload[];
    else
      ff = files;
    assert(multiple || ff.length <= 1, 'Non-multiple file input can only accept single file!');
    const filePayloads: types.FilePayload[] = [];
    for (const item of ff) {
      if (typeof item === 'string') {
        const file: types.FilePayload = {
          name: path.basename(item),
          mimeType: mime.getType(item) || 'application/octet-stream',
          buffer: await util.promisify(fs.readFile)(item)
        };
        filePayloads.push(file);
      } else {
        filePayloads.push(item);
      }
    }
    await this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      progress.throwIfAborted();  // Avoid action that has side-effects.
      await this._page._delegate.setInputFiles(this as any as ElementHandle<HTMLInputElement>, filePayloads);
    });
  }

  async focus() {
    return runAbortableTask(progress => this._focus(progress), this._page._logger, 0);
  }

  async _focus(progress: Progress) {
    progress.throwIfAborted();  // Avoid action that has side-effects.
    const injectedResult = await this._evaluateInUtility(([injected, node]) => injected.focusNode(node), {});
    handleInjectedResult(injectedResult);
  }

  async type(text: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    return runAbortableTask(progress => this._type(progress, text, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  async _type(progress: Progress, text: string, options: { delay?: number } & types.NavigatingActionWaitOptions) {
    progress.log(apiLog, `elementHandle.type("${text}")`);
    return this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      await this._focus(progress);
      progress.throwIfAborted();  // Avoid action that has side-effects.
      await this._page.keyboard.type(text, options);
    }, 'input');
  }

  async press(key: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    return runAbortableTask(progress => this._press(progress, key, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  async _press(progress: Progress, key: string, options: { delay?: number } & types.NavigatingActionWaitOptions) {
    progress.log(apiLog, `elementHandle.press("${key}")`);
    return this._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      await this._focus(progress);
      progress.throwIfAborted();  // Avoid action that has side-effects.
      await this._page.keyboard.press(key, options);
    }, 'input');
  }

  async check(options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return runAbortableTask(progress => this._setChecked(progress, true, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  async uncheck(options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return runAbortableTask(progress => this._setChecked(progress, false, options), this._page._logger, this._page._timeoutSettings.timeout(options));
  }

  async _setChecked(progress: Progress, state: boolean, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    if (await this._evaluateInUtility(([injected, node]) => injected.isCheckboxChecked(node), {}) === state)
      return;
    await this._click(progress, options);
    if (await this._evaluateInUtility(([injected, node]) => injected.isCheckboxChecked(node), {}) !== state)
      throw new Error('Unable to click checkbox');
  }

  async boundingBox(): Promise<types.Rect | null> {
    return this._page._delegate.getBoundingBox(this);
  }

  async screenshot(options?: types.ElementScreenshotOptions): Promise<Buffer> {
    return this._page._screenshotter.screenshotElement(this, options);
  }

  async $(selector: string): Promise<ElementHandle | null> {
    return selectors._query(this._context.frame, selector, this);
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    return selectors._queryAll(this._context.frame, selector, this);
  }

  async $eval<R, Arg>(selector: string, pageFunction: types.FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: types.FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: types.FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    const handle = await selectors._query(this._context.frame, selector, this);
    if (!handle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await handle.evaluate(pageFunction, arg);
    handle.dispose();
    return result;
  }

  async $$eval<R, Arg>(selector: string, pageFunction: types.FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: types.FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: types.FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    const arrayHandle = await selectors._queryArray(this._context.frame, selector, this);
    const result = await arrayHandle.evaluate(pageFunction, arg);
    arrayHandle.dispose();
    return result;
  }

  async _waitForDisplayedAtStablePositionAndEnabled(progress: Progress): Promise<void> {
    progress.log(apiLog, '  waiting for element to be visible, enabled and not moving');
    const rafCount =  this._page._delegate.rafCountForStablePosition();
    const poll = this._evaluateHandleInUtility(([injected, node, rafCount]) => {
      return injected.waitForDisplayedAtStablePositionAndEnabled(node, rafCount);
    }, rafCount);
    const pollHandler = new InjectedScriptPollHandler<types.InjectedScriptResult>(progress, await poll);
    const injectedResult = await pollHandler.finish();
    handleInjectedResult(injectedResult);
    progress.log(apiLog, '  element is visible, enabled and does not move');
  }

  async _checkHitTargetAt(point: types.Point): Promise<boolean> {
    const frame = await this.ownerFrame();
    if (frame && frame.parentFrame()) {
      const element = await frame.frameElement();
      const box = await element.boundingBox();
      if (!box)
        throw new NotConnectedError();
      // Translate from viewport coordinates to frame coordinates.
      point = { x: point.x - box.x, y: point.y - box.y };
    }
    const injectedResult = await this._evaluateInUtility(([injected, node, point]) => {
      return injected.checkHitTargetAt(node, point);
    }, point);
    return handleInjectedResult(injectedResult);
  }
}

// Handles an InjectedScriptPoll running in injected script:
// - streams logs into progress;
// - cancels the poll when progress cancels.
export class InjectedScriptPollHandler<T> {
  private _progress: Progress;
  private _poll: js.JSHandle<types.InjectedScriptPoll<T>> | null;

  constructor(progress: Progress, poll: js.JSHandle<types.InjectedScriptPoll<T>>) {
    this._progress = progress;
    this._poll = poll;
    // Ensure we cancel the poll before progress aborts and returns:
    //   - no unnecessary work in the page;
    //   - no possible side effects after progress promsie rejects.
    this._progress.cleanupWhenAborted(() => this.cancel());
    this._streamLogs(poll.evaluateHandle(poll => poll.logs));
  }

  private _streamLogs(logsPromise: Promise<js.JSHandle<types.InjectedScriptLogs>>) {
    // We continuously get a chunk of logs, stream them to the progress and wait for the next chunk.
    logsPromise.catch(e => null).then(logs => {
      if (!logs || !this._poll || !this._progress.isRunning())
        return;
      logs.evaluate(logs => logs.current).catch(e => [] as string[]).then(messages => {
        for (const message of messages)
          this._progress.log(apiLog, message);
      });
      this._streamLogs(logs.evaluateHandle(logs => logs.next));
    });
  }

  async finishHandle(): Promise<types.SmartHandle<T>> {
    try {
      const result = await this._poll!.evaluateHandle(poll => poll.result);
      await this._finishInternal();
      return result;
    } finally {
      await this.cancel();
    }
  }

  async finish(): Promise<T> {
    try {
      const result = await this._poll!.evaluate(poll => poll.result);
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
      this._progress.log(apiLog, message);
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

export function toFileTransferPayload(files: types.FilePayload[]): types.FileTransferPayload[] {
  return files.map(file => ({
    name: file.name,
    type: file.mimeType,
    data: file.buffer.toString('base64')
  }));
}

function handleInjectedResult<T = undefined>(injectedResult: types.InjectedScriptResult<T>): T {
  if (injectedResult.status === 'notconnected')
    throw new NotConnectedError();
  if (injectedResult.status === 'error')
    throw new Error(injectedResult.error);
  return injectedResult.value as T;
}

function roundPoint(point: types.Point): types.Point {
  return {
    x: (point.x * 100 | 0) / 100,
    y: (point.y * 100 | 0) / 100,
  };
}
