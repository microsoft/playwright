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

import type { BrowserContextOptions } from '../../..';
import type { LanguageGenerator, LanguageGeneratorOptions } from './language';
import { sanitizeDeviceOptions, toSignalMap } from './language';
import type { ActionInContext } from './codeGenerator';
import type { Action } from './recorderActions';
import { actionTitle } from './recorderActions';
import type { MouseClickOptions } from './utils';
import { toModifiers } from './utils';
import { escapeWithQuotes } from '../../utils/isomorphic/stringUtils';
import deviceDescriptors from '../deviceDescriptors';

export class PythonLanguageGenerator implements LanguageGenerator {
  id = 'python';
  fileName = 'Python';
  highlighter = 'python';

  private _awaitPrefix: '' | 'await ';
  private _asyncPrefix: '' | 'async ';
  private _isAsync: boolean;
  private _isPyTest: boolean;

  constructor(isAsync: boolean, isPyTest: boolean) {
    this.id = isPyTest ? 'pytest' : (isAsync ? 'python-async' : 'python');
    this.fileName = isPyTest ? 'Pytest' : (isAsync ? 'Python Async' : 'Python');
    this._isAsync = isAsync;
    this._isPyTest = isPyTest;
    this._awaitPrefix = isAsync ? 'await ' : '';
    this._asyncPrefix = isAsync ? 'async ' : '';
  }

  generateAction(actionInContext: ActionInContext): string {
    const action = actionInContext.action;
    if (this._isPyTest && (action.name === 'openPage' || action.name === 'closePage'))
      return '';

    const pageAlias = actionInContext.frame.pageAlias;
    const formatter = new PythonFormatter(4);
    formatter.newLine();
    formatter.add('# ' + actionTitle(action));

    if (action.name === 'openPage') {
      formatter.add(`${pageAlias} = ${this._awaitPrefix}context.new_page()`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`${this._awaitPrefix}${pageAlias}.goto(${quote(action.url)})`);
      return formatter.format();
    }

    let subject: string;
    if (actionInContext.frame.isMainFrame) {
      subject = pageAlias;
    } else if (actionInContext.frame.selectorsChain && action.name !== 'navigate') {
      const locators = actionInContext.frame.selectorsChain.map(selector => '.' + asLocator(selector, 'frame_locator'));
      subject = `${pageAlias}${locators.join('')}`;
    } else if (actionInContext.frame.name) {
      subject = `${pageAlias}.frame(${formatOptions({ name: actionInContext.frame.name }, false)})`;
    } else {
      subject = `${pageAlias}.frame(${formatOptions({ url: actionInContext.frame.url }, false)})`;
    }

    const signals = toSignalMap(action);

    if (signals.dialog)
      formatter.add(`  ${pageAlias}.once("dialog", lambda dialog: dialog.dismiss())`);

    const actionCall = this._generateActionCall(action);
    let code = `${this._awaitPrefix}${subject}.${actionCall}`;

    if (signals.popup) {
      code = `${this._asyncPrefix}with ${pageAlias}.expect_popup() as popup_info {
        ${code}
      }
      ${signals.popup.popupAlias} = ${this._awaitPrefix}popup_info.value`;
    }

    if (signals.download) {
      code = `${this._asyncPrefix}with ${pageAlias}.expect_download() as download_info {
        ${code}
      }
      download = ${this._awaitPrefix}download_info.value`;
    }

    if (signals.waitForNavigation) {
      code = `
      # ${this._asyncPrefix}with ${pageAlias}.expect_navigation(url=${quote(signals.waitForNavigation.url)}):
      ${this._asyncPrefix}with ${pageAlias}.expect_navigation() {
        ${code}
      }`;
    }

    formatter.add(code);

    if (signals.assertNavigation)
      formatter.add(`  # ${this._awaitPrefix}expect(${pageAlias}).to_have_url(${quote(signals.assertNavigation.url)})`);
    return formatter.format();
  }

