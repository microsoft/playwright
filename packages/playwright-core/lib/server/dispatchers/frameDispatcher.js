"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FrameDispatcher = void 0;
var _frames = require("../frames");
var _dispatcher = require("./dispatcher");
var _elementHandlerDispatcher = require("./elementHandlerDispatcher");
var _jsHandleDispatcher = require("./jsHandleDispatcher");
var _networkDispatchers = require("./networkDispatchers");
var _utils = require("../../utils");
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

class FrameDispatcher extends _dispatcher.Dispatcher {
  static from(scope, frame) {
    const result = (0, _dispatcher.existingDispatcher)(frame);
    return result || new FrameDispatcher(scope, frame);
  }
  static fromNullable(scope, frame) {
    if (!frame) return;
    return FrameDispatcher.from(scope, frame);
  }
  constructor(scope, frame) {
    // Main frames are gc'ed separately from any other frames, so that
    // methods on Page that redirect to the main frame remain operational.
    // Note: we cannot check parentFrame() here because it may be null after the frame has been detached.
    (0, _utils.debugAssert)(frame._page.mainFrame(), 'Cannot determine whether the frame is a main frame');
    const gcBucket = frame._page.mainFrame() === frame ? 'MainFrame' : 'Frame';
    const pageDispatcher = (0, _dispatcher.existingDispatcher)(frame._page);
    super(pageDispatcher || scope, frame, 'Frame', {
      url: frame.url(),
      name: frame.name(),
      parentFrame: FrameDispatcher.fromNullable(scope, frame.parentFrame()),
      loadStates: Array.from(frame._firedLifecycleEvents)
    }, gcBucket);
    this._type_Frame = true;
    this._frame = void 0;
    this._browserContextDispatcher = void 0;
    this._browserContextDispatcher = scope;
    this._frame = frame;
    this.addObjectListener(_frames.Frame.Events.AddLifecycle, lifecycleEvent => {
      this._dispatchEvent('loadstate', {
        add: lifecycleEvent
      });
    });
    this.addObjectListener(_frames.Frame.Events.RemoveLifecycle, lifecycleEvent => {
      this._dispatchEvent('loadstate', {
        remove: lifecycleEvent
      });
    });
    this.addObjectListener(_frames.Frame.Events.InternalNavigation, event => {
      if (!event.isPublic) return;
      const params = {
        url: event.url,
        name: event.name,
        error: event.error ? event.error.message : undefined
      };
      if (event.newDocument) params.newDocument = {
        request: _networkDispatchers.RequestDispatcher.fromNullable(this._browserContextDispatcher, event.newDocument.request || null)
      };
      this._dispatchEvent('navigated', params);
    });
  }
  async goto(params, metadata) {
    return {
      response: _networkDispatchers.ResponseDispatcher.fromNullable(this._browserContextDispatcher, await this._frame.goto(metadata, params.url, params))
    };
  }
  async frameElement() {
    return {
      element: _elementHandlerDispatcher.ElementHandleDispatcher.from(this, await this._frame.frameElement())
    };
  }
  async evaluateExpression(params, metadata) {
    return {
      value: (0, _jsHandleDispatcher.serializeResult)(await this._frame.evaluateExpression(params.expression, {
        isFunction: params.isFunction
      }, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
  async evaluateExpressionHandle(params, metadata) {
    return {
      handle: _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this, await this._frame.evaluateExpressionHandle(params.expression, {
        isFunction: params.isFunction
      }, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
  async waitForSelector(params, metadata) {
    return {
      element: _elementHandlerDispatcher.ElementHandleDispatcher.fromNullable(this, await this._frame.waitForSelector(metadata, params.selector, params))
    };
  }
  async dispatchEvent(params, metadata) {
    return this._frame.dispatchEvent(metadata, params.selector, params.type, (0, _jsHandleDispatcher.parseArgument)(params.eventInit), params);
  }
  async evalOnSelector(params, metadata) {
    return {
      value: (0, _jsHandleDispatcher.serializeResult)(await this._frame.evalOnSelector(params.selector, !!params.strict, params.expression, params.isFunction, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
  async evalOnSelectorAll(params, metadata) {
    return {
      value: (0, _jsHandleDispatcher.serializeResult)(await this._frame.evalOnSelectorAll(params.selector, params.expression, params.isFunction, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
  async querySelector(params, metadata) {
    return {
      element: _elementHandlerDispatcher.ElementHandleDispatcher.fromNullable(this, await this._frame.querySelector(params.selector, params))
    };
  }
  async querySelectorAll(params, metadata) {
    const elements = await this._frame.querySelectorAll(params.selector);
    return {
      elements: elements.map(e => _elementHandlerDispatcher.ElementHandleDispatcher.from(this, e))
    };
  }
  async queryCount(params) {
    return {
      value: await this._frame.queryCount(params.selector)
    };
  }
  async content() {
    return {
      value: await this._frame.content()
    };
  }
  async setContent(params, metadata) {
    return await this._frame.setContent(metadata, params.html, params);
  }
  async addScriptTag(params, metadata) {
    return {
      element: _elementHandlerDispatcher.ElementHandleDispatcher.from(this, await this._frame.addScriptTag(params))
    };
  }
  async addStyleTag(params, metadata) {
    return {
      element: _elementHandlerDispatcher.ElementHandleDispatcher.from(this, await this._frame.addStyleTag(params))
    };
  }
  async click(params, metadata) {
    metadata.potentiallyClosesScope = true;
    return await this._frame.click(metadata, params.selector, params);
  }
  async dblclick(params, metadata) {
    return await this._frame.dblclick(metadata, params.selector, params);
  }
  async dragAndDrop(params, metadata) {
    return await this._frame.dragAndDrop(metadata, params.source, params.target, params);
  }
  async tap(params, metadata) {
    return await this._frame.tap(metadata, params.selector, params);
  }
  async fill(params, metadata) {
    return await this._frame.fill(metadata, params.selector, params.value, params);
  }
  async focus(params, metadata) {
    await this._frame.focus(metadata, params.selector, params);
  }
  async blur(params, metadata) {
    await this._frame.blur(metadata, params.selector, params);
  }
  async textContent(params, metadata) {
    const value = await this._frame.textContent(metadata, params.selector, params);
    return {
      value: value === null ? undefined : value
    };
  }
  async innerText(params, metadata) {
    return {
      value: await this._frame.innerText(metadata, params.selector, params)
    };
  }
  async innerHTML(params, metadata) {
    return {
      value: await this._frame.innerHTML(metadata, params.selector, params)
    };
  }
  async getAttribute(params, metadata) {
    const value = await this._frame.getAttribute(metadata, params.selector, params.name, params);
    return {
      value: value === null ? undefined : value
    };
  }
  async inputValue(params, metadata) {
    const value = await this._frame.inputValue(metadata, params.selector, params);
    return {
      value
    };
  }
  async isChecked(params, metadata) {
    return {
      value: await this._frame.isChecked(metadata, params.selector, params)
    };
  }
  async isDisabled(params, metadata) {
    return {
      value: await this._frame.isDisabled(metadata, params.selector, params)
    };
  }
  async isEditable(params, metadata) {
    return {
      value: await this._frame.isEditable(metadata, params.selector, params)
    };
  }
  async isEnabled(params, metadata) {
    return {
      value: await this._frame.isEnabled(metadata, params.selector, params)
    };
  }
  async isHidden(params, metadata) {
    return {
      value: await this._frame.isHidden(metadata, params.selector, params)
    };
  }
  async isVisible(params, metadata) {
    return {
      value: await this._frame.isVisible(metadata, params.selector, params)
    };
  }
  async hover(params, metadata) {
    return await this._frame.hover(metadata, params.selector, params);
  }
  async selectOption(params, metadata) {
    const elements = (params.elements || []).map(e => e._elementHandle);
    return {
      values: await this._frame.selectOption(metadata, params.selector, elements, params.options || [], params)
    };
  }
  async setInputFiles(params, metadata) {
    return await this._frame.setInputFiles(metadata, params.selector, params);
  }
  async type(params, metadata) {
    return await this._frame.type(metadata, params.selector, params.text, params);
  }
  async press(params, metadata) {
    return await this._frame.press(metadata, params.selector, params.key, params);
  }
  async check(params, metadata) {
    return await this._frame.check(metadata, params.selector, params);
  }
  async uncheck(params, metadata) {
    return await this._frame.uncheck(metadata, params.selector, params);
  }
  async waitForTimeout(params, metadata) {
    return await this._frame.waitForTimeout(metadata, params.timeout);
  }
  async waitForFunction(params, metadata) {
    return {
      handle: _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this, await this._frame._waitForFunctionExpression(metadata, params.expression, params.isFunction, (0, _jsHandleDispatcher.parseArgument)(params.arg), params))
    };
  }
  async title(params, metadata) {
    return {
      value: await this._frame.title()
    };
  }
  async highlight(params, metadata) {
    return await this._frame.highlight(params.selector);
  }
  async expect(params, metadata) {
    metadata.potentiallyClosesScope = true;
    const expectedValue = params.expectedValue ? (0, _jsHandleDispatcher.parseArgument)(params.expectedValue) : undefined;
    const result = await this._frame.expect(metadata, params.selector, {
      ...params,
      expectedValue
    });
    if (result.received !== undefined) result.received = (0, _jsHandleDispatcher.serializeResult)(result.received);
    return result;
  }
}
exports.FrameDispatcher = FrameDispatcher;