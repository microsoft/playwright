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

import type { BrowserContextOptions } from '../../../..';
import { LanguageGenerator, LanguageGeneratorOptions, sanitizeDeviceOptions, toSignalMap } from './language';
import { ActionInContext } from './codeGenerator';
import { actionTitle, Action } from './recorderActions';
import { MouseClickOptions, toModifiers } from './utils';
import deviceDescriptors from '../../deviceDescriptors';

export class PythonLanguageGenerator implements LanguageGenerator {
  id = 'python';
  fileName = 'Python';
  highlighter = 'python';

  private _awaitPrefix: '' | 'await ';
  private _asyncPrefix: '' | 'async ';
  private _isAsync: boolean;

  constructor(isAsync: boolean) {
    this.id = isAsync ? 'python-async' : 'python';
    this.fileName = isAsync ? 'Python Async' : 'Python';
    this._isAsync = isAsync;
    this._awaitPrefix = isAsync ? 'await ' : '';
    this._asyncPrefix = isAsync ? 'async ' : '';
  }

  generateAction(actionInContext: ActionInContext): string {
    const { action, pageAlias } = actionInContext;
    const formatter = new PythonFormatter(4);
    formatter.newLine();
    formatter.add('# ' + actionTitle(action));

    if (action.name === 'openPage') {
      formatter.add(`${pageAlias} = ${this._awaitPrefix}context.new_page()`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`${this._awaitPrefix}${pageAlias}.goto(${quote(action.url)})`);
      return formatter.format();
    }

    const subject = actionInContext.isMainFrame ? pageAlias :
      (actionInContext.frameName ?
        `${pageAlias}.frame(${formatOptions({ name: actionInContext.frameName }, false)})` :
        `${pageAlias}.frame(${formatOptions({ url: actionInContext.frameUrl }, false)})`);

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
      formatter.add(`  # assert ${pageAlias}.url == ${quote(signals.assertNavigation.url)}`);
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
        const optionsString = formatOptions(options, true);
        return `${method}(${quote(action.selector)}${optionsString})`;
      }
      case 'check':
        return `check(${quote(action.selector)})`;
      case 'uncheck':
        return `uncheck(${quote(action.selector)})`;
      case 'fill':
        return `fill(${quote(action.selector)}, ${quote(action.text)})`;
      case 'setInputFiles':
        return `set_input_files(${quote(action.selector)}, ${formatValue(action.files.length === 1 ? action.files[0] : action.files)})`;
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return `press(${quote(action.selector)}, ${quote(shortcut)})`;
      }
      case 'navigate':
        return `goto(${quote(action.url)})`;
      case 'select':
        return `select_option(${quote(action.selector)}, ${formatValue(action.options.length === 1 ? action.options[0] : action.options)})`;
    }
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    const formatter = new PythonFormatter();
    if (this._isAsync) {
      formatter.add(`
import asyncio
from playwright.async_api import async_playwright

async def run(playwright) {
    browser = await playwright.${options.browserName}.launch(${formatOptions(options.launchOptions, false)})
    context = await browser.new_context(${formatContextOptions(options.contextOptions, options.deviceName)})`);
    } else {
      formatter.add(`
from playwright.sync_api import sync_playwright

def run(playwright) {
    browser = playwright.${options.browserName}.launch(${formatOptions(options.launchOptions, false)})
    context = browser.new_context(${formatContextOptions(options.contextOptions, options.deviceName)})`);
    }
    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
    if (this._isAsync) {
      const storageStateLine = saveStorage ? `\n    await context.storage_state(path="${saveStorage}")` : '';
      return `\n    # ---------------------${storageStateLine}
    await context.close()
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())`;
    } else {
      const storageStateLine = saveStorage ? `\n    context.storage_state(path="${saveStorage}")` : '';
      return `\n    # ---------------------${storageStateLine}
    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)`;
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
  return String(value);
}

function toSnakeCase(name: string): string {
  const toSnakeCaseRegex = /((?<=[a-z0-9])[A-Z]|(?!^)[A-Z](?=[a-z]))/g;
  return name.replace(toSnakeCaseRegex, `_$1`).toLowerCase();
}

function formatOptions(value: any, hasArguments: boolean): string {
  const keys = Object.keys(value);
  if (!keys.length)
    return '';
  return (hasArguments ? ', ' : '') + keys.map(key => `${toSnakeCase(key)}=${formatValue(value[key])}`).join(', ');
}

function formatContextOptions(options: BrowserContextOptions, deviceName: string | undefined): string {
  const device = deviceName && deviceDescriptors[deviceName];
  if (!device)
    return formatOptions(options, false);
  return `**playwright.devices["${deviceName}"]` + formatOptions(sanitizeDeviceOptions(device, options), true);
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

function quote(text: string, char: string = '\"') {
  if (char === '\'')
    return char + text.replace(/[']/g, '\\\'') + char;
  if (char === '"')
    return char + text.replace(/["]/g, '\\"') + char;
  if (char === '`')
    return char + text.replace(/[`]/g, '\\`') + char;
  throw new Error('Invalid escape char');
}
