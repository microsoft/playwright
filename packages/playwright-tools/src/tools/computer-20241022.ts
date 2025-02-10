/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { waitForNetwork } from './utils';

import type { ToolResult } from '../../computer-20241022';
import type { JSONSchemaType } from '../../types';
import type playwright from 'playwright';


export async function call(page: playwright.Page, toolName: string, input: Record<string, JSONSchemaType>): Promise<ToolResult> {
  if (toolName !== 'computer')
    throw new Error('Unsupported tool');
  return await waitForNetwork(page, async () => {
    return await performAction(page, toolName, input);
  });
}

type PageState = {
  x: number;
  y: number;
};

const pageStateSymbol = Symbol('pageState');

function pageState(page: playwright.Page): PageState {
  if (!(page as any)[pageStateSymbol])
    (page as any)[pageStateSymbol] = { x: 0, y: 0 };
  return (page as any)[pageStateSymbol];
}

async function performAction(page: playwright.Page, toolName: string, input: Record<string, JSONSchemaType>): Promise<ToolResult> {
  const state = pageState(page);
  const { action } = input as { action: string };
  if (action === 'screenshot') {
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 50, scale: 'css' });
    return {
      output: 'Screenshot',
      base64_image: screenshot.toString('base64'),
    };
  }
  if (action === 'mouse_move') {
    const { coordinate } = input as { coordinate: [number, number] };
    state.x = coordinate[0];
    state.y = coordinate[1];
    await page.mouse.move(state.x, state.y);
    return { output: 'Mouse moved' };
  }
  if (action === 'left_click') {
    await page.mouse.down();
    await page.mouse.up();
    return { output: 'Left clicked' };
  }
  if (action === 'left_click_drag') {
    await page.mouse.down();
    const { coordinate } = input as { coordinate: [number, number] };
    state.x = coordinate[0];
    state.y = coordinate[1];
    await page.mouse.move(state.x, state.y);
    await page.mouse.up();
    return { output: 'Left dragged' };
  }
  if (action === 'right_click') {
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    return { output: 'Right clicked' };
  }
  if (action === 'double_click') {
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.down();
    await page.mouse.up();
    return { output: 'Double clicked' };
  }
  if (action === 'middle_click') {
    await page.mouse.down({ button: 'middle' });
    await page.mouse.up({ button: 'middle' });
    return { output: 'Middle clicked' };
  }
  if (action === 'key') {
    const { text } = input as { text: string };
    await page.keyboard.press(xToPlaywright(text));
    return { output: 'Text typed' };
  }
  if (action === 'cursor_position')
    return { output: `X=${state.x},Y=${state.y}` };
  throw new Error('Unimplemented tool: ' + toolName);
}

const xToPlaywrightKeyMap = new Map([
  ['BackSpace', 'Backspace'],
  ['Tab', 'Tab'],
  ['Return', 'Enter'],
  ['Escape', 'Escape'],
  ['space', ' '],
  ['Delete', 'Delete'],
  ['Home', 'Home'],
  ['End', 'End'],
  ['Left', 'ArrowLeft'],
  ['Up', 'ArrowUp'],
  ['Right', 'ArrowRight'],
  ['Down', 'ArrowDown'],
  ['Insert', 'Insert'],
  ['Page_Up', 'PageUp'],
  ['Page_Down', 'PageDown'],
  ['F1', 'F1'],
  ['F2', 'F2'],
  ['F3', 'F3'],
  ['F4', 'F4'],
  ['F5', 'F5'],
  ['F6', 'F6'],
  ['F7', 'F7'],
  ['F8', 'F8'],
  ['F9', 'F9'],
  ['F10', 'F10'],
  ['F11', 'F11'],
  ['F12', 'F12'],
  ['Shift_L', 'Shift'],
  ['Shift_R', 'Shift'],
  ['Control_L', 'Control'],
  ['Control_R', 'Control'],
  ['Alt_L', 'Alt'],
  ['Alt_R', 'Alt'],
  ['Super_L', 'Meta'],
  ['Super_R', 'Meta'],
]);

const xToPlaywrightModifierMap = new Map([
  ['alt', 'Alt'],
  ['control', 'Control'],
  ['meta', 'Meta'],
  ['shift', 'Shift'],
]);


const xToPlaywright = (key: string) => {
  const tokens = key.split('+');
  if (tokens.length === 1)
    return xToPlaywrightKeyMap.get(key) || key;
  if (tokens.length === 2) {
    const modifier = xToPlaywrightModifierMap.get(tokens[0]);
    const key = xToPlaywrightKeyMap.get(tokens[1]) || tokens[1];
    return modifier + '+' + key;
  }
  throw new Error('Invalid key: ' + key);
};
