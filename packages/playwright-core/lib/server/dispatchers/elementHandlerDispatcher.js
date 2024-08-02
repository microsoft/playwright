"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ElementHandleDispatcher = void 0;
var _dispatcher = require("./dispatcher");
var _jsHandleDispatcher = require("./jsHandleDispatcher");
var _frameDispatcher = require("./frameDispatcher");
var _browserContextDispatcher = require("./browserContextDispatcher");
var _pageDispatcher = require("./pageDispatcher");
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

class ElementHandleDispatcher extends _jsHandleDispatcher.JSHandleDispatcher {
  static from(scope, handle) {
    return (0, _dispatcher.existingDispatcher)(handle) || new ElementHandleDispatcher(scope, handle);
  }
  static fromNullable(scope, handle) {
    if (!handle) return undefined;
    return (0, _dispatcher.existingDispatcher)(handle) || new ElementHandleDispatcher(scope, handle);
  }
  static fromJSHandle(scope, handle) {
    const result = (0, _dispatcher.existingDispatcher)(handle);
    if (result) return result;
    return handle.asElement() ? new ElementHandleDispatcher(scope, handle.asElement()) : new _jsHandleDispatcher.JSHandleDispatcher(scope, handle);
  }
  constructor(scope, elementHandle) {
    super(scope, elementHandle);
    this._type_ElementHandle = true;
    this._elementHandle = void 0;
    this._elementHandle = elementHandle;
  }
  async ownerFrame(params, metadata) {
    const frame = await this._elementHandle.ownerFrame();
    return {
      frame: frame ? _frameDispatcher.FrameDispatcher.from(this._browserContextDispatcher(), frame) : undefined
    };
  }
  async contentFrame(params, metadata) {
    const frame = await this._elementHandle.contentFrame();
    return {
      frame: frame ? _frameDispatcher.FrameDispatcher.from(this._browserContextDispatcher(), frame) : undefined
    };
  }
  async getAttribute(params, metadata) {
    const value = await this._elementHandle.getAttribute(metadata, params.name);
    return {
      value: value === null ? undefined : value
    };
  }
  async inputValue(params, metadata) {
    const value = await this._elementHandle.inputValue(metadata);
    return {
      value
    };
  }
  async textContent(params, metadata) {
    const value = await this._elementHandle.textContent(metadata);
    return {
      value: value === null ? undefined : value
    };
  }
  async innerText(params, metadata) {
    return {
      value: await this._elementHandle.innerText(metadata)
    };
  }
  async innerHTML(params, metadata) {
    return {
      value: await this._elementHandle.innerHTML(metadata)
    };
  }
  async isChecked(params, metadata) {
    return {
      value: await this._elementHandle.isChecked(metadata)
    };
  }
  async isDisabled(params, metadata) {
    return {
      value: await this._elementHandle.isDisabled(metadata)
    };
  }
  async isEditable(params, metadata) {
    return {
      value: await this._elementHandle.isEditable(metadata)
    };
  }
  async isEnabled(params, metadata) {
    return {
      value: await this._elementHandle.isEnabled(metadata)
    };
  }
  async isHidden(params, metadata) {
    return {
      value: await this._elementHandle.isHidden(metadata)
    };
  }
  async isVisible(params, metadata) {
    return {
      value: await this._elementHandle.isVisible(metadata)
    };
  }
  async dispatchEvent(params, metadata) {
    await this._elementHandle.dispatchEvent(metadata, params.type, (0, _jsHandleDispatcher.parseArgument)(params.eventInit));
  }
  async scrollIntoViewIfNeeded(params, metadata) {
    await this._elementHandle.scrollIntoViewIfNeeded(metadata, params);
  }
  async hover(params, metadata) {
    return await this._elementHandle.hover(metadata, params);
  }
  async click(params, metadata) {
    return await this._elementHandle.click(metadata, params);
  }
  async dblclick(params, metadata) {
    return await this._elementHandle.dblclick(metadata, params);
  }
  async tap(params, metadata) {
    return await this._elementHandle.tap(metadata, params);
  }
  async selectOption(params, metadata) {
    const elements = (params.elements || []).map(e => e._elementHandle);
    return {
      values: await this._elementHandle.selectOption(metadata, elements, params.options || [], params)
    };
  }
  async fill(params, metadata) {
    return await this._elementHandle.fill(metadata, params.value, params);
  }
  async selectText(params, metadata) {
    await this._elementHandle.selectText(metadata, params);
  }
  async setInputFiles(params, metadata) {
    return await this._elementHandle.setInputFiles(metadata, params);
  }
  async focus(params, metadata) {
    await this._elementHandle.focus(metadata);
  }
  async type(params, metadata) {
    return await this._elementHandle.type(metadata, params.text, params);
  }
  async press(params, metadata) {
    return await this._elementHandle.press(metadata, params.key, params);
  }
  async check(params, metadata) {
    return await this._elementHandle.check(metadata, params);
  }
  async uncheck(params, metadata) {
    return await this._elementHandle.uncheck(metadata, params);
  }
  async boundingBox(params, metadata) {
    const value = await this._elementHandle.boundingBox();
    return {
      value: value || undefined
    };
  }
  async screenshot(params, metadata) {
    const mask = (params.mask || []).map(({
      frame,
      selector
    }) => ({
      frame: frame._object,
      selector
    }));
    return {
      binary: await this._elementHandle.screenshot(metadata, {
        ...params,
        mask
      })
    };
  }
  async querySelector(params, metadata) {
    const handle = await this._elementHandle.querySelector(params.selector, params);
    return {
      element: ElementHandleDispatcher.fromNullable(this.parentScope(), handle)
    };
  }
  async querySelectorAll(params, metadata) {
    const elements = await this._elementHandle.querySelectorAll(params.selector);
    return {
      elements: elements.map(e => ElementHandleDispatcher.from(this.parentScope(), e))
    };
  }
  async evalOnSelector(params, metadata) {
    return {
      value: (0, _jsHandleDispatcher.serializeResult)(await this._elementHandle.evalOnSelector(params.selector, !!params.strict, params.expression, params.isFunction, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
  async evalOnSelectorAll(params, metadata) {
    return {
      value: (0, _jsHandleDispatcher.serializeResult)(await this._elementHandle.evalOnSelectorAll(params.selector, params.expression, params.isFunction, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
  async waitForElementState(params, metadata) {
    await this._elementHandle.waitForElementState(metadata, params.state, params);
  }
  async waitForSelector(params, metadata) {
    return {
      element: ElementHandleDispatcher.fromNullable(this.parentScope(), await this._elementHandle.waitForSelector(metadata, params.selector, params))
    };
  }
  _browserContextDispatcher() {
    const scope = this.parentScope();
    if (scope instanceof _browserContextDispatcher.BrowserContextDispatcher) return scope;
    if (scope instanceof _pageDispatcher.PageDispatcher) return scope.parentScope();
    if (scope instanceof _pageDispatcher.WorkerDispatcher || scope instanceof _frameDispatcher.FrameDispatcher) {
      const parentScope = scope.parentScope();
      if (parentScope instanceof _browserContextDispatcher.BrowserContextDispatcher) return parentScope;
      return parentScope.parentScope();
    }
    throw new Error('ElementHandle belongs to unexpected scope');
  }
}
exports.ElementHandleDispatcher = ElementHandleDispatcher;