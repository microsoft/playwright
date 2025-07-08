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

import { sanitizeDeviceOptions, toClickOptionsForSourceCode, toKeyboardModifiers, toSignalMap } from './language';
import { asLocator, escapeWithQuotes } from '../../utils';
import { deviceDescriptors } from '../deviceDescriptors';

import type { Language, LanguageGenerator, LanguageGeneratorOptions } from './types';
import type { BrowserContextOptions } from '../../../types/types';
import type * as actions from '@recorder/actions';

type CSharpLanguageMode = 'library' | 'mstest' | 'nunit';

export class CSharpLanguageGenerator implements LanguageGenerator {
  id: string;
  groupName = '.NET C#';
  name: string;
  highlighter = 'csharp' as Language;
  _mode: CSharpLanguageMode;

  constructor(mode: CSharpLanguageMode) {
    if (mode === 'library') {
      this.name = 'Library';
      this.id = 'csharp';
    } else if (mode === 'mstest') {
      this.name = 'MSTest';
      this.id = 'csharp-mstest';
    } else if (mode === 'nunit') {
      this.name = 'NUnit';
      this.id = 'csharp-nunit';
    } else {
      throw new Error(`Unknown C# language mode: ${mode}`);
    }
    this._mode = mode;
  }

  generateAction(actionInContext: actions.ActionInContext): string {
    const action = this._generateActionInner(actionInContext);
    if (action)
      return action;
    return '';
  }

