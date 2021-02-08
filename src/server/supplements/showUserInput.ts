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
import type { Page } from '../page';
import type * as types from '../types';
import type * as js from '../javascript';
import type { BrowserContext } from '../browserContext';
import { ContextListener } from '../instrumentation';

export class ShowUserInput implements ContextListener {
  async onContextCreated(context: BrowserContext) {
    if (!context._browser.options.showUserInput)
      return;
    context._inputListeners.add(async (page, event) => {
      if (event.type === 'touchscreen.tap')
        return showTapIndicator(page, event.x, event.y);
      if (event.type === 'mouse.down' || event.type === 'mouse.move' || event.type === 'mouse.up')
        return showMouseIndicator(page, event.x, event.y, event.buttons);
      if (event.type === 'keyboard.insertText') {
        textForPage.set(page, event.text);
        return renderKeyboardIndicator(page, event.text);
      }
      if (event.type === 'keyboard.down')
        return updateKeyboardIndicator(page, event.key, event.code, event.modifiers);
      if (event.type === 'screenshot')
        return hideAllIndicators(page);
    });
  }
}

async function hideAllIndicators(page: Page) {
  await evaluateSafelyInTheUtilityContext(page, () => {
    for (const element of document.querySelectorAll('playwright-touch-indicator, playwright-mouse-indicator, playwright-keyboard-indicator'))
      element.remove();
  }, {});
}

async function showTapIndicator(page: Page, x: number, y: number) {
  await evaluateSafelyInTheUtilityContext(page, ([x, y]) => {
    const element = document.createElement('playwright-touch-indicator');
    const shadow = element.attachShadow({mode: 'closed'});
    shadow.innerHTML = `
      <style>
          svg {
              overflow: visible;
          }
          circle {
              fill: black;
              stroke: white;
              transition: fill .2s;
          }
      </style>
      <svg width="20" height="20">
          <circle r="10">
      </svg>`;
    element.style.position = 'fixed';
    element.style.pointerEvents = 'none';
    element.style.zIndex = String(Number.MAX_SAFE_INTEGER - 1);
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.animate([{
      opacity: 0.75,
    }, {
      opacity: 0,
    }], {
      duration: 500,
      direction: 'normal'
    }).onfinish = () => {
      element.remove();
    };
    document.documentElement.appendChild(element);
  }, [x, y] as const);
}

async function showMouseIndicator(page: Page, x: number, y: number, buttons: Set<types.MouseButton>) {
  const args = [x, y, !!buttons.size] as const;
  await (await page.mainFrame()._utilityContext()).evaluateInternal(([x, y, pressed]) => {
    const element: HTMLElement = document.querySelector(':scope > playwright-mouse-indicator') || createMouseIndicator();
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.classList.toggle('pressed', pressed);
    // eslint-disable-next-line no-unused-expressions
    window.getComputedStyle(element).fill;


    function createMouseIndicator() {
      const element = document.createElement('playwright-mouse-indicator');
      const shadow = element.attachShadow({mode: 'closed'});
      shadow.innerHTML = `
      <style>
        svg {
          filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.3));
          opacity: 0.5;
        }
        polygon {
          fill: white;
          stroke: black;
          transition: fill .2s;
        }
        :host(.pressed) polygon {
          transition: none;
          fill: black;
          transition: none;
        }
      </style>
      <svg width="40" height="40">
        <polygon points="0,0 0,34 8,28 14,38 20,35 14,26 24,24"/>
      </svg>`;
      element.style.position = 'fixed';
      element.style.pointerEvents = 'none';
      element.style.zIndex = String(Number.MAX_SAFE_INTEGER - 1);
      document.documentElement.appendChild(element);
      return element;
    }
  }, args);
}

const textForPage = new WeakMap<Page, string>();
async function updateKeyboardIndicator(page: Page, key: string, code: string, modifiers: Set<types.KeyboardModifier>) {
  let text;
  let dim = true;
  if (!key) {
    if (!textForPage.get(page))
      return;
    textForPage.delete(page);
    text = '';
  } else if (!modifiers.size && key.trim().length === 1) {
    const currentText = (textForPage.get(page) || '') + key;
    textForPage.set(page, currentText);
    text = currentText;
    dim = false;
  } else {
    text = code;
    textForPage.delete(page);
  }
  if (text) {
    // If ControlLeft is pressed, Control+ControlLeft would be redundant.
    const filteredModifiers = [...modifiers].filter(modifier => !code.includes(modifier));
    text = [...filteredModifiers, text].join(' + ');
  }
  await renderKeyboardIndicator(page, text, dim);
}

async function renderKeyboardIndicator(page: Page, text: string, dim = false) {
  await evaluateSafelyInTheUtilityContext(page, ({text, dim, slowMo}) => {
    const element: HTMLElement = document.querySelector(':scope > playwright-keyboard-indicator') || createKeyboardIndicator();
    (element as any).__setText(text, dim);

    function createKeyboardIndicator() {
      const element = document.createElement('playwright-keyboard-indicator');
      const shadow = element.attachShadow({mode: 'closed'});
      (element as any).__shadowForTest = shadow;
      shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: ${Number.MAX_SAFE_INTEGER - 1};
          pointer-events: none;
          margin: 10px;
          text-align: center;
          user-select: none;
        }
        div {
          color: white;
          font-family: sans-serif;
          font-size: 60px;
          background: rgba(0, 0, 0, 0.75);
          display: inline-block;
          border-radius: 10px;
          padding: 10px;
        }
        div.dim {
          color: #73C2FB;
        }
      </style>`;
      const div = document.createElement('div');
      let timeout: any = null;
      (element as any).__setText = (text: string, dim: boolean) => {
        if (text) {
          div.textContent = text;
          shadow.appendChild(div);
        }
        if (timeout)
          clearTimeout(timeout);

        timeout = setTimeout(() => {
          div.remove();
          timeout = null;
        }, (slowMo || 150) + 50);
        div.classList.toggle('dim', dim);
      };
      document.documentElement.appendChild(element);
      return element;
    }
  }, {text, dim, slowMo: page.context()._browser.options.slowMo});
}

async function evaluateSafelyInTheUtilityContext<Arg>(page: Page, pageFunction: js.Func1<Arg, void>, arg: Arg) {
  try {
    const utility = await page.mainFrame()._utilityContext();
    await utility.evaluateInternal(pageFunction, arg);
  } catch (err) {
    // Errors can happen here if the page navigates.
    // The indicator would be destroyed anyway, so it's
    // ok to do nothing.
  }
}
