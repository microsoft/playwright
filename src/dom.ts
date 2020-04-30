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
import { Injected, InjectedResult } from './injected/injected';
import * as input from './input';
import * as js from './javascript';
import { Page } from './page';
import { selectors } from './selectors';
import * as types from './types';
import { NotConnectedError, TimeoutError } from './errors';
import { Log, logError } from './logger';

export type PointerActionOptions = {
  modifiers?: input.Modifier[];
  position?: types.Point;
};

export type ClickOptions = PointerActionOptions & input.MouseClickOptions;

export type MultiClickOptions = PointerActionOptions & input.MouseMultiClickOptions;

export const inputLog: Log = {
  name: 'input',
  color: 'cyan'
};

export class FrameExecutionContext extends js.ExecutionContext {
  readonly frame: frames.Frame;
  private _injectedPromise?: Promise<js.JSHandle>;

  constructor(delegate: js.ExecutionContextDelegate, frame: frames.Frame) {
    super(delegate, frame._page);
    this.frame = frame;
  }

  _adoptIfNeeded(handle: js.JSHandle): Promise<js.JSHandle> | null {
    if (handle instanceof ElementHandle && handle._context !== this)
      return this.frame._page._delegate.adoptElementHandle(handle, this);
    return null;
  }

  async _doEvaluateInternal(returnByValue: boolean, waitForNavigations: boolean, pageFunction: string | Function, ...args: any[]): Promise<any> {
    return await this.frame._page._frameManager.waitForSignalsCreatedBy(async () => {
      return this._delegate.evaluate(this, returnByValue, pageFunction, ...args);
    }, Number.MAX_SAFE_INTEGER, waitForNavigations ? undefined : { noWaitAfter: true });
  }

  _createHandle(remoteObject: any): js.JSHandle {
    if (this.frame._page._delegate.isElementHandle(remoteObject))
      return new ElementHandle(this, remoteObject);
    return super._createHandle(remoteObject);
  }

  _injected(): Promise<js.JSHandle<Injected>> {
    if (!this._injectedPromise) {
      this._injectedPromise = selectors._prepareEvaluator(this).then(evaluator => {
        return this.evaluateHandleInternal(evaluator => evaluator.injected, evaluator);
      });
    }
    return this._injectedPromise;
  }
}

export class ElementHandle<T extends Node = Node> extends js.JSHandle<T> {
  readonly _context: FrameExecutionContext;
  readonly _page: Page;

  constructor(context: FrameExecutionContext, remoteObject: any) {
    super(context, remoteObject);
    this._context = context;
    this._page = context.frame._page;
  }

  asElement(): ElementHandle<T> | null {
    return this;
  }

  async _evaluateInMain<R, Arg>(pageFunction: types.FuncOn<{ injected: Injected, node: T }, Arg, R>, arg: Arg): Promise<R> {
    const main = await this._context.frame._mainContext();
    return main._doEvaluateInternal(true /* returnByValue */, true /* waitForNavigations */, pageFunction, { injected: await main._injected(), node: this }, arg);
  }

  async _evaluateInUtility<R, Arg>(pageFunction: types.FuncOn<{ injected: Injected, node: T }, Arg, R>, arg: Arg): Promise<R> {
    const utility = await this._context.frame._utilityContext();
    return utility._doEvaluateInternal(true /* returnByValue */, true /* waitForNavigations */, pageFunction, { injected: await utility._injected(), node: this }, arg);
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
    const isFrameElement = await this._evaluateInUtility(({node}) => node && (node.nodeName === 'IFRAME' || node.nodeName === 'FRAME'), {});
    if (!isFrameElement)
      return null;
    return this._page._delegate.getContentFrame(this);
  }

