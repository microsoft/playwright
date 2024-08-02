"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toBeAttached = toBeAttached;
exports.toBeChecked = toBeChecked;
exports.toBeDisabled = toBeDisabled;
exports.toBeEditable = toBeEditable;
exports.toBeEmpty = toBeEmpty;
exports.toBeEnabled = toBeEnabled;
exports.toBeFocused = toBeFocused;
exports.toBeHidden = toBeHidden;
exports.toBeInViewport = toBeInViewport;
exports.toBeOK = toBeOK;
exports.toBeVisible = toBeVisible;
exports.toContainText = toContainText;
exports.toHaveAccessibleDescription = toHaveAccessibleDescription;
exports.toHaveAccessibleName = toHaveAccessibleName;
exports.toHaveAttribute = toHaveAttribute;
exports.toHaveCSS = toHaveCSS;
exports.toHaveClass = toHaveClass;
exports.toHaveCount = toHaveCount;
exports.toHaveId = toHaveId;
exports.toHaveJSProperty = toHaveJSProperty;
exports.toHaveRole = toHaveRole;
exports.toHaveText = toHaveText;
exports.toHaveTitle = toHaveTitle;
exports.toHaveURL = toHaveURL;
exports.toHaveValue = toHaveValue;
exports.toHaveValues = toHaveValues;
exports.toPass = toPass;
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _util = require("../util");
var _toBeTruthy = require("./toBeTruthy");
var _toEqual = require("./toEqual");
var _toMatchText = require("./toMatchText");
var _utils = require("playwright-core/lib/utils");
var _globals = require("../common/globals");
var _testInfo = require("../worker/testInfo");
var _config = require("../common/config");
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

