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

export class CSharpLanguageGenerator implements LanguageGenerator {
  id = 'csharp';
  fileName = '<csharp>';
  highlighter = 'csharp';

  generateAction(actionInContext: ActionInContext): string {
    const { action, pageAlias } = actionInContext;
    const formatter = new CSharpFormatter(0);
    formatter.newLine();
    formatter.add('// ' + actionTitle(action));

    if (action.name === 'openPage') {
      formatter.add(`var ${pageAlias} = await context.NewPageAsync();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`await ${pageAlias}.GotoAsync(${quote(action.url)});`);
      return formatter.format();
    }

    const subject = actionInContext.isMainFrame ? pageAlias :
      (actionInContext.frameName ?
        `${pageAlias}.GetFrame(name: ${quote(actionInContext.frameName)})` :
        `${pageAlias}.GetFrame(url: ${quote(actionInContext.frameUrl)})`);

    const signals = toSignalMap(action);

    if (signals.dialog) {
      formatter.add(`    void ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler(object sender, DialogEventArgs e)
      {
          Console.WriteLine($"Dialog message: {e.Dialog.Message}");
          e.Dialog.DismissAsync();
          ${pageAlias}.Dialog -= ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler;
      }
      ${pageAlias}.Dialog += ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler;`);
    }

    const emitTaskWhenAll = signals.waitForNavigation || signals.popup || signals.download;
    if (emitTaskWhenAll) {
      if (signals.popup)
        formatter.add(`var ${signals.popup.popupAlias}Task = ${pageAlias}.WaitForEventAsync(PageEvent.Popup)`);
      else if (signals.download)
        formatter.add(`var downloadTask = ${pageAlias}.WaitForEventAsync(PageEvent.Download);`);

      formatter.add(`await Task.WhenAll(`);
    }

    // Popup signals.
    if (signals.popup)
      formatter.add(`${signals.popup.popupAlias}Task,`);

    // Navigation signal.
    if (signals.waitForNavigation)
      formatter.add(`${pageAlias}.WaitForNavigationAsync(/*${quote(signals.waitForNavigation.url)}*/),`);

    // Download signals.
    if (signals.download)
      formatter.add(`downloadTask,`);

    const prefix = (signals.popup || signals.waitForNavigation || signals.download) ? '' : 'await ';
    const actionCall = this._generateActionCall(action);
    const suffix = emitTaskWhenAll ? ');' : ';';
    formatter.add(`${prefix}${subject}.${actionCall}${suffix}`);

    if (signals.assertNavigation)
      formatter.add(`  // Assert.Equal(${quote(signals.assertNavigation.url)}, ${pageAlias}.Url);`);
    return formatter.format();
  }

  private _generateActionCall(action: Action): string {
    switch (action.name) {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return 'CloseAsync()';
      case 'click': {
        let method = 'ClickAsync';
        if (action.clickCount === 2)
          method = 'DblClickAsync';
        const modifiers = toModifiers(action.modifiers);
        const options: MouseClickOptions = {};
        if (action.button !== 'left')
          options.button = action.button;
        if (modifiers.length)
          options.modifiers = modifiers;
        if (action.clickCount > 2)
          options.clickCount = action.clickCount;
        const optionsString = formatOptions(options, true, false);
        return `${method}(${quote(action.selector)}${optionsString})`;
      }
      case 'check':
        return `CheckAsync(${quote(action.selector)})`;
      case 'uncheck':
        return `UncheckAsync(${quote(action.selector)})`;
      case 'fill':
        return `FillAsync(${quote(action.selector)}, ${quote(action.text)})`;
      case 'setInputFiles':
        return `SetInputFilesAsync(${quote(action.selector)}, ${formatObject(action.files.length === 1 ? action.files[0] : action.files)})`;
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return `PressAsync(${quote(action.selector)}, ${quote(shortcut)})`;
      }
      case 'navigate':
        return `GotoAsync(${quote(action.url)})`;
      case 'select':
        return `SelectOptionAsync(${quote(action.selector)}, ${formatObject(action.options.length > 1 ? action.options : action.options[0])})`;
    }
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    const formatter = new CSharpFormatter(0);
    formatter.add(`
      await Playwright.InstallAsync();
      using var playwright = await Playwright.CreateAsync();
      await using var browser = await playwright.${toPascal(options.browserName)}.LaunchAsync(${formatArgs(options.launchOptions)}
      );
      var context = await browser.NewContextAsync(${formatContextOptions(options.contextOptions, options.deviceName)});`);
    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
    const storageStateLine = saveStorage ? `\nawait context.StorageStateAsync(path: "${saveStorage}");` : '';
    return `\n// ---------------------${storageStateLine}`;
  }
}

function formatValue(value: any): string {
  if (value === false)
    return 'false';
  if (value === true)
    return 'true';
  if (value === undefined)
    return 'null';
  if (Array.isArray(value))
    return `new [] {${value.map(formatValue).join(', ')}}`;
  if (typeof value === 'string')
    return quote(value);
  return String(value);
}

function formatOptions(value: any, hasArguments: boolean, isInitializing: boolean): string {
  const keys = Object.keys(value);
  if (!keys.length)
    return '';
  return (hasArguments ? ', ' : '') + keys.map(key => `${key}${isInitializing ? ': ' : ' = '}${formatValue(value[key])}`).join(', ');
}

function formatArgs(value: any, indent = '    '): string {
  if (typeof value === 'string')
    return quote(value);
  if (Array.isArray(value))
    return `new [] {${value.map(o => formatObject(o)).join(', ')}}`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length)
      return '';
    const tokens: string[] = [];
    for (const key of keys)
      tokens.push(`${keys.length !==  1 ? indent : ''}${key}: ${formatObject(value[key], indent, key)}`);
    return `\n${indent}${tokens.join(`,\n${indent}`)}`;
  }
  return String(value);
}

function formatObject(value: any, indent = '    ', name = ''): string {
  if (typeof value === 'string') {
    if (name === 'permissions' || name === 'colorScheme')
      return `${getClassName(name)}.${toPascal(value)}`;
    return quote(value);
  }
  if (Array.isArray(value))
    return `new[] { ${value.map(o => formatObject(o, indent, name)).join(', ')} }`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length)
      return '';
    const tokens: string[] = [];
    for (const key of keys)
      tokens.push(`${toPascal(key)} = ${formatObject(value[key], indent, key)},`);
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
    default: return toPascal(value);
  }
}

function toPascal(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}

function formatContextOptions(options: BrowserContextOptions, deviceName: string | undefined): string {
  const device = deviceName && deviceDescriptors[deviceName];
  if (!device)
    return formatArgs(options);
  const serializedObject = formatObject(sanitizeDeviceOptions(device, options), '    ');
  // When there are no additional context options, we still want to spread the device inside.

  if (!serializedObject)
    return `playwright.Devices["${deviceName}"]`;
  let result = `new BrowserContextOptions(playwright.Devices["${deviceName}"])`;

  if (serializedObject) {
    const lines = serializedObject.split('\n');
    result = `${result} \n${lines.join('\n')}`;
  }

  return result;
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
      if (line.endsWith('});'))
        spaces = spaces.substring(this._baseIndent.length);

      return this._baseOffset + line;
    }).join('\n');
  }
}

function quote(text: string) {
  return `"${text.replace(/["]/g, '\\"')}"`;
}