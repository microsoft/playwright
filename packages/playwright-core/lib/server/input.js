"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.keypadLocation = exports.Touchscreen = exports.Mouse = exports.Keyboard = void 0;
exports.resolveSmartModifier = resolveSmartModifier;
exports.resolveSmartModifierString = resolveSmartModifierString;
var _utils = require("../utils");
var keyboardLayout = _interopRequireWildcard(require("./usKeyboardLayout"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

const keypadLocation = exports.keypadLocation = keyboardLayout.keypadLocation;
const kModifiers = ['Alt', 'Control', 'Meta', 'Shift'];
class Keyboard {
  constructor(raw) {
    this._pressedModifiers = new Set();
    this._pressedKeys = new Set();
    this._raw = void 0;
    this._raw = raw;
  }
  async down(key) {
    const description = this._keyDescriptionForString(key);
    const autoRepeat = this._pressedKeys.has(description.code);
    this._pressedKeys.add(description.code);
    if (kModifiers.includes(description.key)) this._pressedModifiers.add(description.key);
    const text = description.text;
    await this._raw.keydown(this._pressedModifiers, description.code, description.keyCode, description.keyCodeWithoutLocation, description.key, description.location, autoRepeat, text);
  }
  _keyDescriptionForString(str) {
    const keyString = resolveSmartModifierString(str);
    let description = usKeyboardLayout.get(keyString);
    (0, _utils.assert)(description, `Unknown key: "${keyString}"`);
    const shift = this._pressedModifiers.has('Shift');
    description = shift && description.shifted ? description.shifted : description;

    // if any modifiers besides shift are pressed, no text should be sent
    if (this._pressedModifiers.size > 1 || !this._pressedModifiers.has('Shift') && this._pressedModifiers.size === 1) return {
      ...description,
      text: ''
    };
    return description;
  }
  async up(key) {
    const description = this._keyDescriptionForString(key);
    if (kModifiers.includes(description.key)) this._pressedModifiers.delete(description.key);
    this._pressedKeys.delete(description.code);
    await this._raw.keyup(this._pressedModifiers, description.code, description.keyCode, description.keyCodeWithoutLocation, description.key, description.location);
  }
  async insertText(text) {
    await this._raw.sendText(text);
  }
  async type(text, options) {
    const delay = options && options.delay || undefined;
    for (const char of text) {
      if (usKeyboardLayout.has(char)) {
        await this.press(char, {
          delay
        });
      } else {
        if (delay) await new Promise(f => setTimeout(f, delay));
        await this.insertText(char);
      }
    }
  }
  async press(key, options = {}) {
    function split(keyString) {
      const keys = [];
      let building = '';
      for (const char of keyString) {
        if (char === '+' && building) {
          keys.push(building);
          building = '';
        } else {
          building += char;
        }
      }
      keys.push(building);
      return keys;
    }
    const tokens = split(key);
    key = tokens[tokens.length - 1];
    for (let i = 0; i < tokens.length - 1; ++i) await this.down(tokens[i]);
    await this.down(key);
    if (options.delay) await new Promise(f => setTimeout(f, options.delay));
    await this.up(key);
    for (let i = tokens.length - 2; i >= 0; --i) await this.up(tokens[i]);
  }
  async ensureModifiers(mm) {
    const modifiers = mm.map(resolveSmartModifier);
    for (const modifier of modifiers) {
      if (!kModifiers.includes(modifier)) throw new Error('Unknown modifier ' + modifier);
    }
    const restore = Array.from(this._pressedModifiers);
    for (const key of kModifiers) {
      const needDown = modifiers.includes(key);
      const isDown = this._pressedModifiers.has(key);
      if (needDown && !isDown) await this.down(key);else if (!needDown && isDown) await this.up(key);
    }
    return restore;
  }
  _modifiers() {
    return this._pressedModifiers;
  }
}
exports.Keyboard = Keyboard;
function resolveSmartModifierString(key) {
  if (key === 'ControlOrMeta') return process.platform === 'darwin' ? 'Meta' : 'Control';
  return key;
}
function resolveSmartModifier(m) {
  return resolveSmartModifierString(m);
}
class Mouse {
  constructor(raw, page) {
    this._keyboard = void 0;
    this._x = 0;
    this._y = 0;
    this._lastButton = 'none';
    this._buttons = new Set();
    this._raw = void 0;
    this._page = void 0;
    this._raw = raw;
    this._page = page;
    this._keyboard = this._page.keyboard;
  }
  async move(x, y, options = {}, metadata) {
    if (metadata) metadata.point = {
      x,
      y
    };
    const {
      steps = 1
    } = options;
    const fromX = this._x;
    const fromY = this._y;
    this._x = x;
    this._y = y;
    for (let i = 1; i <= steps; i++) {
      const middleX = fromX + (x - fromX) * (i / steps);
      const middleY = fromY + (y - fromY) * (i / steps);
      await this._raw.move(middleX, middleY, this._lastButton, this._buttons, this._keyboard._modifiers(), !!options.forClick);
    }
  }
  async down(options = {}, metadata) {
    if (metadata) metadata.point = {
      x: this._x,
      y: this._y
    };
    const {
      button = 'left',
      clickCount = 1
    } = options;
    this._lastButton = button;
    this._buttons.add(button);
    await this._raw.down(this._x, this._y, this._lastButton, this._buttons, this._keyboard._modifiers(), clickCount);
  }
  async up(options = {}, metadata) {
    if (metadata) metadata.point = {
      x: this._x,
      y: this._y
    };
    const {
      button = 'left',
      clickCount = 1
    } = options;
    this._lastButton = 'none';
    this._buttons.delete(button);
    await this._raw.up(this._x, this._y, button, this._buttons, this._keyboard._modifiers(), clickCount);
  }
  async click(x, y, options = {}, metadata) {
    if (metadata) metadata.point = {
      x: this._x,
      y: this._y
    };
    const {
      delay = null,
      clickCount = 1
    } = options;
    if (delay) {
      this.move(x, y, {
        forClick: true
      });
      for (let cc = 1; cc <= clickCount; ++cc) {
        await this.down({
          ...options,
          clickCount: cc
        });
        await new Promise(f => setTimeout(f, delay));
        await this.up({
          ...options,
          clickCount: cc
        });
        if (cc < clickCount) await new Promise(f => setTimeout(f, delay));
      }
    } else {
      const promises = [];
      promises.push(this.move(x, y, {
        forClick: true
      }));
      for (let cc = 1; cc <= clickCount; ++cc) {
        promises.push(this.down({
          ...options,
          clickCount: cc
        }));
        promises.push(this.up({
          ...options,
          clickCount: cc
        }));
      }
      await Promise.all(promises);
    }
  }
  async dblclick(x, y, options = {}) {
    await this.click(x, y, {
      ...options,
      clickCount: 2
    });
  }
  async wheel(deltaX, deltaY) {
    await this._raw.wheel(this._x, this._y, this._buttons, this._keyboard._modifiers(), deltaX, deltaY);
  }
}
exports.Mouse = Mouse;
const aliases = new Map([['ShiftLeft', ['Shift']], ['ControlLeft', ['Control']], ['AltLeft', ['Alt']], ['MetaLeft', ['Meta']], ['Enter', ['\n', '\r']]]);
const usKeyboardLayout = buildLayoutClosure(keyboardLayout.USKeyboardLayout);
function buildLayoutClosure(layout) {
  const result = new Map();
  for (const code in layout) {
    const definition = layout[code];
    const description = {
      key: definition.key || '',
      keyCode: definition.keyCode || 0,
      keyCodeWithoutLocation: definition.keyCodeWithoutLocation || definition.keyCode || 0,
      code,
      text: definition.text || '',
      location: definition.location || 0
    };
    if (definition.key.length === 1) description.text = description.key;

    // Generate shifted definition.
    let shiftedDescription;
    if (definition.shiftKey) {
      (0, _utils.assert)(definition.shiftKey.length === 1);
      shiftedDescription = {
        ...description
      };
      shiftedDescription.key = definition.shiftKey;
      shiftedDescription.text = definition.shiftKey;
      if (definition.shiftKeyCode) shiftedDescription.keyCode = definition.shiftKeyCode;
    }

    // Map from code: Digit3 -> { ... description, shifted }
    result.set(code, {
      ...description,
      shifted: shiftedDescription
    });

    // Map from aliases: Shift -> non-shiftable definition
    if (aliases.has(code)) {
      for (const alias of aliases.get(code)) result.set(alias, description);
    }

    // Do not use numpad when converting keys to codes.
    if (definition.location) continue;

    // Map from key, no shifted
    if (description.key.length === 1) result.set(description.key, description);

    // Map from shiftKey, no shifted
    if (shiftedDescription) result.set(shiftedDescription.key, {
      ...shiftedDescription,
      shifted: undefined
    });
  }
  return result;
}
class Touchscreen {
  constructor(raw, page) {
    this._raw = void 0;
    this._page = void 0;
    this._raw = raw;
    this._page = page;
  }
  async tap(x, y, metadata) {
    if (metadata) metadata.point = {
      x,
      y
    };
    if (!this._page._browserContext._options.hasTouch) throw new Error('hasTouch must be enabled on the browser context before using the touchscreen.');
    await this._raw.tap(x, y, this._page.keyboard._modifiers());
  }
}
exports.Touchscreen = Touchscreen;