  private _generateActionCall(action: Action): string {
    switch (action.name) {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return 'close()';
      case 'click': {
        let method = 'click';
        if (action.clickCount === 2)
          method = 'dblclick';
        const modifiers = toModifiers(action.modifiers);
        const options: MouseClickOptions = {};
        if (action.button !== 'left')
          options.button = action.button;
        if (modifiers.length)
          options.modifiers = modifiers;
        if (action.clickCount > 2)
          options.clickCount = action.clickCount;
        if (action.position)
          options.position = action.position;
        const optionsString = formatOptions(options, false);
        return asLocator(action.selector) + `.${method}(${optionsString})`;
      }
      case 'check':
        return asLocator(action.selector) + `.check()`;
      case 'uncheck':
        return asLocator(action.selector) + `.uncheck()`;
      case 'fill':
        return asLocator(action.selector) + `.fill(${quote(action.text)})`;
      case 'setInputFiles':
        return asLocator(action.selector) + `.set_input_files(${formatValue(action.files.length === 1 ? action.files[0] : action.files)})`;
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return asLocator(action.selector) + `.press(${quote(shortcut)})`;
      }
      case 'navigate':
        return `goto(${quote(action.url)})`;
      case 'select':
        return asLocator(action.selector) + `.select_option(${formatValue(action.options.length === 1 ? action.options[0] : action.options)})`;
    }
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    const formatter = new PythonFormatter();
    if (this._isPyTest) {
      const contextOptions = formatContextOptions(options.contextOptions, options.deviceName, true /* asDict */);
      const fixture = contextOptions ? `

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args, playwright) {
    return {${contextOptions}}
}
` : '';
      formatter.add(`${options.deviceName ? 'import pytest\n' : ''}
from playwright.sync_api import Page, expect
${fixture}

def test_example(page: Page) -> None {`);
    } else if (this._isAsync) {
      formatter.add(`
import asyncio

from playwright.async_api import Playwright, async_playwright, expect


async def run(playwright: Playwright) -> None {
    browser = await playwright.${options.browserName}.launch(${formatOptions(options.launchOptions, false)})
    context = await browser.new_context(${formatContextOptions(options.contextOptions, options.deviceName)})`);
    } else {
      formatter.add(`
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None {
    browser = playwright.${options.browserName}.launch(${formatOptions(options.launchOptions, false)})
    context = browser.new_context(${formatContextOptions(options.contextOptions, options.deviceName)})`);
    }
    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
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

function formatValue(value: any): string {
  if (value === false)
    return 'False';
  if (value === true)
    return 'True';
  if (value === undefined)
    return 'None';
  if (Array.isArray(value))
    return `[${value.map(formatValue).join(', ')}]`;
  if (typeof value === 'string')
    return quote(value);
  if (typeof value === 'object')
    return JSON.stringify(value);
  return String(value);
}

function toSnakeCase(name: string): string {
  const toSnakeCaseRegex = /((?<=[a-z0-9])[A-Z]|(?!^)[A-Z](?=[a-z]))/g;
  return name.replace(toSnakeCaseRegex, `_$1`).toLowerCase();
}

function formatOptions(value: any, hasArguments: boolean, asDict?: boolean): string {
  const keys = Object.keys(value);
  if (!keys.length)
    return '';
  return (hasArguments ? ', ' : '') + keys.map(key => {
    if (asDict)
      return `"${toSnakeCase(key)}": ${formatValue(value[key])}`;
    return `${toSnakeCase(key)}=${formatValue(value[key])}`;
  }).join(', ');
}

function formatContextOptions(options: BrowserContextOptions, deviceName: string | undefined, asDict?: boolean): string {
  const device = deviceName && deviceDescriptors[deviceName];
  if (!device)
    return formatOptions(options, false, asDict);
  return `**playwright.devices[${quote(deviceName!)}]` + formatOptions(sanitizeDeviceOptions(device, options), true, asDict);
}

class PythonFormatter {
  private _baseIndent: string;
  private _baseOffset: string;
  private _lines: string[] = [];

  constructor(offset = 0) {
    this._baseIndent = ' '.repeat(4);
    this._baseOffset = ' '.repeat(offset);
  }

  prepend(text: string) {
    this._lines = text.trim().split('\n').map(line => line.trim()).concat(this._lines);
  }

  add(text: string) {
    this._lines.push(...text.trim().split('\n').map(line => line.trim()));
  }

  newLine() {
    this._lines.push('');
  }

  format(): string {
    let spaces = '';
    const lines: string[] = [];
    this._lines.forEach((line: string) => {
      if (line === '')
        return lines.push(line);
      if (line === '}') {
        spaces = spaces.substring(this._baseIndent.length);
        return;
      }

      line = spaces  + line;
      if (line.endsWith('{')) {
        spaces += this._baseIndent;
        line = line.substring(0, line.length - 1).trimEnd() + ':';
      }
      return lines.push(this._baseOffset + line);
    });
    return lines.join('\n');
  }
}

function quote(text: string) {
  return escapeWithQuotes(text, '\"');
}

function asLocator(selector: string, locatorFn = 'locator') {
  const match = selector.match(/(.*)\s+>>\s+nth=(\d+)$/);
  if (!match)
    return `${locatorFn}(${quote(selector)})`;
  if (+match[2] === 0)
    return `${locatorFn}(${quote(match[1])}).first`;
  return `${locatorFn}(${quote(match[1])}).nth(${match[2]})`;
}
