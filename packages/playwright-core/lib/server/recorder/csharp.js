"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CSharpLanguageGenerator = void 0;
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

class CSharpLanguageGenerator {
  constructor(mode) {
    this.id = void 0;
    this.groupName = '.NET C#';
    this.name = void 0;
    this.highlighter = 'csharp';
    this._mode = void 0;
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
  generateAction(actionInContext) {
    const action = this._generateActionInner(actionInContext);
    if (action) return action;
    return '';
  }
  _generateActionInner(actionInContext) {
    const action = actionInContext.action;
    if (this._mode !== 'library' && (action.name === 'openPage' || action.name === 'closePage')) return '';
    let pageAlias = actionInContext.frame.pageAlias;
    if (this._mode !== 'library') pageAlias = pageAlias.replace('page', 'Page');
    const formatter = new CSharpFormatter(this._mode === 'library' ? 0 : 8);
    if (action.name === 'openPage') {
      formatter.add(`var ${pageAlias} = await context.NewPageAsync();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/') formatter.add(`await ${pageAlias}.GotoAsync(${quote(action.url)});`);
      return formatter.format();
    }
    let subject;
    if (actionInContext.frame.isMainFrame) {
      subject = pageAlias;
    } else {
      const locators = actionInContext.frame.selectorsChain.map(selector => `.FrameLocator(${quote(selector)})`);
      subject = `${pageAlias}${locators.join('')}`;
    }
    const signals = (0, _language.toSignalMap)(action);
    if (signals.dialog) {
      formatter.add(`    void ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler(object sender, IDialog dialog)
      {
          Console.WriteLine($"Dialog message: {dialog.Message}");
          dialog.DismissAsync();
          ${pageAlias}.Dialog -= ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler;
      }
      ${pageAlias}.Dialog += ${pageAlias}_Dialog${signals.dialog.dialogAlias}_EventHandler;`);
    }
    const lines = [];
    lines.push(this._generateActionCall(subject, action));
    if (signals.download) {
      lines.unshift(`var download${signals.download.downloadAlias} = await ${pageAlias}.RunAndWaitForDownloadAsync(async () =>\n{`);
      lines.push(`});`);
    }
    if (signals.popup) {
      lines.unshift(`var ${signals.popup.popupAlias} = await ${pageAlias}.RunAndWaitForPopupAsync(async () =>\n{`);
      lines.push(`});`);
    }
    for (const line of lines) formatter.add(line);
    return formatter.format();
  }
  _generateActionCall(subject, action) {
    switch (action.name) {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return `await ${subject}.CloseAsync();`;
      case 'click':
        {
          let method = 'Click';
          if (action.clickCount === 2) method = 'DblClick';
          const modifiers = (0, _utils.toModifiers)(action.modifiers);
          const options = {};
          if (action.button !== 'left') options.button = action.button;
          if (modifiers.length) options.modifiers = modifiers;
          if (action.clickCount > 2) options.clickCount = action.clickCount;
          if (action.position) options.position = action.position;
          if (!Object.entries(options).length) return `await ${subject}.${this._asLocator(action.selector)}.${method}Async();`;
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
      case 'press':
        {
          const modifiers = (0, _utils.toModifiers)(action.modifiers);
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
      case 'assertValue':
        {
          const assertion = action.value ? `ToHaveValueAsync(${quote(action.value)})` : `ToBeEmptyAsync()`;
          return `await Expect(${subject}.${this._asLocator(action.selector)}).${assertion};`;
        }
    }
  }
  _asLocator(selector) {
    return (0, _locatorGenerators.asLocator)('csharp', selector);
  }
  generateHeader(options) {
    if (this._mode === 'library') return this.generateStandaloneHeader(options);
    return this.generateTestRunnerHeader(options);
  }
  generateStandaloneHeader(options) {
    const formatter = new CSharpFormatter(0);
    formatter.add(`
      using Microsoft.Playwright;
      using System;
      using System.Threading.Tasks;

      using var playwright = await Playwright.CreateAsync();
      await using var browser = await playwright.${toPascal(options.browserName)}.LaunchAsync(${formatObject(options.launchOptions, '    ', 'BrowserTypeLaunchOptions')});
      var context = await browser.NewContextAsync(${formatContextOptions(options.contextOptions, options.deviceName)});`);
    formatter.newLine();
    return formatter.format();
  }
  generateTestRunnerHeader(options) {
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
    return formatter.format();
  }
  generateFooter(saveStorage) {
    const offset = this._mode === 'library' ? '' : '        ';
    let storageStateLine = saveStorage ? `\n${offset}await context.StorageStateAsync(new BrowserContextStorageStateOptions\n${offset}{\n${offset}    Path = ${quote(saveStorage)}\n${offset}});\n` : '';
    if (this._mode !== 'library') storageStateLine += `    }\n}\n`;
    return storageStateLine;
  }
}
exports.CSharpLanguageGenerator = CSharpLanguageGenerator;
function formatObject(value, indent = '    ', name = '') {
  if (typeof value === 'string') {
    if (['permissions', 'colorScheme', 'modifiers', 'button', 'recordHarContent', 'recordHarMode', 'serviceWorkers'].includes(name)) return `${getClassName(name)}.${toPascal(value)}`;
    return quote(value);
  }
  if (Array.isArray(value)) return `new[] { ${value.map(o => formatObject(o, indent, name)).join(', ')} }`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
    if (!keys.length) return name ? `new ${getClassName(name)}` : '';
    const tokens = [];
    for (const key of keys) {
      const property = getPropertyName(key);
      tokens.push(`${property} = ${formatObject(value[key], indent, key)},`);
    }
    if (name) return `new ${getClassName(name)}\n{\n${indent}${tokens.join(`\n${indent}`)}\n${indent}}`;
    return `{\n${indent}${tokens.join(`\n${indent}`)}\n${indent}}`;
  }
  if (name === 'latitude' || name === 'longitude') return String(value) + 'm';
  return String(value);
}
function getClassName(value) {
  switch (value) {
    case 'viewport':
      return 'ViewportSize';
    case 'proxy':
      return 'ProxySettings';
    case 'permissions':
      return 'ContextPermission';
    case 'modifiers':
      return 'KeyboardModifier';
    case 'button':
      return 'MouseButton';
    case 'recordHarMode':
      return 'HarMode';
    case 'recordHarContent':
      return 'HarContentPolicy';
    case 'serviceWorkers':
      return 'ServiceWorkerPolicy';
    default:
      return toPascal(value);
  }
}
function getPropertyName(key) {
  switch (key) {
    case 'storageState':
      return 'StorageStatePath';
    case 'viewport':
      return 'ViewportSize';
    default:
      return toPascal(key);
  }
}
function toPascal(value) {
  return value[0].toUpperCase() + value.slice(1);
}
function convertContextOptions(options) {
  const result = {
    ...options
  };
  if (options.recordHar) {
    result['recordHarPath'] = options.recordHar.path;
    result['recordHarContent'] = options.recordHar.content;
    result['recordHarMode'] = options.recordHar.mode;
    result['recordHarOmitContent'] = options.recordHar.omitContent;
    result['recordHarUrlFilter'] = options.recordHar.urlFilter;
    delete result.recordHar;
  }
  return result;
}
function formatContextOptions(options, deviceName) {
  const device = deviceName && _deviceDescriptors.deviceDescriptors[deviceName];
  if (!device) {
    if (!Object.entries(options).length) return '';
    return formatObject(convertContextOptions(options), '    ', 'BrowserNewContextOptions');
  }
  options = (0, _language.sanitizeDeviceOptions)(device, options);
  if (!Object.entries(options).length) return `playwright.Devices[${quote(deviceName)}]`;
  return formatObject(convertContextOptions(options), '    ', `BrowserNewContextOptions(playwright.Devices[${quote(deviceName)}])`);
}
class CSharpFormatter {
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
    let previousLine = '';
    return this._lines.map(line => {
      if (line === '') return line;
      if (line.startsWith('}') || line.startsWith(']') || line.includes('});') || line === ');') spaces = spaces.substring(this._baseIndent.length);
      const extraSpaces = /^(for|while|if).*\(.*\)$/.test(previousLine) ? this._baseIndent : '';
      previousLine = line;
      line = spaces + extraSpaces + line;
      if (line.endsWith('{') || line.endsWith('[') || line.endsWith('(')) spaces += this._baseIndent;
      if (line.endsWith('));')) spaces = spaces.substring(this._baseIndent.length);
      return this._baseOffset + line;
    }).join('\n');
  }
}
function quote(text) {
  return (0, _stringUtils.escapeWithQuotes)(text, '\"');
}