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
import type { Language, LanguageGenerator, LanguageGeneratorOptions } from './language';
import { toSignalMap } from './language';
import type { ActionInContext } from './codeGenerator';
import type { Action } from './recorderActions';
import type { MouseClickOptions } from './utils';
import { toModifiers } from './utils';
const deviceDescriptors = require('../deviceDescriptorsSource.json');
import { JavaScriptFormatter } from './javascript';
import { escapeWithQuotes } from '../../utils/isomorphic/stringUtils';
import { asLocator } from '../isomorphic/locatorGenerators';

export class JavaLanguageGenerator implements LanguageGenerator {
  id = 'java';
  groupName = 'Java';
  name = 'Library';
  highlighter = 'java' as Language;

  generateAction(actionInContext: ActionInContext): string {
    const action = actionInContext.action;
    const pageAlias = actionInContext.frame.pageAlias;
    const formatter = new JavaScriptFormatter(6);

    if (action.name === 'openPage') {
      formatter.add(`Page ${pageAlias} = context.newPage();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`${pageAlias}.navigate(${quote(action.url)});`);
      return formatter.format();
    }

    let subject: string;
    let inFrameLocator = false;
    if (actionInContext.frame.isMainFrame) {
      subject = pageAlias;
    } else if (actionInContext.frame.selectorsChain && action.name !== 'navigate') {
      const locators = actionInContext.frame.selectorsChain.map(selector => `.frameLocator(${quote(selector)})`);
      subject = `${pageAlias}${locators.join('')}`;
      inFrameLocator = true;
    } else if (actionInContext.frame.name) {
      subject = `${pageAlias}.frame(${quote(actionInContext.frame.name)})`;
    } else {
      subject = `${pageAlias}.frameByUrl(${quote(actionInContext.frame.url)})`;
    }

    const signals = toSignalMap(action);

    if (signals.dialog) {
      formatter.add(`  ${pageAlias}.onceDialog(dialog -> {
        System.out.println(String.format("Dialog message: %s", dialog.message()));
        dialog.dismiss();
      });`);
    }

    const actionCall = this._generateActionCall(action, inFrameLocator);
    let code = `${subject}.${actionCall};`;

    if (signals.popup) {
      code = `Page ${signals.popup.popupAlias} = ${pageAlias}.waitForPopup(() -> {
        ${code}
      });`;
    }

    if (signals.download) {
      code = `Download download${signals.download.downloadAlias} = ${pageAlias}.waitForDownload(() -> {
        ${code}
      });`;
    }

    formatter.add(code);

    return formatter.format();
  }

  private _generateActionCall(action: Action, inFrameLocator: boolean): string {
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
        const optionsText = formatClickOptions(options);
        return this._asLocator(action.selector, inFrameLocator) + `.${method}(${optionsText})`;
      }
      case 'check':
        return this._asLocator(action.selector, inFrameLocator) + `.check()`;
      case 'uncheck':
        return this._asLocator(action.selector, inFrameLocator) + `.uncheck()`;
      case 'fill':
        return this._asLocator(action.selector, inFrameLocator) + `.fill(${quote(action.text)})`;
      case 'setInputFiles':
        return this._asLocator(action.selector, inFrameLocator) + `.setInputFiles(${formatPath(action.files.length === 1 ? action.files[0] : action.files)})`;
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return this._asLocator(action.selector, inFrameLocator) + `.press(${quote(shortcut)})`;
      }
      case 'navigate':
        return `navigate(${quote(action.url)})`;
      case 'select':
        return this._asLocator(action.selector, inFrameLocator) + `.selectOption(${formatSelectOption(action.options.length > 1 ? action.options : action.options[0])})`;
    }
  }

  private _asLocator(selector: string, inFrameLocator: boolean) {
    return asLocator('java', selector, inFrameLocator);
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    const formatter = new JavaScriptFormatter();
    formatter.add(`
    import com.microsoft.playwright.*;
    import com.microsoft.playwright.options.*;
    import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
    import java.util.*;

    public class Example {
      public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
          Browser browser = playwright.${options.browserName}().launch(${formatLaunchOptions(options.launchOptions)});
          BrowserContext context = browser.newContext(${formatContextOptions(options.contextOptions, options.deviceName)});`);
    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
    const storageStateLine = saveStorage ? `\n      context.storageState(new BrowserContext.StorageStateOptions().setPath(${quote(saveStorage)}));\n` : '';
    return `${storageStateLine}    }
  }
}`;
  }
}

function formatPath(files: string | string[]): string {
  if (Array.isArray(files)) {
    if (files.length === 0)
      return 'new Path[0]';
    return `new Path[] {${files.map(s => 'Paths.get(' + quote(s) + ')').join(', ')}}`;
  }
  return `Paths.get(${quote(files)})`;
}

function formatSelectOption(options: string | string[]): string {
  if (Array.isArray(options)) {
    if (options.length === 0)
      return 'new String[0]';
    return `new String[] {${options.map(s => quote(s)).join(', ')}}`;
  }
  return quote(options);
}

function formatLaunchOptions(options: any): string {
  const lines = [];
  if (!Object.keys(options).filter(key => options[key] !== undefined).length)
    return '';
  lines.push('new BrowserType.LaunchOptions()');
  if (options.channel)
    lines.push(`  .setChannel(${quote(options.channel)})`);
  if (typeof options.headless === 'boolean')
    lines.push(`  .setHeadless(false)`);
  return lines.join('\n');
}

function formatContextOptions(contextOptions: BrowserContextOptions, deviceName: string | undefined): string {
  const lines = [];
  if (!Object.keys(contextOptions).length && !deviceName)
    return '';
  const device = deviceName ? deviceDescriptors[deviceName] : {};
  const options: BrowserContextOptions = { ...device, ...contextOptions };
  lines.push('new Browser.NewContextOptions()');
  if (options.acceptDownloads)
    lines.push(`  .setAcceptDownloads(true)`);
  if (options.bypassCSP)
    lines.push(`  .setBypassCSP(true)`);
  if (options.colorScheme)
    lines.push(`  .setColorScheme(ColorScheme.${options.colorScheme.toUpperCase()})`);
  if (options.deviceScaleFactor)
    lines.push(`  .setDeviceScaleFactor(${options.deviceScaleFactor})`);
  if (options.geolocation)
    lines.push(`  .setGeolocation(${options.geolocation.latitude}, ${options.geolocation.longitude})`);
  if (options.hasTouch)
    lines.push(`  .setHasTouch(${options.hasTouch})`);
  if (options.isMobile)
    lines.push(`  .setIsMobile(${options.isMobile})`);
  if (options.locale)
    lines.push(`  .setLocale(${quote(options.locale)})`);
  if (options.proxy)
    lines.push(`  .setProxy(new Proxy(${quote(options.proxy.server)}))`);
  if (options.recordHar?.content)
    lines.push(`  .setRecordHarContent(HarContentPolicy.${options.recordHar?.content.toUpperCase()})`);
  if (options.recordHar?.mode)
    lines.push(`  .setRecordHarMode(HarMode.${options.recordHar?.mode.toUpperCase()})`);
  if (options.recordHar?.omitContent)
    lines.push(`  .setRecordHarOmitContent(true)`);
  if (options.recordHar?.path)
    lines.push(`  .setRecordHarPath(Paths.get(${quote(options.recordHar.path)}))`);
  if (options.recordHar?.urlFilter)
    lines.push(`  .setRecordHarUrlFilter(${quote(options.recordHar.urlFilter as string)})`);
  if (options.serviceWorkers)
    lines.push(`  .setServiceWorkers(ServiceWorkerPolicy.${options.serviceWorkers.toUpperCase()})`);
  if (options.storageState)
    lines.push(`  .setStorageStatePath(Paths.get(${quote(options.storageState as string)}))`);
  if (options.timezoneId)
    lines.push(`  .setTimezoneId(${quote(options.timezoneId)})`);
  if (options.userAgent)
    lines.push(`  .setUserAgent(${quote(options.userAgent)})`);
  if (options.viewport)
    lines.push(`  .setViewportSize(${options.viewport.width}, ${options.viewport.height})`);
  return lines.join('\n');
}

function formatClickOptions(options: MouseClickOptions) {
  const lines = [];
  if (options.button)
    lines.push(`  .setButton(MouseButton.${options.button.toUpperCase()})`);
  if (options.modifiers)
    lines.push(`  .setModifiers(Arrays.asList(${options.modifiers.map(m => `KeyboardModifier.${m.toUpperCase()}`).join(', ')}))`);
  if (options.clickCount)
    lines.push(`  .setClickCount(${options.clickCount})`);
  if (options.position)
    lines.push(`  .setPosition(${options.position.x}, ${options.position.y})`);
  if (!lines.length)
    return '';
  lines.unshift(`new Locator.ClickOptions()`);
  return lines.join('\n');
}

function quote(text: string) {
  return escapeWithQuotes(text, '\"');
}
