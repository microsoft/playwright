"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Locator = exports.FrameLocator = void 0;
exports.setTestIdAttribute = setTestIdAttribute;
exports.testIdAttributeName = testIdAttributeName;
var util = _interopRequireWildcard(require("util"));
var _utils = require("../utils");
var _elementHandle = require("./elementHandle");
var _jsHandle = require("./jsHandle");
var _stringUtils = require("../utils/isomorphic/stringUtils");
var _locatorUtils = require("../utils/isomorphic/locatorUtils");
let _util$inspect$custom;
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
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
_util$inspect$custom = util.inspect.custom;
class Locator {
  constructor(frame, selector, options) {
    this._frame = void 0;
    this._selector = void 0;
    this._frame = frame;
    this._selector = selector;
    if (options !== null && options !== void 0 && options.hasText) this._selector += ` >> internal:has-text=${(0, _stringUtils.escapeForTextSelector)(options.hasText, false)}`;
    if (options !== null && options !== void 0 && options.hasNotText) this._selector += ` >> internal:has-not-text=${(0, _stringUtils.escapeForTextSelector)(options.hasNotText, false)}`;
    if (options !== null && options !== void 0 && options.has) {
      const locator = options.has;
      if (locator._frame !== frame) throw new Error(`Inner "has" locator must belong to the same frame.`);
      this._selector += ` >> internal:has=` + JSON.stringify(locator._selector);
    }
    if (options !== null && options !== void 0 && options.hasNot) {
      const locator = options.hasNot;
      if (locator._frame !== frame) throw new Error(`Inner "hasNot" locator must belong to the same frame.`);
      this._selector += ` >> internal:has-not=` + JSON.stringify(locator._selector);
    }
  }
  async _withElement(task, timeout) {
    timeout = this._frame.page()._timeoutSettings.timeout({
      timeout
    });
    const deadline = timeout ? (0, _utils.monotonicTime)() + timeout : 0;
    return await this._frame._wrapApiCall(async () => {
      const result = await this._frame._channel.waitForSelector({
        selector: this._selector,
        strict: true,
        state: 'attached',
        timeout
      });
      const handle = _elementHandle.ElementHandle.fromNullable(result.element);
      if (!handle) throw new Error(`Could not resolve ${this._selector} to DOM Element`);
      try {
        return await task(handle, deadline ? deadline - (0, _utils.monotonicTime)() : 0);
      } finally {
        await handle.dispose();
      }
    });
  }
  _equals(locator) {
    return this._frame === locator._frame && this._selector === locator._selector;
  }
  page() {
    return this._frame.page();
  }
  async boundingBox(options) {
    return await this._withElement(h => h.boundingBox(), options === null || options === void 0 ? void 0 : options.timeout);
  }
  async check(options = {}) {
    return await this._frame.check(this._selector, {
      strict: true,
      ...options
    });
  }
  async click(options = {}) {
    return await this._frame.click(this._selector, {
      strict: true,
      ...options
    });
  }
  async dblclick(options = {}) {
    return await this._frame.dblclick(this._selector, {
      strict: true,
      ...options
    });
  }
  async dispatchEvent(type, eventInit = {}, options) {
    return await this._frame.dispatchEvent(this._selector, type, eventInit, {
      strict: true,
      ...options
    });
  }
  async dragTo(target, options = {}) {
    return await this._frame.dragAndDrop(this._selector, target._selector, {
      strict: true,
      ...options
    });
  }
  async evaluate(pageFunction, arg, options) {
    return await this._withElement(h => h.evaluate(pageFunction, arg), options === null || options === void 0 ? void 0 : options.timeout);
  }
  async evaluateAll(pageFunction, arg) {
    return await this._frame.$$eval(this._selector, pageFunction, arg);
  }
  async evaluateHandle(pageFunction, arg, options) {
    return await this._withElement(h => h.evaluateHandle(pageFunction, arg), options === null || options === void 0 ? void 0 : options.timeout);
  }
  async fill(value, options = {}) {
    return await this._frame.fill(this._selector, value, {
      strict: true,
      ...options
    });
  }
  async clear(options = {}) {
    return await this.fill('', options);
  }
  async _highlight() {
    // VS Code extension uses this one, keep it for now.
    return await this._frame._highlight(this._selector);
  }
  async highlight() {
    return await this._frame._highlight(this._selector);
  }
  locator(selectorOrLocator, options) {
    if ((0, _utils.isString)(selectorOrLocator)) return new Locator(this._frame, this._selector + ' >> ' + selectorOrLocator, options);
    if (selectorOrLocator._frame !== this._frame) throw new Error(`Locators must belong to the same frame.`);
    return new Locator(this._frame, this._selector + ' >> internal:chain=' + JSON.stringify(selectorOrLocator._selector), options);
  }
  getByTestId(testId) {
    return this.locator((0, _locatorUtils.getByTestIdSelector)(testIdAttributeName(), testId));
  }
  getByAltText(text, options) {
    return this.locator((0, _locatorUtils.getByAltTextSelector)(text, options));
  }
  getByLabel(text, options) {
    return this.locator((0, _locatorUtils.getByLabelSelector)(text, options));
  }
  getByPlaceholder(text, options) {
    return this.locator((0, _locatorUtils.getByPlaceholderSelector)(text, options));
  }
  getByText(text, options) {
    return this.locator((0, _locatorUtils.getByTextSelector)(text, options));
  }
  getByTitle(text, options) {
    return this.locator((0, _locatorUtils.getByTitleSelector)(text, options));
  }
  getByRole(role, options = {}) {
    return this.locator((0, _locatorUtils.getByRoleSelector)(role, options));
  }
  frameLocator(selector) {
    return new FrameLocator(this._frame, this._selector + ' >> ' + selector);
  }
  filter(options) {
    return new Locator(this._frame, this._selector, options);
  }
  async elementHandle(options) {
    return await this._frame.waitForSelector(this._selector, {
      strict: true,
      state: 'attached',
      ...options
    });
  }
  async elementHandles() {
    return await this._frame.$$(this._selector);
  }
  contentFrame() {
    return new FrameLocator(this._frame, this._selector);
  }
  first() {
    return new Locator(this._frame, this._selector + ' >> nth=0');
  }
  last() {
    return new Locator(this._frame, this._selector + ` >> nth=-1`);
  }
  nth(index) {
    return new Locator(this._frame, this._selector + ` >> nth=${index}`);
  }
  and(locator) {
    if (locator._frame !== this._frame) throw new Error(`Locators must belong to the same frame.`);
    return new Locator(this._frame, this._selector + ` >> internal:and=` + JSON.stringify(locator._selector));
  }
  or(locator) {
    if (locator._frame !== this._frame) throw new Error(`Locators must belong to the same frame.`);
    return new Locator(this._frame, this._selector + ` >> internal:or=` + JSON.stringify(locator._selector));
  }
  async focus(options) {
    return await this._frame.focus(this._selector, {
      strict: true,
      ...options
    });
  }
  async blur(options) {
    await this._frame._channel.blur({
      selector: this._selector,
      strict: true,
      ...options
    });
  }
  async count() {
    return await this._frame._queryCount(this._selector);
  }
  async getAttribute(name, options) {
    return await this._frame.getAttribute(this._selector, name, {
      strict: true,
      ...options
    });
  }
  async hover(options = {}) {
    return await this._frame.hover(this._selector, {
      strict: true,
      ...options
    });
  }
  async innerHTML(options) {
    return await this._frame.innerHTML(this._selector, {
      strict: true,
      ...options
    });
  }
  async innerText(options) {
    return await this._frame.innerText(this._selector, {
      strict: true,
      ...options
    });
  }
  async inputValue(options) {
    return await this._frame.inputValue(this._selector, {
      strict: true,
      ...options
    });
  }
  async isChecked(options) {
    return await this._frame.isChecked(this._selector, {
      strict: true,
      ...options
    });
  }
  async isDisabled(options) {
    return await this._frame.isDisabled(this._selector, {
      strict: true,
      ...options
    });
  }
  async isEditable(options) {
    return await this._frame.isEditable(this._selector, {
      strict: true,
      ...options
    });
  }
  async isEnabled(options) {
    return await this._frame.isEnabled(this._selector, {
      strict: true,
      ...options
    });
  }
  async isHidden(options) {
    return await this._frame.isHidden(this._selector, {
      strict: true,
      ...options
    });
  }
  async isVisible(options) {
    return await this._frame.isVisible(this._selector, {
      strict: true,
      ...options
    });
  }
  async press(key, options = {}) {
    return await this._frame.press(this._selector, key, {
      strict: true,
      ...options
    });
  }
  async screenshot(options = {}) {
    return await this._withElement((h, timeout) => h.screenshot({
      ...options,
      timeout
    }), options.timeout);
  }
  async scrollIntoViewIfNeeded(options = {}) {
    return await this._withElement((h, timeout) => h.scrollIntoViewIfNeeded({
      ...options,
      timeout
    }), options.timeout);
  }
  async selectOption(values, options = {}) {
    return await this._frame.selectOption(this._selector, values, {
      strict: true,
      ...options
    });
  }
  async selectText(options = {}) {
    return await this._withElement((h, timeout) => h.selectText({
      ...options,
      timeout
    }), options.timeout);
  }
  async setChecked(checked, options) {
    if (checked) await this.check(options);else await this.uncheck(options);
  }
  async setInputFiles(files, options = {}) {
    return await this._frame.setInputFiles(this._selector, files, {
      strict: true,
      ...options
    });
  }
  async tap(options = {}) {
    return await this._frame.tap(this._selector, {
      strict: true,
      ...options
    });
  }
  async textContent(options) {
    return await this._frame.textContent(this._selector, {
      strict: true,
      ...options
    });
  }
  async type(text, options = {}) {
    return await this._frame.type(this._selector, text, {
      strict: true,
      ...options
    });
  }
  async pressSequentially(text, options = {}) {
    return await this.type(text, options);
  }
  async uncheck(options = {}) {
    return await this._frame.uncheck(this._selector, {
      strict: true,
      ...options
    });
  }
  async all() {
    return new Array(await this.count()).fill(0).map((e, i) => this.nth(i));
  }
  async allInnerTexts() {
    return await this._frame.$$eval(this._selector, ee => ee.map(e => e.innerText));
  }
  async allTextContents() {
    return await this._frame.$$eval(this._selector, ee => ee.map(e => e.textContent || ''));
  }
  async waitFor(options) {
    await this._frame._channel.waitForSelector({
      selector: this._selector,
      strict: true,
      omitReturnValue: true,
      ...options
    });
  }
  async _expect(expression, options) {
    const params = {
      selector: this._selector,
      expression,
      ...options,
      isNot: !!options.isNot
    };
    params.expectedValue = (0, _jsHandle.serializeArgument)(options.expectedValue);
    const result = await this._frame._channel.expect(params);
    if (result.received !== undefined) result.received = (0, _jsHandle.parseResult)(result.received);
    return result;
  }
  [_util$inspect$custom]() {
    return this.toString();
  }
  toString() {
    return (0, _utils.asLocator)('javascript', this._selector);
  }
}
exports.Locator = Locator;
class FrameLocator {
  constructor(frame, selector) {
    this._frame = void 0;
    this._frameSelector = void 0;
    this._frame = frame;
    this._frameSelector = selector;
  }
  locator(selectorOrLocator, options) {
    if ((0, _utils.isString)(selectorOrLocator)) return new Locator(this._frame, this._frameSelector + ' >> internal:control=enter-frame >> ' + selectorOrLocator, options);
    if (selectorOrLocator._frame !== this._frame) throw new Error(`Locators must belong to the same frame.`);
    return new Locator(this._frame, this._frameSelector + ' >> internal:control=enter-frame >> ' + selectorOrLocator._selector, options);
  }
  getByTestId(testId) {
    return this.locator((0, _locatorUtils.getByTestIdSelector)(testIdAttributeName(), testId));
  }
  getByAltText(text, options) {
    return this.locator((0, _locatorUtils.getByAltTextSelector)(text, options));
  }
  getByLabel(text, options) {
    return this.locator((0, _locatorUtils.getByLabelSelector)(text, options));
  }
  getByPlaceholder(text, options) {
    return this.locator((0, _locatorUtils.getByPlaceholderSelector)(text, options));
  }
  getByText(text, options) {
    return this.locator((0, _locatorUtils.getByTextSelector)(text, options));
  }
  getByTitle(text, options) {
    return this.locator((0, _locatorUtils.getByTitleSelector)(text, options));
  }
  getByRole(role, options = {}) {
    return this.locator((0, _locatorUtils.getByRoleSelector)(role, options));
  }
  owner() {
    return new Locator(this._frame, this._frameSelector);
  }
  frameLocator(selector) {
    return new FrameLocator(this._frame, this._frameSelector + ' >> internal:control=enter-frame >> ' + selector);
  }
  first() {
    return new FrameLocator(this._frame, this._frameSelector + ' >> nth=0');
  }
  last() {
    return new FrameLocator(this._frame, this._frameSelector + ` >> nth=-1`);
  }
  nth(index) {
    return new FrameLocator(this._frame, this._frameSelector + ` >> nth=${index}`);
  }
}
exports.FrameLocator = FrameLocator;
let _testIdAttributeName = 'data-testid';
function testIdAttributeName() {
  return _testIdAttributeName;
}
function setTestIdAttribute(attributeName) {
  _testIdAttributeName = attributeName;
}