  _generateActionInner(actionInContext: actions.ActionInContext): string {
    const action = actionInContext.action;
    if (this._mode !== 'library' && (action.name === 'openPage' || action.name === 'closePage'))
      return '';
    const  pageAlias = this._formatPageAlias(actionInContext.frame.pageAlias);
    const formatter = new CSharpFormatter(this._mode === 'library' ? 0 : 8);

    if (action.name === 'openPage') {
      formatter.add(`var ${pageAlias} = await context.NewPageAsync();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`await ${pageAlias}.GotoAsync(${quote(action.url)});`);
      return formatter.format();
    }

    const locators = actionInContext.frame.framePath.map(selector => `.${this._asLocator(selector)}.ContentFrame`);
    const subject = `${pageAlias}${locators.join('')}`;
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
    lines.push(this._generateActionCall(subject, actionInContext));

    if (signals.download) {
      lines.unshift(`var download${signals.download.downloadAlias} = await ${pageAlias}.RunAndWaitForDownloadAsync(async () =>\n{`);
      lines.push(`});`);
    }

    if (signals.popup) {
      lines.unshift(`var ${this._formatPageAlias(signals.popup.popupAlias)} = await ${pageAlias}.RunAndWaitForPopupAsync(async () =>\n{`);
      lines.push(`});`);
    }

    for (const line of lines)
      formatter.add(line);

    return formatter.format();
  }

  private _formatPageAlias(pageAlias: string): string {
    if (this._mode === 'library')
      return pageAlias;

    if (pageAlias === 'page')
      return 'Page'; // first page is class member

    // other pages are local variables
    return pageAlias;
  }

  private _generateActionCall(subject: string, actionInContext: actions.ActionInContext): string {
    const action = actionInContext.action;
    switch (action.name) {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return `await ${subject}.CloseAsync();`;
      case 'click': {
        let method = 'Click';
        if (action.clickCount === 2)
          method = 'DblClick';
        const options = toClickOptionsForSourceCode(action);
        if (!Object.entries(options).length)
          return `await ${subject}.${this._asLocator(action.selector)}.${method}Async();`;
        const optionsString = formatObject(options, '    ', 'Locator' + method + 'Options');
        return `await ${subject}.${this._asLocator(action.selector)}.${method}Async(${optionsString});`;
      }
      case 'check':
        return `await ${subject}.${this._asLocator(action.selector)}.CheckAsync();`;
      case 'uncheck':
        return `await ${subject}.${this._asLocator(action.selector)}.UncheckAsync();`;
      case 'fill':
        return `await ${subject}.${this._asLocator(action.selector)}.FillAsync(${quote(action.text)});`;
      case 'setInputFiles':
        return `await ${subject}.${this._asLocator(action.selector)}.SetInputFilesAsync(${formatObject(action.files)});`;
      case 'press': {
        const modifiers = toKeyboardModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return `await ${subject}.${this._asLocator(action.selector)}.PressAsync(${quote(shortcut)});`;
      }
      case 'navigate':
        return `await ${subject}.GotoAsync(${quote(action.url)});`;
      case 'select':
        return `await ${subject}.${this._asLocator(action.selector)}.SelectOptionAsync(${formatObject(action.options)});`;
      case 'assertText':
        return `await Expect(${subject}.${this._asLocator(action.selector)}).${action.substring ? 'ToContainTextAsync' : 'ToHaveTextAsync'}(${quote(action.text)});`;
      case 'assertChecked':
        return `await Expect(${subject}.${this._asLocator(action.selector)})${action.checked ? '' : '.Not'}.ToBeCheckedAsync();`;
      case 'assertVisible':
        return `await Expect(${subject}.${this._asLocator(action.selector)}).ToBeVisibleAsync();`;
      case 'assertValue': {
        const assertion = action.value ? `ToHaveValueAsync(${quote(action.value)})` : `ToBeEmptyAsync()`;
        return `await Expect(${subject}.${this._asLocator(action.selector)}).${assertion};`;
      }
      case 'assertSnapshot':
        return `await Expect(${subject}.${this._asLocator(action.selector)}).ToMatchAriaSnapshotAsync(${quote(action.ariaSnapshot)});`;
    }
  }

  private _asLocator(selector: string) {
    return asLocator('csharp', selector);
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    if (this._mode === 'library')
      return this.generateStandaloneHeader(options);
    return this.generateTestRunnerHeader(options);
  }

  generateStandaloneHeader(options: LanguageGeneratorOptions): string {
    const formatter = new CSharpFormatter(0);
    formatter.add(`
      using Microsoft.Playwright;
      using System;
      using System.Threading.Tasks;

      using var playwright = await Playwright.CreateAsync();
      await using var browser = await playwright.${toPascal(options.browserName)}.LaunchAsync(${formatObject(options.launchOptions, '    ', 'BrowserTypeLaunchOptions')});
      var context = await browser.NewContextAsync(${formatContextOptions(options.contextOptions, options.deviceName)});`);
    if (options.contextOptions.recordHar) {
      const url = options.contextOptions.recordHar.urlFilter;
      formatter.add(`      await context.RouteFromHARAsync(${quote(options.contextOptions.recordHar.path)}${url ? `, ${formatObject({ url }, '    ', 'BrowserContextRouteFromHAROptions')}` : ''});`);
    }
    formatter.newLine();
    return formatter.format();
  }

  generateTestRunnerHeader(options: LanguageGeneratorOptions): string {
    const formatter = new CSharpFormatter(0);
    formatter.add(`
      using Microsoft.Playwright.${this._mode === 'nunit' ? 'NUnit' : 'MSTest'};
      using Microsoft.Playwright;

      ${this._mode === 'nunit' ? `[Parallelizable(ParallelScope.Self)]
      [TestFixture]` : '[TestClass]'}
      public class Tests : PageTest
      {`);
    const formattedContextOptions = formatContextOptions(options.contextOptions, options.deviceName);
    if (formattedContextOptions) {
      formatter.add(`public override BrowserNewContextOptions ContextOptions()
      {
          return ${formattedContextOptions};
      }`);
      formatter.newLine();
    }
    formatter.add(`    [${this._mode === 'nunit' ? 'Test' : 'TestMethod'}]
    public async Task MyTest()
    {`);
    if (options.contextOptions.recordHar) {
      const url = options.contextOptions.recordHar.urlFilter;
      formatter.add(`    await Context.RouteFromHARAsync(${quote(options.contextOptions.recordHar.path)}${url ? `, ${formatObject({ url }, '    ', 'BrowserContextRouteFromHAROptions')}` : ''});`);
    }
    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
    const offset = this._mode === 'library' ? '' : '        ';
    let storageStateLine = saveStorage ? `\n${offset}await context.StorageStateAsync(new BrowserContextStorageStateOptions\n${offset}{\n${offset}    Path = ${quote(saveStorage)}\n${offset}});\n` : '';
    if (this._mode !== 'library')
      storageStateLine += `    }\n}\n`;
    return storageStateLine;
  }
}

function formatObject(value: any, indent = '    ', name = ''): string {
  if (typeof value === 'string') {
    if (['permissions', 'colorScheme', 'modifiers', 'button', 'recordHarContent', 'recordHarMode', 'serviceWorkers'].includes(name))
      return `${getClassName(name)}.${toPascal(value)}`;
    return quote(value);
  }
  if (Array.isArray(value))
    return `new[] { ${value.map(o => formatObject(o, indent, name)).join(', ')} }`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
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
    case 'recordHarMode': return 'HarMode';
    case 'recordHarContent': return 'HarContentPolicy';
    case 'serviceWorkers': return 'ServiceWorkerPolicy';
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

function formatContextOptions(contextOptions: BrowserContextOptions, deviceName: string | undefined): string {
  let options = { ...contextOptions };
  // recordHAR is replaced with routeFromHAR in the generated code.
  delete options.recordHar;
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
