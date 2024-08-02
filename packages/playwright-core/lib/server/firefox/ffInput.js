"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RawTouchscreenImpl = exports.RawMouseImpl = exports.RawKeyboardImpl = void 0;
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

function toModifiersMask(modifiers) {
  let mask = 0;
  if (modifiers.has('Alt')) mask |= 1;
  if (modifiers.has('Control')) mask |= 2;
  if (modifiers.has('Shift')) mask |= 4;
  if (modifiers.has('Meta')) mask |= 8;
  return mask;
}
function toButtonNumber(button) {
  if (button === 'left') return 0;
  if (button === 'middle') return 1;
  if (button === 'right') return 2;
  return 0;
}
function toButtonsMask(buttons) {
  let mask = 0;
  if (buttons.has('left')) mask |= 1;
  if (buttons.has('right')) mask |= 2;
  if (buttons.has('middle')) mask |= 4;
  return mask;
}
class RawKeyboardImpl {
  constructor(client) {
    this._client = void 0;
    this._client = client;
  }
  async keydown(modifiers, code, keyCode, keyCodeWithoutLocation, key, location, autoRepeat, text) {
    // Firefox will figure out Enter by itself
    if (text === '\r') text = '';
    await this._client.send('Page.dispatchKeyEvent', {
      type: 'keydown',
      keyCode: keyCodeWithoutLocation,
      code,
      key,
      repeat: autoRepeat,
      location,
      text
    });
  }
  async keyup(modifiers, code, keyCode, keyCodeWithoutLocation, key, location) {
    await this._client.send('Page.dispatchKeyEvent', {
      type: 'keyup',
      key,
      keyCode: keyCodeWithoutLocation,
      code,
      location,
      repeat: false
    });
  }
  async sendText(text) {
    await this._client.send('Page.insertText', {
      text
    });
  }
}
exports.RawKeyboardImpl = RawKeyboardImpl;
class RawMouseImpl {
  constructor(client) {
    this._client = void 0;
    this._page = void 0;
    this._client = client;
  }
  async move(x, y, button, buttons, modifiers, forClick) {
    await this._client.send('Page.dispatchMouseEvent', {
      type: 'mousemove',
      button: 0,
      buttons: toButtonsMask(buttons),
      x: Math.floor(x),
      y: Math.floor(y),
      modifiers: toModifiersMask(modifiers)
    });
  }
  async down(x, y, button, buttons, modifiers, clickCount) {
    await this._client.send('Page.dispatchMouseEvent', {
      type: 'mousedown',
      button: toButtonNumber(button),
      buttons: toButtonsMask(buttons),
      x: Math.floor(x),
      y: Math.floor(y),
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }
  async up(x, y, button, buttons, modifiers, clickCount) {
    await this._client.send('Page.dispatchMouseEvent', {
      type: 'mouseup',
      button: toButtonNumber(button),
      buttons: toButtonsMask(buttons),
      x: Math.floor(x),
      y: Math.floor(y),
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }
  async wheel(x, y, buttons, modifiers, deltaX, deltaY) {
    // Wheel events hit the compositor first, so wait one frame for it to be synced.
    await this._page.mainFrame().evaluateExpression(`new Promise(requestAnimationFrame)`, {
      world: 'utility'
    });
    await this._client.send('Page.dispatchWheelEvent', {
      deltaX,
      deltaY,
      x: Math.floor(x),
      y: Math.floor(y),
      deltaZ: 0,
      modifiers: toModifiersMask(modifiers)
    });
  }
  setPage(page) {
    this._page = page;
  }
}
exports.RawMouseImpl = RawMouseImpl;
class RawTouchscreenImpl {
  constructor(client) {
    this._client = void 0;
    this._client = client;
  }
  async tap(x, y, modifiers) {
    await this._client.send('Page.dispatchTapEvent', {
      x,
      y,
      modifiers: toModifiersMask(modifiers)
    });
  }
}
exports.RawTouchscreenImpl = RawTouchscreenImpl;