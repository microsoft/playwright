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

export class JavaScriptLanguageGenerator implements LanguageGenerator {
  id: string;
  groupName = 'Node.js';
  name: string;
  highlighter = 'javascript' as Language;
  private _isTest: boolean;

  constructor(isTest: boolean) {
    this.id = isTest ? 'playwright-test' : 'javascript';
    this.name = isTest ? 'Test Runner' : 'Library';
    this._isTest = isTest;
  }

  generateAction(actionInContext: actions.ActionInContext): string {
    const action = actionInContext.action;
    if (this._isTest && (action.name === 'openPage' || action.name === 'closePage'))
      return '';

    const pageAlias = actionInContext.frame.pageAlias;
    const formatter = new JavaScriptFormatter(2);

    if (action.name === 'openPage') {
      formatter.add(`const ${pageAlias} = await context.newPage();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`await ${pageAlias}.goto(${quote(action.url)});`);
      return formatter.format();
    }

    const locators = actionInContext.frame.framePath.map(selector => `.${this._asLocator(selector)}.contentFrame()`);
    const subject = `${pageAlias}${locators.join('')}`;
    const signals = toSignalMap(action);

    if (signals.dialog) {
      formatter.add(`  ${pageAlias}.once('dialog', dialog => {
    console.log(\`Dialog message: $\{dialog.message()}\`);
    dialog.dismiss().catch(() => {});
  });`);
    }

    if (signals.popup)
      formatter.add(`const ${signals.popup.popupAlias}Promise = ${pageAlias}.waitForEvent('popup');`);
    if (signals.download)
      formatter.add(`const download${signals.download.downloadAlias}Promise = ${pageAlias}.waitForEvent('download');`);

    formatter.add(wrapWithStep(actionInContext.description, this._generateActionCall(subject, actionInContext)));

    if (signals.popup)
      formatter.add(`const ${signals.popup.popupAlias} = await ${signals.popup.popupAlias}Promise;`);
    if (signals.download)
      formatter.add(`const download${signals.download.downloadAlias} = await download${signals.download.downloadAlias}Promise;`);

    return formatter.format();
  }

  private _generateActionCall(subject: string, actionInContext: actions.ActionInContext): string {
    const action = actionInContext.action;
    switch (action.name) {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return `await ${subject}.close();`;
      case 'click': {
        let method = 'click';
        if (action.clickCount === 2)
          method = 'dblclick';
        const options = toClickOptionsForSourceCode(action);
        const optionsString = formatOptions(options, false);
        return `await ${subject}.${this._asLocator(action.selector)}.${method}(${optionsString});`;
      }
      case 'check':
        return `await ${subject}.${this._asLocator(action.selector)}.check();`;
      case 'uncheck':
        return `await ${subject}.${this._asLocator(action.selector)}.uncheck();`;
      case 'fill':
        return `await ${subject}.${this._asLocator(action.selector)}.fill(${quote(action.text)});`;
      case 'setInputFiles':
        return `await ${subject}.${this._asLocator(action.selector)}.setInputFiles(${formatObject(action.files.length === 1 ? action.files[0] : action.files)});`;
      case 'press': {
        const modifiers = toKeyboardModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return `await ${subject}.${this._asLocator(action.selector)}.press(${quote(shortcut)});`;
      }
      case 'navigate':
        return `await ${subject}.goto(${quote(action.url)});`;
      case 'select':
        return `await ${subject}.${this._asLocator(action.selector)}.selectOption(${formatObject(action.options.length === 1 ? action.options[0] : action.options)});`;
      case 'assertText':
        return `${this._isTest ? '' : '// '}await expect(${subject}.${this._asLocator(action.selector)}).${action.substring ? 'toContainText' : 'toHaveText'}(${quote(action.text)});`;
      case 'assertChecked':
        return `${this._isTest ? '' : '// '}await expect(${subject}.${this._asLocator(action.selector)})${action.checked ? '' : '.not'}.toBeChecked();`;
      case 'assertVisible':
        return `${this._isTest ? '' : '// '}await expect(${subject}.${this._asLocator(action.selector)}).toBeVisible();`;
      case 'assertValue': {
        const assertion = action.value ? `toHaveValue(${quote(action.value)})` : `toBeEmpty()`;
        return `${this._isTest ? '' : '// '}await expect(${subject}.${this._asLocator(action.selector)}).${assertion};`;
      }
      case 'assertSnapshot': {
        const commentIfNeeded = this._isTest ? '' : '// ';
        return `${commentIfNeeded}await expect(${subject}.${this._asLocator(action.selector)}).toMatchAriaSnapshot(${quoteMultiline(action.ariaSnapshot, `${commentIfNeeded}  `)});`;
      }
    }
  }

  private _asLocator(selector: string) {
    return asLocator('javascript', selector);
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    if (this._isTest)
      return this.generateTestHeader(options);
    return this.generateStandaloneHeader(options);
  }

  generateFooter(saveStorage: string | undefined): string {
    if (this._isTest)
      return this.generateTestFooter(saveStorage);
    return this.generateStandaloneFooter(saveStorage);
  }

  generateTestHeader(options: LanguageGeneratorOptions): string {
    const formatter = new JavaScriptFormatter();
    const useText = formatContextOptions(options.contextOptions, options.deviceName, this._isTest);
    formatter.add(`
      import { test, expect${options.deviceName ? ', devices' : ''} } from '@playwright/test';
${useText ? '\ntest.use(' + useText + ');\n' : ''}
      test('test', async ({ page }) => {`);
    if (options.contextOptions.recordHar) {
      const url = options.contextOptions.recordHar.urlFilter;
      formatter.add(`  await page.routeFromHAR(${quote(options.contextOptions.recordHar.path)}${url ? `, ${formatOptions({ url }, false)}` : ''});`);
    }
    return formatter.format();
  }

  generateTestFooter(saveStorage: string | undefined): string {
    return `});`;
  }

  generateStandaloneHeader(options: LanguageGeneratorOptions): string {
    const formatter = new JavaScriptFormatter();
    formatter.add(`
      const { ${options.browserName}${options.deviceName ? ', devices' : ''} } = require('playwright');

      (async () => {
        const browser = await ${options.browserName}.launch(${formatObjectOrVoid(options.launchOptions)});
        const context = await browser.newContext(${formatContextOptions(options.contextOptions, options.deviceName, false)});`);
    if (options.contextOptions.recordHar)
      formatter.add(`        await context.routeFromHAR(${quote(options.contextOptions.recordHar.path)});`);
    return formatter.format();
  }

  generateStandaloneFooter(saveStorage: string | undefined): string {
    const storageStateLine = saveStorage ? `\n  await context.storageState({ path: ${quote(saveStorage)} });` : '';
    return `\n  // ---------------------${storageStateLine}
  await context.close();
  await browser.close();
})();`;
  }
}

function formatOptions(value: any, hasArguments: boolean): string {
  const keys = Object.keys(value);
  if (!keys.length)
    return '';
  return (hasArguments ? ', ' : '') + formatObject(value);
}

function formatObject(value: any, indent = '  '): string {
  if (typeof value === 'string')
    return quote(value);
  if (Array.isArray(value))
    return `[${value.map(o => formatObject(o)).join(', ')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
    if (!keys.length)
      return '{}';
    const tokens: string[] = [];
    for (const key of keys)
      tokens.push(`${key}: ${formatObject(value[key])}`);
    return `{\n${indent}${tokens.join(`,\n${indent}`)}\n}`;
  }
  return String(value);
}

function formatObjectOrVoid(value: any, indent = '  '): string {
  const result = formatObject(value, indent);
  return result === '{}' ? '' : result;
}

function formatContextOptions(options: BrowserContextOptions, deviceName: string | undefined, isTest: boolean): string {
  const device = deviceName && deviceDescriptors[deviceName];
  // recordHAR is replaced with routeFromHAR in the generated code.
  options = { ...options, recordHar: undefined };
  if (!device)
    return formatObjectOrVoid(options);
  // Filter out all the properties from the device descriptor.
  let serializedObject = formatObjectOrVoid(sanitizeDeviceOptions(device, options));
  // When there are no additional context options, we still want to spread the device inside.
  if (!serializedObject)
    serializedObject = '{\n}';
  const lines = serializedObject.split('\n');
  lines.splice(1, 0, `...devices[${quote(deviceName!)}],`);
  return lines.join('\n');
}

export class JavaScriptFormatter {
  private _baseIndent: string;
  private _baseOffset: string;
  private _lines: string[] = [];

  constructor(offset = 0) {
    this._baseIndent = ' '.repeat(2);
    this._baseOffset = ' '.repeat(offset);
  }

  prepend(text: string) {
    const trim = isMultilineString(text) ? (line: string) => line : (line: string) => line.trim();
    this._lines = text.trim().split('\n').map(trim).concat(this._lines);
  }

  add(text: string) {
    const trim = isMultilineString(text) ? (line: string) => line : (line: string) => line.trim();
    this._lines.push(...text.trim().split('\n').map(trim));
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
      if (line.startsWith('}') || line.startsWith(']'))
        spaces = spaces.substring(this._baseIndent.length);

      const extraSpaces = /^(for|while|if|try).*\(.*\)$/.test(previousLine) ? this._baseIndent : '';
      previousLine = line;

      const callCarryOver = line.startsWith('.set');
      line = spaces + extraSpaces + (callCarryOver ? this._baseIndent : '') + line;
      if (line.endsWith('{') || line.endsWith('['))
        spaces += this._baseIndent;
      return this._baseOffset + line;
    }).join('\n');
  }
}

function quote(text: string) {
  return escapeWithQuotes(text, '\'');
}

function wrapWithStep(description: string | undefined, body: string) {
  return description ? `await test.step(\`${description}\`, async () => {
${body}
});` : body;
}

export function quoteMultiline(text: string, indent = '  ') {
  const escape = (text: string) => text.replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');
  const lines = text.split('\n');
  if (lines.length === 1)
    return '`' + escape(text) + '`';
  return '`\n' + lines.map(line => indent + escape(line).replace(/\${/g, '\\${')).join('\n') + `\n${indent}\``;
}

function isMultilineString(text: string) {
  return text.match(/`[\S\s]*`/)?.[0].includes('\n');
}