  async getAttribute(name: string): Promise<string | null> {
    return this._evaluateInUtility(({node}, name: string) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw new Error('Not an element');
      const element = node as unknown as Element;
      return element.getAttribute(name);
    }, name);
  }

  async textContent(): Promise<string | null> {
    return this._evaluateInUtility(({node}) => node.textContent, {});
  }

  async innerText(): Promise<string | null> {
    return this._evaluateInUtility(({node}) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw new Error('Not an element');
      const element = node as unknown as HTMLElement;
      return element.innerText;
    }, {});
  }

  async innerHTML(): Promise<string | null> {
    return this._evaluateInUtility(({node}) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw new Error('Not an element');
      const element = node as unknown as Element;
      return element.innerHTML;
    }, {});
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    await this._evaluateInMain(({ injected, node }, { type, eventInit }) =>
      injected.dispatchEvent(node, type, eventInit), { type, eventInit });
  }

  async _scrollRectIntoViewIfNeeded(rect?: types.Rect): Promise<void> {
    await this._page._delegate.scrollRectIntoViewIfNeeded(this, rect);
  }

  async scrollIntoViewIfNeeded() {
    await this._scrollRectIntoViewIfNeeded();
  }

  private async _clickablePoint(): Promise<types.Point> {
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
      throw new Error('Node is either not visible or not an HTMLElement');

    const filtered = quads.map(quad => intersectQuadWithViewport(quad)).filter(quad => computeQuadArea(quad) > 1);
    if (!filtered.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Return the middle point of the first quad.
    const result = { x: 0, y: 0 };
    for (const point of filtered[0]) {
      result.x += point.x / 4;
      result.y += point.y / 4;
    }
    return result;
  }

  private async _offsetPoint(offset: types.Point): Promise<types.Point> {
    const [box, border] = await Promise.all([
      this.boundingBox(),
      this._evaluateInUtility(({ injected, node }) => injected.getElementBorderWidth(node), {}).catch(logError(this._context._logger)),
    ]);
    const point = { x: offset.x, y: offset.y };
    if (box) {
      point.x += box.x;
      point.y += box.y;
    }
    if (border) {
      // Make point relative to the padding box to align with offsetX/offsetY.
      point.x += border.left;
      point.y += border.top;
    }
    return point;
  }

  async _retryPointerAction(action: (point: types.Point) => Promise<void>, options: PointerActionOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    while (!helper.isPastDeadline(deadline)) {
      const result = await this._performPointerAction(action, deadline, options);
      if (result === 'done')
        return;
    }
    throw new TimeoutError(`waiting for element to receive pointer events failed: timeout exceeded`);
  }

  async _performPointerAction(action: (point: types.Point) => Promise<void>, deadline: number, options: PointerActionOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<'done' | 'retry'> {
    const { force = false, position } = options;
    if (!force)
      await this._waitForDisplayedAtStablePosition(deadline);

    let paused = false;
    try {
      await this._page._delegate.setActivityPaused(true);
      paused = true;

      // Scroll into view and calculate the point again while paused just in case something has moved.
      this._page._log(inputLog, 'scrolling into view if needed...');
      await this._scrollRectIntoViewIfNeeded(position ? { x: position.x, y: position.y, width: 0, height: 0 } : undefined);
      this._page._log(inputLog, '...done scrolling');
      const point = roundPoint(position ? await this._offsetPoint(position) : await this._clickablePoint());

      if (!force) {
        if ((options as any).__testHookBeforeHitTarget)
          await (options as any).__testHookBeforeHitTarget();
        this._page._log(inputLog, `checking that element receives pointer events at (${point.x},${point.y})...`);
        const matchesHitTarget = await this._checkHitTargetAt(point);
        if (!matchesHitTarget) {
          this._page._log(inputLog, '...element does not receive pointer events, retrying input action');
          await this._page._delegate.setActivityPaused(false);
          paused = false;
          return 'retry';
        }
        this._page._log(inputLog, `...element does receive pointer events, continuing input action`);
      }

      await this._page._frameManager.waitForSignalsCreatedBy(async () => {
        let restoreModifiers: input.Modifier[] | undefined;
        if (options && options.modifiers)
          restoreModifiers = await this._page.keyboard._ensureModifiers(options.modifiers);
        this._page._log(inputLog, 'performing input action...');
        await action(point);
        this._page._log(inputLog, '...input action done');
        this._page._log(inputLog, 'waiting for navigations to finish...');
        await this._page._delegate.setActivityPaused(false);
        paused = false;
        if (restoreModifiers)
          await this._page.keyboard._ensureModifiers(restoreModifiers);
      }, deadline, options, true);
      this._page._log(inputLog, '...navigations have finished');

      return 'done';
    } finally {
      if (paused)
        await this._page._delegate.setActivityPaused(false);
    }
  }

  hover(options?: PointerActionOptions & types.PointerActionWaitOptions): Promise<void> {
    return this._retryPointerAction(point => this._page.mouse.move(point.x, point.y), options);
  }

  click(options?: ClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    return this._retryPointerAction(point => this._page.mouse.click(point.x, point.y, options), options);
  }

  dblclick(options?: MultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    return this._retryPointerAction(point => this._page.mouse.dblclick(point.x, point.y, options), options);
  }

  async selectOption(values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[], options?: types.NavigatingActionWaitOptions): Promise<string[]> {
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    let vals: string[] | ElementHandle[] | types.SelectOption[];
    if (!Array.isArray(values))
      vals = [ values ] as (string[] | ElementHandle[] | types.SelectOption[]);
    else
      vals = values;
    const selectOptions = (vals as any).map((value: any) => typeof value === 'object' ? value : { value });
    for (const option of selectOptions) {
      if (option instanceof ElementHandle)
        continue;
      if (option.value !== undefined)
        assert(helper.isString(option.value), 'Values must be strings. Found value "' + option.value + '" of type "' + (typeof option.value) + '"');
      if (option.label !== undefined)
        assert(helper.isString(option.label), 'Labels must be strings. Found label "' + option.label + '" of type "' + (typeof option.label) + '"');
      if (option.index !== undefined)
        assert(helper.isNumber(option.index), 'Indices must be numbers. Found index "' + option.index + '" of type "' + (typeof option.index) + '"');
    }
    return await this._page._frameManager.waitForSignalsCreatedBy<string[]>(async () => {
      const injectedResult = await this._evaluateInUtility(({ injected, node }, selectOptions) => injected.selectOptions(node, selectOptions), selectOptions);
      return handleInjectedResult(injectedResult, '');
    }, deadline, options);
  }

  async fill(value: string, options?: types.NavigatingActionWaitOptions): Promise<void> {
    assert(helper.isString(value), 'Value must be string. Found value "' + value + '" of type "' + (typeof value) + '"');
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    await this._page._frameManager.waitForSignalsCreatedBy(async () => {
      const injectedResult = await this._evaluateInUtility(({ injected, node }, value) => injected.fill(node, value), value);
      const needsInput = handleInjectedResult(injectedResult, '');
      if (needsInput) {
        if (value)
          await this._page.keyboard.insertText(value);
        else
          await this._page.keyboard.press('Delete');
      }
    }, deadline, options, true);
  }

  async selectText(): Promise<void> {
    const injectedResult = await this._evaluateInUtility(({ injected, node }) => injected.selectText(node), {});
    handleInjectedResult(injectedResult, '');
  }

  async setInputFiles(files: string | types.FilePayload | string[] | types.FilePayload[], options?: types.NavigatingActionWaitOptions) {
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    const injectedResult = await this._evaluateInUtility(({ node }): InjectedResult<boolean> => {
      if (node.nodeType !== Node.ELEMENT_NODE || (node as Node as Element).tagName !== 'INPUT')
        return { status: 'error', error: 'Node is not an HTMLInputElement' };
      if (!node.isConnected)
        return { status: 'notconnected' };
      const input = node as Node as HTMLInputElement;
      return { status: 'success', value: input.multiple };
    }, {});
    const multiple = handleInjectedResult(injectedResult, '');
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
    await this._page._frameManager.waitForSignalsCreatedBy(async () => {
      await this._page._delegate.setInputFiles(this as any as ElementHandle<HTMLInputElement>, filePayloads);
    }, deadline, options);
  }

  async focus() {
    const injectedResult = await this._evaluateInUtility(({ injected, node }) => injected.focusNode(node), {});
    handleInjectedResult(injectedResult, '');
  }

  async type(text: string, options?: { delay?: number } & types.NavigatingActionWaitOptions) {
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    await this._page._frameManager.waitForSignalsCreatedBy(async () => {
      await this.focus();
      await this._page.keyboard.type(text, options);
    }, deadline, options, true);
  }

  async press(key: string, options?: { delay?: number } & types.NavigatingActionWaitOptions) {
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    await this._page._frameManager.waitForSignalsCreatedBy(async () => {
      await this.focus();
      await this._page.keyboard.press(key, options);
    }, deadline, options, true);
  }

  async check(options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    await this._setChecked(true, options);
  }

  async uncheck(options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    await this._setChecked(false, options);
  }

  private async _setChecked(state: boolean, options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    if (await this._evaluateInUtility(({ injected, node }) => injected.isCheckboxChecked(node), {}) === state)
      return;
    await this.click(options);
    if (await this._evaluateInUtility(({ injected, node }) => injected.isCheckboxChecked(node), {}) !== state)
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

  async _waitForDisplayedAtStablePosition(deadline: number): Promise<void> {
    this._page._log(inputLog, 'waiting for element to be displayed and not moving...');
    const stablePromise = this._evaluateInUtility(({ injected, node }, timeout) => {
      return injected.waitForDisplayedAtStablePosition(node, timeout);
    }, helper.timeUntilDeadline(deadline));
    const timeoutMessage = 'element to be displayed and not moving';
    const injectedResult = await helper.waitWithDeadline(stablePromise, timeoutMessage, deadline);
    handleInjectedResult(injectedResult, timeoutMessage);
    this._page._log(inputLog, '...element is displayed and does not move');
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
    const injectedResult = await this._evaluateInUtility(({ injected, node }, { point }) => {
      return injected.checkHitTargetAt(node, point);
    }, { point });
    return handleInjectedResult(injectedResult, '');
  }
}

export function toFileTransferPayload(files: types.FilePayload[]): types.FileTransferPayload[] {
  return files.map(file => ({
    name: file.name,
    type: file.mimeType,
    data: file.buffer.toString('base64')
  }));
}

function handleInjectedResult<T = undefined>(injectedResult: InjectedResult<T>, timeoutMessage: string): T {
  if (injectedResult.status === 'notconnected')
    throw new NotConnectedError();
  if (injectedResult.status === 'timeout')
    throw new TimeoutError(`waiting for ${timeoutMessage} failed: timeout exceeded`);
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