function toBeAttached(locator, options) {
  const attached = !options || options.attached === undefined || options.attached;
  const expected = attached ? 'attached' : 'detached';
  const unexpected = attached ? 'detached' : 'attached';
  const arg = attached ? '' : '{ attached: false }';
  return _toBeTruthy.toBeTruthy.call(this, 'toBeAttached', locator, 'Locator', expected, unexpected, arg, async (isNot, timeout) => {
    return await locator._expect(attached ? 'to.be.attached' : 'to.be.detached', {
      isNot,
      timeout
    });
  }, options);
}
function toBeChecked(locator, options) {
  const checked = !options || options.checked === undefined || options.checked;
  const expected = checked ? 'checked' : 'unchecked';
  const unexpected = checked ? 'unchecked' : 'checked';
  const arg = checked ? '' : '{ checked: false }';
  return _toBeTruthy.toBeTruthy.call(this, 'toBeChecked', locator, 'Locator', expected, unexpected, arg, async (isNot, timeout) => {
    return await locator._expect(checked ? 'to.be.checked' : 'to.be.unchecked', {
      isNot,
      timeout
    });
  }, options);
}
function toBeDisabled(locator, options) {
  return _toBeTruthy.toBeTruthy.call(this, 'toBeDisabled', locator, 'Locator', 'disabled', 'enabled', '', async (isNot, timeout) => {
    return await locator._expect('to.be.disabled', {
      isNot,
      timeout
    });
  }, options);
}
function toBeEditable(locator, options) {
  const editable = !options || options.editable === undefined || options.editable;
  const expected = editable ? 'editable' : 'readOnly';
  const unexpected = editable ? 'readOnly' : 'editable';
  const arg = editable ? '' : '{ editable: false }';
  return _toBeTruthy.toBeTruthy.call(this, 'toBeEditable', locator, 'Locator', expected, unexpected, arg, async (isNot, timeout) => {
    return await locator._expect(editable ? 'to.be.editable' : 'to.be.readonly', {
      isNot,
      timeout
    });
  }, options);
}
function toBeEmpty(locator, options) {
  return _toBeTruthy.toBeTruthy.call(this, 'toBeEmpty', locator, 'Locator', 'empty', 'notEmpty', '', async (isNot, timeout) => {
    return await locator._expect('to.be.empty', {
      isNot,
      timeout
    });
  }, options);
}
function toBeEnabled(locator, options) {
  const enabled = !options || options.enabled === undefined || options.enabled;
  const expected = enabled ? 'enabled' : 'disabled';
  const unexpected = enabled ? 'disabled' : 'enabled';
  const arg = enabled ? '' : '{ enabled: false }';
  return _toBeTruthy.toBeTruthy.call(this, 'toBeEnabled', locator, 'Locator', expected, unexpected, arg, async (isNot, timeout) => {
    return await locator._expect(enabled ? 'to.be.enabled' : 'to.be.disabled', {
      isNot,
      timeout
    });
  }, options);
}
function toBeFocused(locator, options) {
  return _toBeTruthy.toBeTruthy.call(this, 'toBeFocused', locator, 'Locator', 'focused', 'inactive', '', async (isNot, timeout) => {
    return await locator._expect('to.be.focused', {
      isNot,
      timeout
    });
  }, options);
}
function toBeHidden(locator, options) {
  return _toBeTruthy.toBeTruthy.call(this, 'toBeHidden', locator, 'Locator', 'hidden', 'visible', '', async (isNot, timeout) => {
    return await locator._expect('to.be.hidden', {
      isNot,
      timeout
    });
  }, options);
}
function toBeVisible(locator, options) {
  const visible = !options || options.visible === undefined || options.visible;
  const expected = visible ? 'visible' : 'hidden';
  const unexpected = visible ? 'hidden' : 'visible';
  const arg = visible ? '' : '{ visible: false }';
  return _toBeTruthy.toBeTruthy.call(this, 'toBeVisible', locator, 'Locator', expected, unexpected, arg, async (isNot, timeout) => {
    return await locator._expect(visible ? 'to.be.visible' : 'to.be.hidden', {
      isNot,
      timeout
    });
  }, options);
}
function toBeInViewport(locator, options) {
  return _toBeTruthy.toBeTruthy.call(this, 'toBeInViewport', locator, 'Locator', 'in viewport', 'outside viewport', '', async (isNot, timeout) => {
    return await locator._expect('to.be.in.viewport', {
      isNot,
      expectedNumber: options === null || options === void 0 ? void 0 : options.ratio,
      timeout
    });
  }, options);
}
function toContainText(locator, expected, options = {}) {
  if (Array.isArray(expected)) {
    return _toEqual.toEqual.call(this, 'toContainText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = (0, _toMatchText.toExpectedTextValues)(expected, {
        matchSubstring: true,
        normalizeWhiteSpace: true,
        ignoreCase: options.ignoreCase
      });
      return await locator._expect('to.contain.text.array', {
        expectedText,
        isNot,
        useInnerText: options.useInnerText,
        timeout
      });
    }, expected, {
      ...options,
      contains: true
    });
  } else {
    return _toMatchText.toMatchText.call(this, 'toContainText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = (0, _toMatchText.toExpectedTextValues)([expected], {
        matchSubstring: true,
        normalizeWhiteSpace: true,
        ignoreCase: options.ignoreCase
      });
      return await locator._expect('to.have.text', {
        expectedText,
        isNot,
        useInnerText: options.useInnerText,
        timeout
      });
    }, expected, options);
  }
}
function toHaveAccessibleDescription(locator, expected, options) {
  return _toMatchText.toMatchText.call(this, 'toHaveAccessibleDescription', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected], {
      ignoreCase: options === null || options === void 0 ? void 0 : options.ignoreCase
    });
    return await locator._expect('to.have.accessible.description', {
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveAccessibleName(locator, expected, options) {
  return _toMatchText.toMatchText.call(this, 'toHaveAccessibleName', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected], {
      ignoreCase: options === null || options === void 0 ? void 0 : options.ignoreCase
    });
    return await locator._expect('to.have.accessible.name', {
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveAttribute(locator, name, expected, options) {
  if (!options) {
    // Update params for the case toHaveAttribute(name, options);
    if (typeof expected === 'object' && !(0, _utils.isRegExp)(expected)) {
      options = expected;
      expected = undefined;
    }
  }
  if (expected === undefined) {
    return _toBeTruthy.toBeTruthy.call(this, 'toHaveAttribute', locator, 'Locator', 'have attribute', 'not have attribute', '', async (isNot, timeout) => {
      return await locator._expect('to.have.attribute', {
        expressionArg: name,
        isNot,
        timeout
      });
    }, options);
  }
  return _toMatchText.toMatchText.call(this, 'toHaveAttribute', locator, 'Locator', async (isNot, timeout) => {
    var _options;
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected], {
      ignoreCase: (_options = options) === null || _options === void 0 ? void 0 : _options.ignoreCase
    });
    return await locator._expect('to.have.attribute.value', {
      expressionArg: name,
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveClass(locator, expected, options) {
  if (Array.isArray(expected)) {
    return _toEqual.toEqual.call(this, 'toHaveClass', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = (0, _toMatchText.toExpectedTextValues)(expected);
      return await locator._expect('to.have.class.array', {
        expectedText,
        isNot,
        timeout
      });
    }, expected, options);
  } else {
    return _toMatchText.toMatchText.call(this, 'toHaveClass', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = (0, _toMatchText.toExpectedTextValues)([expected]);
      return await locator._expect('to.have.class', {
        expectedText,
        isNot,
        timeout
      });
    }, expected, options);
  }
}
function toHaveCount(locator, expected, options) {
  return _toEqual.toEqual.call(this, 'toHaveCount', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.have.count', {
      expectedNumber: expected,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveCSS(locator, name, expected, options) {
  return _toMatchText.toMatchText.call(this, 'toHaveCSS', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected]);
    return await locator._expect('to.have.css', {
      expressionArg: name,
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveId(locator, expected, options) {
  return _toMatchText.toMatchText.call(this, 'toHaveId', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected]);
    return await locator._expect('to.have.id', {
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveJSProperty(locator, name, expected, options) {
  return _toEqual.toEqual.call(this, 'toHaveJSProperty', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.have.property', {
      expressionArg: name,
      expectedValue: expected,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveRole(locator, expected, options) {
  if (!(0, _utils.isString)(expected)) throw new Error(`"role" argument in toHaveRole must be a string`);
  return _toMatchText.toMatchText.call(this, 'toHaveRole', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected]);
    return await locator._expect('to.have.role', {
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveText(locator, expected, options = {}) {
  if (Array.isArray(expected)) {
    return _toEqual.toEqual.call(this, 'toHaveText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = (0, _toMatchText.toExpectedTextValues)(expected, {
        normalizeWhiteSpace: true,
        ignoreCase: options.ignoreCase
      });
      return await locator._expect('to.have.text.array', {
        expectedText,
        isNot,
        useInnerText: options === null || options === void 0 ? void 0 : options.useInnerText,
        timeout
      });
    }, expected, options);
  } else {
    return _toMatchText.toMatchText.call(this, 'toHaveText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = (0, _toMatchText.toExpectedTextValues)([expected], {
        normalizeWhiteSpace: true,
        ignoreCase: options.ignoreCase
      });
      return await locator._expect('to.have.text', {
        expectedText,
        isNot,
        useInnerText: options === null || options === void 0 ? void 0 : options.useInnerText,
        timeout
      });
    }, expected, options);
  }
}
function toHaveValue(locator, expected, options) {
  return _toMatchText.toMatchText.call(this, 'toHaveValue', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected]);
    return await locator._expect('to.have.value', {
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveValues(locator, expected, options) {
  return _toEqual.toEqual.call(this, 'toHaveValues', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)(expected);
    return await locator._expect('to.have.values', {
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveTitle(page, expected, options = {}) {
  const locator = page.locator(':root');
  return _toMatchText.toMatchText.call(this, 'toHaveTitle', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected], {
      normalizeWhiteSpace: true
    });
    return await locator._expect('to.have.title', {
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
function toHaveURL(page, expected, options) {
  const baseURL = page.context()._options.baseURL;
  expected = typeof expected === 'string' ? (0, _utils.constructURLBasedOnBaseURL)(baseURL, expected) : expected;
  const locator = page.locator(':root');
  return _toMatchText.toMatchText.call(this, 'toHaveURL', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = (0, _toMatchText.toExpectedTextValues)([expected], {
      ignoreCase: options === null || options === void 0 ? void 0 : options.ignoreCase
    });
    return await locator._expect('to.have.url', {
      expectedText,
      isNot,
      timeout
    });
  }, expected, options);
}
async function toBeOK(response) {
  const matcherName = 'toBeOK';
  (0, _util.expectTypes)(response, ['APIResponse'], matcherName);
  const contentType = response.headers()['content-type'];
  const isTextEncoding = contentType && (0, _utils.isTextualMimeType)(contentType);
  const [log, text] = this.isNot === response.ok() ? await Promise.all([response._fetchLog(), isTextEncoding ? response.text() : null]) : [];
  const message = () => this.utils.matcherHint(matcherName, undefined, '', {
    isNot: this.isNot
  }) + (0, _util.callLogText)(log) + (text === null ? '' : `\nResponse text:\n${_utilsBundle.colors.dim((text === null || text === void 0 ? void 0 : text.substring(0, 1000)) || '')}`);
  const pass = response.ok();
  return {
    message,
    pass
  };
}
async function toPass(callback, options = {}) {
  var _testInfo$_projectInt, _testInfo$_projectInt2;
  const testInfo = (0, _globals.currentTestInfo)();
  const timeout = (0, _config.takeFirst)(options.timeout, testInfo === null || testInfo === void 0 || (_testInfo$_projectInt = testInfo._projectInternal.expect) === null || _testInfo$_projectInt === void 0 || (_testInfo$_projectInt = _testInfo$_projectInt.toPass) === null || _testInfo$_projectInt === void 0 ? void 0 : _testInfo$_projectInt.timeout, 0);
  const intervals = (0, _config.takeFirst)(options.intervals, testInfo === null || testInfo === void 0 || (_testInfo$_projectInt2 = testInfo._projectInternal.expect) === null || _testInfo$_projectInt2 === void 0 || (_testInfo$_projectInt2 = _testInfo$_projectInt2.toPass) === null || _testInfo$_projectInt2 === void 0 ? void 0 : _testInfo$_projectInt2.intervals, [100, 250, 500, 1000]);
  const {
    deadline,
    timeoutMessage
  } = testInfo ? testInfo._deadlineForMatcher(timeout) : _testInfo.TestInfoImpl._defaultDeadlineForMatcher(timeout);
  const result = await (0, _utils.pollAgainstDeadline)(async () => {
    if (testInfo && (0, _globals.currentTestInfo)() !== testInfo) return {
      continuePolling: false,
      result: undefined
    };
    try {
      await callback();
      return {
        continuePolling: !!this.isNot,
        result: undefined
      };
    } catch (e) {
      return {
        continuePolling: !this.isNot,
        result: e
      };
    }
  }, deadline, intervals);
  if (result.timedOut) {
    const message = result.result ? [result.result.message, '', `Call Log:`, `- ${timeoutMessage}`].join('\n') : timeoutMessage;
    return {
      message: () => message,
      pass: !!this.isNot
    };
  }
  return {
    pass: !this.isNot,
    message: () => ''
  };
}