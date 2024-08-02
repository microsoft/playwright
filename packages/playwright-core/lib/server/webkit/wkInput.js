"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RawTouchscreenImpl = exports.RawMouseImpl = exports.RawKeyboardImpl = void 0;
var input = _interopRequireWildcard(require("../input"));
var _macEditingCommands = require("../macEditingCommands");
var _utils = require("../../utils");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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
  // From Source/WebKit/Shared/WebEvent.h
  let mask = 0;
  if (modifiers.has('Shift')) mask |= 1;
  if (modifiers.has('Control')) mask |= 2;
  if (modifiers.has('Alt')) mask |= 4;
  if (modifiers.has('Meta')) mask |= 8;
  return mask;
}
function toButtonsMask(buttons) {
  let mask = 0;
  if (buttons.has('left')) mask |= 1;
  if (buttons.has('right')) mask |= 2;
  if (buttons.has('middle')) mask |= 4;
  return mask;
}
class RawKeyboardImpl {
  constructor(session) {
    this._pageProxySession = void 0;
    this._session = void 0;
    this._pageProxySession = session;
  }
  setSession(session) {
    this._session = session;
  }
  async keydown(modifiers, code, keyCode, keyCodeWithoutLocation, key, location, autoRepeat, text) {
    const parts = [];
    for (const modifier of ['Shift', 'Control', 'Alt', 'Meta']) {
      if (modifiers.has(modifier)) parts.push(modifier);
    }
    parts.push(code);
    const shortcut = parts.join('+');
    let commands = _macEditingCommands.macEditingCommands[shortcut];
    if ((0, _utils.isString)(commands)) commands = [commands];
    await this._pageProxySession.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      modifiers: toModifiersMask(modifiers),
      windowsVirtualKeyCode: keyCode,
      code,
      key,
      text,
      unmodifiedText: text,
      autoRepeat,
      macCommands: commands,
      isKeypad: location === input.keypadLocation
    });
  }
  async keyup(modifiers, code, keyCode, keyCodeWithoutLocation, key, location) {
    await this._pageProxySession.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: toModifiersMask(modifiers),
      key,
      windowsVirtualKeyCode: keyCode,
      code,
      isKeypad: location === input.keypadLocation
    });
  }
  async sendText(text) {
    await this._session.send('Page.insertText', {
      text
    });
  }
}
exports.RawKeyboardImpl = RawKeyboardImpl;
class RawMouseImpl {
  constructor(session) {
    this._pageProxySession = void 0;
    this._session = void 0;
    this._page = void 0;
    this._pageProxySession = session;
  }
  setSession(session) {
    this._session = session;
  }
  async move(x, y, button, buttons, modifiers, forClick) {
    await this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'move',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers)
    });
  }
  async down(x, y, button, buttons, modifiers, clickCount) {
    await this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'down',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }
  async up(x, y, button, buttons, modifiers, clickCount) {
    await this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'up',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }
  async wheel(x, y, buttons, modifiers, deltaX, deltaY) {
    var _this$_page;
    if ((_this$_page = this._page) !== null && _this$_page !== void 0 && _this$_page._browserContext._options.isMobile) throw new Error('Mouse wheel is not supported in mobile WebKit');
    await this._session.send('Page.updateScrollingState');
    // Wheel events hit the compositor first, so wait one frame for it to be synced.
    await this._page.mainFrame().evaluateExpression(`new Promise(requestAnimationFrame)`, {
      world: 'utility'
    });
    await this._pageProxySession.send('Input.dispatchWheelEvent', {
      x,
      y,
      deltaX,
      deltaY,
      modifiers: toModifiersMask(modifiers)
    });
  }
  setPage(page) {
    this._page = page;
  }
}
exports.RawMouseImpl = RawMouseImpl;
class RawTouchscreenImpl {
  constructor(session) {
    this._pageProxySession = void 0;
    this._pageProxySession = session;
  }
  async tap(x, y, modifiers) {
    await this._pageProxySession.send('Input.dispatchTapEvent', {
      x,
      y,
      modifiers: toModifiersMask(modifiers)
    });
  }
}
exports.RawTouchscreenImpl = RawTouchscreenImpl;