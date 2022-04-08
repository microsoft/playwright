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

export class CSharpLanguageGenerator implements LanguageGenerator {
  id = 'csharp';
  fileName = 'C#';
  highlighter = 'csharp';

  generateAction(actionInContext: ActionInContext): string {
    const action = actionInContext.action;
    const pageAlias = actionInContext.frame.pageAlias;
    const formatter = new CSharpFormatter(8);
    formatter.newLine();
    formatter.add('// ' + actionTitle(action));

    if (action.name === 'openPage') {
      formatter.add(`var ${pageAlias} = await context.NewPageAsync();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`await ${pageAlias}.GotoAsync(${quote(action.url)});`);
      return formatter.format();
    }

    let subject: string;
    if (actionInContext.frame.isMainFrame) {
      subject = pageAlias;
    } else if (actionInContext.frame.selectorsChain && action.name !== 'navigate') {
      const locators = actionInContext.frame.selectorsChain.map(selector => '.' + asLocator(selector, 'FrameLocator'));
      subject = `${pageAlias}${locators.join('')}`;
    } else if (actionInContext.frame.name) {
      subject = `${pageAlias}.Frame(${quote(actionInContext.frame.name)})`;
    } else {
      subject = `${pageAlias}.FrameByUrl(${quote(actionInContext.frame.url)})`;
    }

    const signals = toSignalMap(action);

    if (signals.dialog) {
      formatter.add(`    void ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler(object sender, IDialog dialog)
      {
          Console.WriteLine($"Dialog message: {dialog.Message}");
          dialog.DismissAsync();
          ${pageAlias}.Dialog -= ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler;
      }
      ${pageAlias}.Dialog += ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler;`);
    }

    const lines: string[] = [];
    const actionCall = this._generateActionCall(action, actionInContext.frame.isMainFrame);
    if (signals.waitForNavigation) {
      lines.push(`await ${pageAlias}.RunAndWaitForNavigationAsync(async () =>`);
      lines.push(`{`);
      lines.push(`    await ${subject}.${actionCall};`);
      lines.push(`}/*, new ${actionInContext.frame.isMainFrame ? 'Page' : 'Frame'}WaitForNavigationOptions`);
      lines.push(`{`);
      lines.push(`    UrlString = ${quote(signals.waitForNavigation.url)}`);
      lines.push(`}*/);`);
    } else {
      lines.push(`await ${subject}.${actionCall};`);
    }

    if (signals.download) {
      lines.unshift(`var download${signals.download.downloadAlias} = await ${pageAlias}.RunAndWaitForDownloadAsync(async () =>\n{`);
      lines.push(`});`);
    }

    if (signals.popup) {
      lines.unshift(`var ${signals.popup.popupAlias} = await ${pageAlias}.RunAndWaitForPopupAsync(async () =>\n{`);
      lines.push(`});`);
    }

    for (const line of lines)
      formatter.add(line);

    if (signals.assertNavigation)
      formatter.add(`  // Assert.AreEqual(${quote(signals.assertNavigation.url)}, ${pageAlias}.Url);`);
    return formatter.format();
  }

  private _generateActionCall(action: Action, isPage: boolean): string {
    switch (action.name) {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return 'CloseAsync()';
      case 'click': {
        let method = 'Click';
        if (action.clickCount === 2)
          method = 'DblClick';
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
        if (!Object.entries(options).length)
          return asLocator(action.selector) + `.${method}Async()`;
        const optionsString = formatObject(options, '    ', 'Locator' + method + 'Options');
        return asLocator(action.selector) + `.${method}Async(${optionsString})`;
      }
      case 'check':
        return asLocator(action.selector) + `.CheckAsync()`;
      case 'uncheck':
        return asLocator(action.selector) + `.UncheckAsync()`;
      case 'fill':
        return asLocator(action.selector) + `.FillAsync(${quote(action.text)})`;
      case 'setInputFiles':
        return asLocator(action.selector) + `.SetInputFilesAsync(${formatObject(action.files)})`;
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return asLocator(action.selector) + `.PressAsync(${quote(shortcut)})`;
      }
      case 'navigate':
        return `GotoAsync(${quote(action.url)})`;
      case 'select':
        return asLocator(action.selector) + `.SelectOptionAsync(${formatObject(action.options)})`;
    }
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    const formatter = new CSharpFormatter(0);
    formatter.add(`
      using Microsoft.Playwright;
      using System;
      using System.Threading.Tasks;

      class Program
      {
          public static async Task Main()
          {
              using var playwright = await Playwright.CreateAsync();
              await using var browser = await playwright.${toPascal(options.browserName)}.LaunchAsync(${formatObject(options.launchOptions, '    ', 'BrowserTypeLaunchOptions')});
              var context = await browser.NewContextAsync(${formatContextOptions(options.contextOptions, options.deviceName)});`);
    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
    const storageStateLine = saveStorage ? `\n        await context.StorageStateAsync(new BrowserContextStorageStateOptions\n        {\n            Path = ${quote(saveStorage)}\n        });\n` : '';
    return `${storageStateLine}    }
}\n`;
  }
}

function formatObject(value: any, indent = '    ', name = ''): string {
  if (typeof value === 'string') {
    if (['permissions', 'colorScheme', 'modifiers', 'button'].includes(name))
      return `${getClassName(name)}.${toPascal(value)}`;
    return quote(value);
  }
  if (Array.isArray(value))
    return `new[] { ${value.map(o => formatObject(o, indent, name)).join(', ')} }`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length)
      return name ? `new ${getClassName(name)}` : '';
    const tokens: string[] = [];
    for (const key of keys) {
      const property = getPropertyName(key);
      tokens.push(`${property} = ${formatObject(value[key], indent, key)},`);
    }
    if (name)
      return `new ${getClassName(name)}\n{\n${indent}${tokens.join(`\n${indent}`)}\n${indent}}`;
    return `{\n${indent}${tokens.join(`\n${indent}`)}\n${indent}}`;
  }
  if (name === 'latitude' || name === 'longitude')
    return String(value) + 'm';

  return String(value);
}

