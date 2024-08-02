"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PythonLanguageGenerator = void 0;
var _language = require("./language");
var _utils = require("./utils");
var _stringUtils = require("../../utils/isomorphic/stringUtils");
var _deviceDescriptors = require("../deviceDescriptors");
var _locatorGenerators = require("../../utils/isomorphic/locatorGenerators");
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

class PythonLanguageGenerator {
  constructor(isAsync, isPyTest) {
    this.id = void 0;
    this.groupName = 'Python';
    this.name = void 0;
    this.highlighter = 'python';
    this._awaitPrefix = void 0;
    this._asyncPrefix = void 0;
    this._isAsync = void 0;
    this._isPyTest = void 0;
    this.id = isPyTest ? 'python-pytest' : isAsync ? 'python-async' : 'python';
    this.name = isPyTest ? 'Pytest' : isAsync ? 'Library Async' : 'Library';
    this._isAsync = isAsync;
    this._isPyTest = isPyTest;
    this._awaitPrefix = isAsync ? 'await ' : '';
    this._asyncPrefix = isAsync ? 'async ' : '';
  }
  generateAction(actionInContext) {
    const action = actionInContext.action;
    if (this._isPyTest && (action.name === 'openPage' || action.name === 'closePage')) return '';
    const pageAlias = actionInContext.frame.pageAlias;
    const formatter = new PythonFormatter(4);
    if (action.name === 'openPage') {
      formatter.add(`${pageAlias} = ${this._awaitPrefix}context.new_page()`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/') formatter.add(`${this._awaitPrefix}${pageAlias}.goto(${quote(action.url)})`);
      return formatter.format();
    }
    let subject;
    if (actionInContext.frame.isMainFrame) {
      subject = pageAlias;
    } else {
      const locators = actionInContext.frame.selectorsChain.map(selector => `.frame_locator(${quote(selector)})`);
      subject = `${pageAlias}${locators.join('')}`;
    }
    const signals = (0, _language.toSignalMap)(action);
    if (signals.dialog) formatter.add(`  ${pageAlias}.once("dialog", lambda dialog: dialog.dismiss())`);
    let code = `${this._awaitPrefix}${this._generateActionCall(subject, action)}`;
    if (signals.popup) {
      code = `${this._asyncPrefix}with ${pageAlias}.expect_popup() as ${signals.popup.popupAlias}_info {
        ${code}
      }
      ${signals.popup.popupAlias} = ${this._awaitPrefix}${signals.popup.popupAlias}_info.value`;
    }
    if (signals.download) {
      code = `${this._asyncPrefix}with ${pageAlias}.expect_download() as download${signals.download.downloadAlias}_info {
        ${code}
      }
      download${signals.download.downloadAlias} = ${this._awaitPrefix}download${signals.download.downloadAlias}_info.value`;
    }
    formatter.add(code);
    return formatter.format();
  }
  _generateActionCall(subject, action) {
    switch (action.name) {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return `${subject}.close()`;
      case 'click':
        {
          let method = 'click';
          if (action.clickCount === 2) method = 'dblclick';
          const modifiers = (0, _utils.toModifiers)(action.modifiers);
          const options = {};
          if (action.button !== 'left') options.button = action.button;
          if (modifiers.length) options.modifiers = modifiers;
          if (action.clickCount > 2) options.clickCount = action.clickCount;
          if (action.position) options.position = action.position;
          const optionsString = formatOptions(options, false);
          return `${subject}.${this._asLocator(action.selector)}.${method}(${optionsString})`;
        }
      case 'check':
        return `${subject}.${this._asLocator(action.selector)}.check()`;
      case 'uncheck':
        return `${subject}.${this._asLocator(action.selector)}.uncheck()`;
      case 'fill':
        return `${subject}.${this._asLocator(action.selector)}.fill(${quote(action.text)})`;
      case 'setInputFiles':
        return `${subject}.${this._asLocator(action.selector)}.set_input_files(${formatValue(action.files.length === 1 ? action.files[0] : action.files)})`;
      case 'press':
        {
          const modifiers = (0, _utils.toModifiers)(action.modifiers);
          const shortcut = [...modifiers, action.key].join('+');
          return `${subject}.${this._asLocator(action.selector)}.press(${quote(shortcut)})`;
        }
      case 'navigate':
        return `${subject}.goto(${quote(action.url)})`;
      case 'select':
        return `${subject}.${this._asLocator(action.selector)}.select_option(${formatValue(action.options.length === 1 ? action.options[0] : action.options)})`;
      case 'assertText':
        return `expect(${subject}.${this._asLocator(action.selector)}).${action.substring ? 'to_contain_text' : 'to_have_text'}(${quote(action.text)})`;
      case 'assertChecked':
        return `expect(${subject}.${this._asLocator(action.selector)}).${action.checked ? 'to_be_checked()' : 'not_to_be_checked()'}`;
      case 'assertVisible':
        return `expect(${subject}.${this._asLocator(action.selector)}).to_be_visible()`;
      case 'assertValue':
        {
          const assertion = action.value ? `to_have_value(${quote(action.value)})` : `to_be_empty()`;
          return `expect(${subject}.${this._asLocator(action.selector)}).${assertion};`;
        }
    }
  }
  _asLocator(selector) {
    return (0, _locatorGenerators.asLocator)('python', selector);
  }
  generateHeader(options) {
    const formatter = new PythonFormatter();
    if (this._isPyTest) {
      const contextOptions = formatContextOptions(options.contextOptions, options.deviceName, true /* asDict */);
      const fixture = contextOptions ? `

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args, playwright) {
    return {${contextOptions}}
}
` : '';
      formatter.add(`${options.deviceName ? 'import pytest\n' : ''}import re
from playwright.sync_api import Page, expect
${fixture}

def test_example(page: Page) -> None {`);
    } else if (this._isAsync) {
      formatter.add(`
import asyncio
import re
from playwright.async_api import Playwright, async_playwright, expect


async def run(playwright: Playwright) -> None {
    browser = await playwright.${options.browserName}.launch(${formatOptions(options.launchOptions, false)})
    context = await browser.new_context(${formatContextOptions(options.contextOptions, options.deviceName)})`);
    } else {
      formatter.add(`
import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None {
    browser = playwright.${options.browserName}.launch(${formatOptions(options.launchOptions, false)})
    context = browser.new_context(${formatContextOptions(options.contextOptions, options.deviceName)})`);
    }
    return formatter.format();
  }
  generateFooter(saveStorage) {
    if (this._isPyTest) {
      return '';
    } else if (this._isAsync) {
      const storageStateLine = saveStorage ? `\n    await context.storage_state(path=${quote(saveStorage)})` : '';
      return `\n    # ---------------------${storageStateLine}
    await context.close()
    await browser.close()


async def main() -> None:
    async with async_playwright() as playwright:
        await run(playwright)


asyncio.run(main())
`;
    } else {
      const storageStateLine = saveStorage ? `\n    context.storage_state(path=${quote(saveStorage)})` : '';
      return `\n    # ---------------------${storageStateLine}
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
`;
    }
  }
}
exports.PythonLanguageGenerator = PythonLanguageGenerator;
function formatValue(value) {
  if (value === false) return 'False';
  if (value === true) return 'True';
  if (value === undefined) return 'None';
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function formatOptions(value, hasArguments, asDict) {
  const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
  if (!keys.length) return '';
  return (hasArguments ? ', ' : '') + keys.map(key => {
    if (asDict) return `"${(0, _stringUtils.toSnakeCase)(key)}": ${formatValue(value[key])}`;
    return `${(0, _stringUtils.toSnakeCase)(key)}=${formatValue(value[key])}`;
  }).join(', ');
}
function convertContextOptions(options) {
  const result = {
    ...options
  };
  if (options.recordHar) {
    result['record_har_path'] = options.recordHar.path;
    result['record_har_content'] = options.recordHar.content;
    result['record_har_mode'] = options.recordHar.mode;
    result['record_har_omit_content'] = options.recordHar.omitContent;
    result['record_har_url_filter'] = options.recordHar.urlFilter;
    delete result.recordHar;
  }
  return result;
}
function formatContextOptions(options, deviceName, asDict) {
  const device = deviceName && _deviceDescriptors.deviceDescriptors[deviceName];
  if (!device) return formatOptions(convertContextOptions(options), false, asDict);
  return `**playwright.devices[${quote(deviceName)}]` + formatOptions(convertContextOptions((0, _language.sanitizeDeviceOptions)(device, options)), true, asDict);
}
class PythonFormatter {
  constructor(offset = 0) {
    this._baseIndent = void 0;
    this._baseOffset = void 0;
    this._lines = [];
    this._baseIndent = ' '.repeat(4);
    this._baseOffset = ' '.repeat(offset);
  }
  prepend(text) {
    this._lines = text.trim().split('\n').map(line => line.trim()).concat(this._lines);
  }
  add(text) {
    this._lines.push(...text.trim().split('\n').map(line => line.trim()));
  }
  newLine() {
    this._lines.push('');
  }
  format() {
    let spaces = '';
    const lines = [];
    this._lines.forEach(line => {
      if (line === '') return lines.push(line);
      if (line === '}') {
        spaces = spaces.substring(this._baseIndent.length);
        return;
      }
      line = spaces + line;
      if (line.endsWith('{')) {
        spaces += this._baseIndent;
        line = line.substring(0, line.length - 1).trimEnd() + ':';
      }
      return lines.push(this._baseOffset + line);
    });
    return lines.join('\n');
  }
}
function quote(text) {
  return (0, _stringUtils.escapeWithQuotes)(text, '\"');
}