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

import * as sourceMap from './sourceMap';
import { getFromENV } from '../helper';
import { BrowserContextBase } from '../browserContext';
import { Frame } from '../frames';
import { Events } from '../events';
import { Page } from '../page';
import { parseSelector } from '../selectors';
import * as types from '../types';
import InjectedScript from '../injected/injectedScript';

let debugMode: boolean | undefined;
export function isDebugMode(): boolean {
  if (debugMode === undefined)
    debugMode = !!getFromENV('PLAYWRIGHT_DEBUG_UI');
  return debugMode;
}

let sourceUrlCounter = 0;
const playwrightSourceUrlPrefix = '__playwright_evaluation_script__';
const sourceUrlRegex = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/m;
export function generateSourceUrl(): string {
  return `\n//# sourceURL=${playwrightSourceUrlPrefix}${sourceUrlCounter++}\n`;
}

export function isPlaywrightSourceUrl(s: string): boolean {
  return s.startsWith(playwrightSourceUrlPrefix);
}

export function ensureSourceUrl(expression: string): string {
  return sourceUrlRegex.test(expression) ? expression : expression + generateSourceUrl();
}

export async function generateSourceMapUrl(functionText: string, generatedText: string): Promise<string> {
  if (!isDebugMode())
    return generateSourceUrl();
  const sourceMapUrl = await sourceMap.generateSourceMapUrl(functionText, generatedText);
  return sourceMapUrl || generateSourceUrl();
}

export async function installConsoleHelpers(context: BrowserContextBase) {
  if (!isDebugMode())
    return;
  const installInFrame = async (frame: Frame) => {
    try {
      const mainContext = await frame._mainContext();
      const injectedScript = await mainContext.injectedScript();
      await injectedScript.evaluate(installPlaywrightObjectOnWindow, parseSelector.toString());
    } catch (e) {
    }
  };
  context.on(Events.BrowserContext.Page, (page: Page) => {
    installInFrame(page.mainFrame());
    page.on(Events.Page.FrameNavigated, installInFrame);
  });
}

function installPlaywrightObjectOnWindow(injectedScript: InjectedScript, parseSelectorFunctionString: string) {
  const parseSelector: (selector: string) => types.ParsedSelector =
      new Function('...args', 'return (' + parseSelectorFunctionString + ')(...args)') as any;

  const highlightContainer = document.createElement('div');
  highlightContainer.style.cssText = 'position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; z-index: 10000;';

  function checkSelector(parsed: types.ParsedSelector) {
    for (const {name} of parsed.parts) {
      if (!injectedScript.engines.has(name))
        throw new Error(`Unknown engine "${name}"`);
    }
  }

  function highlightElements(elements: Element[] = [], target?: Element) {
    const scrollLeft = document.scrollingElement ? document.scrollingElement.scrollLeft : 0;
    const scrollTop = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
    highlightContainer.textContent = '';
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const highlight = document.createElement('div');
      highlight.style.position = 'absolute';
      highlight.style.left = (rect.left + scrollLeft) + 'px';
      highlight.style.top = (rect.top + scrollTop) + 'px';
      highlight.style.height = rect.height + 'px';
      highlight.style.width = rect.width + 'px';
      highlight.style.pointerEvents = 'none';
      if (element === target) {
        highlight.style.background = 'hsla(30, 97%, 37%, 0.3)';
        highlight.style.border = '3px solid hsla(30, 97%, 37%, 0.6)';
      } else {
        highlight.style.background = 'hsla(120, 100%, 37%, 0.3)';
        highlight.style.border = '3px solid hsla(120, 100%, 37%, 0.8)';
      }
      highlight.style.borderRadius = '3px';
      highlightContainer.appendChild(highlight);
    }
    document.body.appendChild(highlightContainer);
  }

  function $(selector: string): (Element | undefined) {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.query('Playwright >> selector').`);
    const parsed = parseSelector(selector);
    checkSelector(parsed);
    const elements = injectedScript.querySelectorAll(parsed, document);
    highlightElements(elements, elements[0]);
    return elements[0];
  }

  function $$(selector: string): Element[] {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.$$('Playwright >> selector').`);
    const parsed = parseSelector(selector);
    checkSelector(parsed);
    const elements = injectedScript.querySelectorAll(parsed, document);
    highlightElements(elements);
    return elements;
  }

  function inspect(selector: string) {
    if (typeof (window as any).inspect !== 'function')
      return;
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.inspect('Playwright >> selector').`);
    highlightElements();
    (window as any).inspect($(selector));
  }

  function clear() {
    highlightContainer.remove();
  }

  (window as any).playwright = { $, $$, inspect, clear };
}