function getClassName(value: string): string {
  switch (value) {
    case 'viewport': return 'ViewportSize';
    case 'proxy': return 'ProxySettings';
    case 'permissions': return 'ContextPermission';
    case 'modifiers': return 'KeyboardModifier';
    case 'button': return 'MouseButton';
    default: return toPascal(value);
  }
}

function getPropertyName(key: string): string {
  switch (key) {
    case 'storageState': return 'StorageStatePath';
    case 'viewport': return 'ViewportSize';
    default: return toPascal(key);
  }
}

function toPascal(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}

function formatContextOptions(options: BrowserContextOptions, deviceName: string | undefined): string {
  const device = deviceName && deviceDescriptors[deviceName];
  if (!device) {
    if (!Object.entries(options).length)
      return '';
    return formatObject(options, '    ', 'BrowserNewContextOptions');
  }

  options = sanitizeDeviceOptions(device, options);
  if (!Object.entries(options).length)
    return `playwright.Devices[${quote(deviceName!)}]`;

  return formatObject(options, '    ', `BrowserNewContextOptions(playwright.Devices[${quote(deviceName!)}])`);
}

class CSharpFormatter {
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
    let previousLine = '';
    return this._lines.map((line: string) => {
      if (line === '')
        return line;
      if (line.startsWith('}') || line.startsWith(']') || line.includes('});') || line === ');')
        spaces = spaces.substring(this._baseIndent.length);

      const extraSpaces = /^(for|while|if).*\(.*\)$/.test(previousLine) ? this._baseIndent : '';
      previousLine = line;

      line = spaces + extraSpaces + line;
      if (line.endsWith('{') || line.endsWith('[') || line.endsWith('('))
        spaces += this._baseIndent;
      if (line.endsWith('));'))
        spaces = spaces.substring(this._baseIndent.length);

      return this._baseOffset + line;
    }).join('\n');
  }
}

function quote(text: string) {
  return escapeWithQuotes(text, '\"');
}

function asLocator(selector: string, locatorFn = 'Locator') {
  const match = selector.match(/(.*)\s+>>\s+nth=(\d+)$/);
  if (!match)
    return `${locatorFn}(${quote(selector)})`;
  if (+match[2] === 0)
    return `${locatorFn}(${quote(match[1])}).First`;
  return `${locatorFn}(${quote(match[1])}).Nth(${match[2]})`;
}
