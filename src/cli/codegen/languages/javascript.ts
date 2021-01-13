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

import type { BrowserContextOptions, LaunchOptions } from '../../../..';
import * as playwright from '../../../..';
import { HighlighterType, LanguageGenerator } from '.';
import { ActionInContext } from '../codeGenerator';
import { actionTitle, NavigationSignal, PopupSignal, DownloadSignal, DialogSignal, Action } from '../recorderActions';
import { MouseClickOptions, toModifiers } from '../utils';

export class JavaScriptLanguageGenerator implements LanguageGenerator {

  highlighterType(): HighlighterType {
    return 'javascript';
  }

  generateAction(actionInContext: ActionInContext, performingAction: boolean): string {
    const { action, pageAlias, frame } = actionInContext;
    const formatter = new JavaScriptFormatter(2);
    formatter.newLine();
    formatter.add('// ' + actionTitle(action));

    if (action.name === 'openPage') {
      formatter.add(`const ${pageAlias} = await context.newPage();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`${pageAlias}.goto('${action.url}');`);
      return formatter.format();
    }

    const subject = !frame.parentFrame() ? pageAlias :
      `${pageAlias}.frame(${formatObject({ url: frame.url() })})`;

    let navigationSignal: NavigationSignal | undefined;
    let popupSignal: PopupSignal | undefined;
    let downloadSignal: DownloadSignal | undefined;
    let dialogSignal: DialogSignal | undefined;
    for (const signal of action.signals) {
      if (signal.name === 'navigation')
        navigationSignal = signal;
      else if (signal.name === 'popup')
        popupSignal = signal;
      else if (signal.name === 'download')
        downloadSignal = signal;
      else if (signal.name === 'dialog')
        dialogSignal = signal;
    }

    if (dialogSignal) {
      formatter.add(`  ${pageAlias}.once('dialog', dialog => {
    console.log(\`Dialog message: $\{dialog.message()}\`);
    dialog.dismiss().catch(() => {});
  });`);
    }

    const waitForNavigation = navigationSignal && !performingAction;
    const assertNavigation = navigationSignal && performingAction;

    const emitPromiseAll = waitForNavigation || popupSignal || downloadSignal;
    if (emitPromiseAll) {
      // Generate either await Promise.all([]) or
      // const [popup1] = await Promise.all([]).
      let leftHandSide = '';
      if (popupSignal)
        leftHandSide = `const [${popupSignal.popupAlias}] = `;
      else if (downloadSignal)
        leftHandSide = `const [download] = `;
      formatter.add(`${leftHandSide}await Promise.all([`);
    }

    // Popup signals.
    if (popupSignal)
      formatter.add(`${pageAlias}.waitForEvent('popup'),`);

    // Navigation signal.
    if (waitForNavigation)
      formatter.add(`${pageAlias}.waitForNavigation(/*{ url: ${quote(navigationSignal!.url)} }*/),`);

    // Download signals.
    if (downloadSignal)
      formatter.add(`${pageAlias}.waitForEvent('download'),`);

    const prefix = (popupSignal || waitForNavigation || downloadSignal) ? '' : 'await ';
    const actionCall = this._generateActionCall(action);
    const suffix = (waitForNavigation || emitPromiseAll) ? '' : ';';
    formatter.add(`${prefix}${subject}.${actionCall}${suffix}`);

    if (emitPromiseAll)
      formatter.add(`]);`);
    else if (assertNavigation)
      formatter.add(`  // assert.equal(${pageAlias}.url(), ${quote(navigationSignal!.url)});`);
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
        const optionsString = formatOptions(options);
        return `${method}(${quote(action.selector)}${optionsString})`;
      }
      case 'check':
        return `check(${quote(action.selector)})`;
      case 'uncheck':
        return `uncheck(${quote(action.selector)})`;
      case 'fill':
        return `fill(${quote(action.selector)}, ${quote(action.text)})`;
      case 'setInputFiles':
        return `setInputFiles(${quote(action.selector)}, ${formatObject(action.files.length === 1 ? action.files[0] : action.files)})`;
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return `press(${quote(action.selector)}, ${quote(shortcut)})`;
      }
      case 'navigate':
        return `goto(${quote(action.url)})`;
      case 'select':
        return `selectOption(${quote(action.selector)}, ${formatObject(action.options.length > 1 ? action.options : action.options[0])})`;
    }
  }

  generateHeader(browserName: string, launchOptions: LaunchOptions, contextOptions: BrowserContextOptions, deviceName?: string): string {
    const formatter = new JavaScriptFormatter();
    formatter.add(`
      const { ${browserName}${deviceName ? ', devices' : ''} } = require('playwright');

      (async () => {
        const browser = await ${browserName}.launch(${formatObjectOrVoid(launchOptions)});
        const context = await browser.newContext(${formatContextOptions(contextOptions, deviceName)});`);
    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
    const storageStateLine = saveStorage ? `\n  await context.storageState({ path: '${saveStorage}' });` : '';
    return `  // ---------------------${storageStateLine}
  await context.close();
  await browser.close();
})();`;
  }
}

function formatOptions(value: any): string {
  const keys = Object.keys(value);
  if (!keys.length)
    return '';
  return ', ' + formatObject(value);
}

function formatObject(value: any, indent = '  '): string {
  if (typeof value === 'string')
    return quote(value);
  if (Array.isArray(value))
    return `[${value.map(o => formatObject(o)).join(', ')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
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

function formatContextOptions(options: BrowserContextOptions, deviceName: string | undefined): string {
  const device = deviceName && playwright.devices[deviceName];
  if (!device)
    return formatObjectOrVoid(options);
  // Filter out all the properties from the device descriptor.
  const cleanedOptions: Record<string, any> = {};
  for (const property in options) {
    if ((device as any)[property] !== (options as any)[property])
      cleanedOptions[property] = (options as any)[property];
  }
  let serializedObject = formatObjectOrVoid(cleanedOptions);
  // When there are no additional context options, we still want to spread the device inside.
  if (!serializedObject)
    serializedObject = '{\n}';
  const lines = serializedObject.split('\n');
  lines.splice(1, 0, `...devices['${deviceName}'],`);
  return lines.join('\n');
}

class JavaScriptFormatter {
  private _baseIndent: string;
  private _baseOffset: string;
  private _lines: string[] = [];

  constructor(offset = 0) {
    this._baseIndent = ' '.repeat(2);
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
      if (line.startsWith('}') || line.startsWith(']'))
        spaces = spaces.substring(this._baseIndent.length);

      const extraSpaces = /^(for|while|if).*\(.*\)$/.test(previousLine) ? this._baseIndent : '';
      previousLine = line;

      line = spaces + extraSpaces + line;
      if (line.endsWith('{') || line.endsWith('['))
        spaces += this._baseIndent;
      return this._baseOffset + line;
    }).join('\n');
  }
}

function quote(text: string, char: string = '\'') {
  if (char === '\'')
    return char + text.replace(/[']/g, '\\\'') + char;
  if (char === '"')
    return char + text.replace(/["]/g, '\\"') + char;
  if (char === '`')
    return char + text.replace(/[`]/g, '\\`') + char;
  throw new Error('Invalid escape char');
}
