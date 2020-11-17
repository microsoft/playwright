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

export type KeyDefinition = {
  key: string;
  keyCode: number;
  keyCodeWithoutLocation?: number;
  shiftKey?: string;
  shiftKeyCode?: number;
  text?: string;
  location?: number;
  altKey?: string;
  altShiftKey?: string;
}

export type KeyboardLayout = { [s: string]: KeyDefinition; };

export const keypadLocation = 3;

export const USKeyboardLayout: KeyboardLayout = {
  // Functions row
  'Escape': { 'keyCode': 27, 'key': 'Escape' },
  'F1': { 'keyCode': 112, 'key': 'F1' },
  'F2': { 'keyCode': 113, 'key': 'F2' },
  'F3': { 'keyCode': 114, 'key': 'F3' },
  'F4': { 'keyCode': 115, 'key': 'F4' },
  'F5': { 'keyCode': 116, 'key': 'F5' },
  'F6': { 'keyCode': 117, 'key': 'F6' },
  'F7': { 'keyCode': 118, 'key': 'F7' },
  'F8': { 'keyCode': 119, 'key': 'F8' },
  'F9': { 'keyCode': 120, 'key': 'F9' },
  'F10': { 'keyCode': 121, 'key': 'F10' },
  'F11': { 'keyCode': 122, 'key': 'F11' },
  'F12': { 'keyCode': 123, 'key': 'F12' },

  // Numbers row
  'Backquote': { 'keyCode': 192, 'shiftKey': '~', 'key': '`' },
  'Digit1': { 'keyCode': 49, 'shiftKey': '!', 'key': '1', 'altKey': '¡', 'altShiftKey': '⁄' },
  'Digit2': { 'keyCode': 50, 'shiftKey': '@', 'key': '2', 'altKey': '™', 'altShiftKey': '€' },
  'Digit3': { 'keyCode': 51, 'shiftKey': '#', 'key': '3', 'altKey': '£', 'altShiftKey': '‹' },
  'Digit4': { 'keyCode': 52, 'shiftKey': '$', 'key': '4', 'altKey': '¢', 'altShiftKey': '›' },
  'Digit5': { 'keyCode': 53, 'shiftKey': '%', 'key': '5', 'altKey': '∞', 'altShiftKey': 'ﬁ' },
  'Digit6': { 'keyCode': 54, 'shiftKey': '^', 'key': '6', 'altKey': '§', 'altShiftKey': 'ﬂ' },
  'Digit7': { 'keyCode': 55, 'shiftKey': '&', 'key': '7', 'altKey': '¶', 'altShiftKey': '‡' },
  'Digit8': { 'keyCode': 56, 'shiftKey': '*', 'key': '8', 'altKey': '•', 'altShiftKey': '°' },
  'Digit9': { 'keyCode': 57, 'shiftKey': '\(', 'key': '9', 'altKey': 'ª', 'altShiftKey': '·' },
  'Digit0': { 'keyCode': 48, 'shiftKey': ')', 'key': '0', 'altKey': 'º', 'altShiftKey': '‚' },
  'Minus': { 'keyCode': 189, 'shiftKey': '_', 'key': '-', 'altKey': '–', 'altShiftKey': '—'},
  'Equal': { 'keyCode': 187, 'shiftKey': '+', 'key': '=', 'altKey': '≠', 'altShiftKey': '±' },
  'Backslash': { 'keyCode': 220, 'shiftKey': '|', 'key': '\\', 'altKey': '«', 'altShiftKey': '»' },
  'Backspace': { 'keyCode': 8, 'key': 'Backspace' },

  // First row
  'Tab': { 'keyCode': 9, 'key': 'Tab' },
  'KeyQ': { 'keyCode': 81, 'shiftKey': 'Q', 'key': 'q', 'altKey': 'œ', 'altShiftKey': 'Œ' },
  'KeyW': { 'keyCode': 87, 'shiftKey': 'W', 'key': 'w', 'altKey': '∑', 'altShiftKey': '„' },
  'KeyE': { 'keyCode': 69, 'shiftKey': 'E', 'key': 'e' },
  'KeyR': { 'keyCode': 82, 'shiftKey': 'R', 'key': 'r', 'altKey': '®', 'altShiftKey': '‰' },
  'KeyT': { 'keyCode': 84, 'shiftKey': 'T', 'key': 't', 'altKey': '†', 'altShiftKey': 'ˇ' },
  'KeyY': { 'keyCode': 89, 'shiftKey': 'Y', 'key': 'y', 'altKey': '¥', 'altShiftKey': 'Á' },
  'KeyU': { 'keyCode': 85, 'shiftKey': 'U', 'key': 'u' },
  'KeyI': { 'keyCode': 73, 'shiftKey': 'I', 'key': 'i' },
  'KeyO': { 'keyCode': 79, 'shiftKey': 'O', 'key': 'o', 'altKey': 'ø', 'altShiftKey': 'Ø' },
  'KeyP': { 'keyCode': 80, 'shiftKey': 'P', 'key': 'p', 'altKey': 'π', 'altShiftKey': '∏' },
  'BracketLeft': { 'keyCode': 219, 'shiftKey': '{', 'key': '[', 'altKey': '“', 'altShiftKey': '”' },
  'BracketRight': { 'keyCode': 221, 'shiftKey': '}', 'key': ']', 'altKey': '‘', 'altShiftKey': '’' },

  // Second row
  'CapsLock': { 'keyCode': 20, 'key': 'CapsLock' },
  'KeyA': { 'keyCode': 65, 'shiftKey': 'A', 'key': 'a', 'altKey': 'å', 'altShiftKey': 'Å' },
  'KeyS': { 'keyCode': 83, 'shiftKey': 'S', 'key': 's', 'altKey': 'ß', 'altShiftKey': 'Í' },
  'KeyD': { 'keyCode': 68, 'shiftKey': 'D', 'key': 'd', 'altKey': '∂', 'altShiftKey': 'Î' },
  'KeyF': { 'keyCode': 70, 'shiftKey': 'F', 'key': 'f', 'altKey': 'ƒ', 'altShiftKey': 'Ï' },
  'KeyG': { 'keyCode': 71, 'shiftKey': 'G', 'key': 'g', 'altKey': '©', 'altShiftKey': '˝' },
  'KeyH': { 'keyCode': 72, 'shiftKey': 'H', 'key': 'h', 'altKey': '˙', 'altShiftKey': 'Ó' },
  'KeyJ': { 'keyCode': 74, 'shiftKey': 'J', 'key': 'j', 'altKey': '∆', 'altShiftKey': 'Ô' },
  'KeyK': { 'keyCode': 75, 'shiftKey': 'K', 'key': 'k', 'altKey': '˚', 'altShiftKey': '' },
  'KeyL': { 'keyCode': 76, 'shiftKey': 'L', 'key': 'l', 'altKey': '¬', 'altShiftKey': 'Ò' },
  'Semicolon': { 'keyCode': 186, 'shiftKey': ':', 'key': ';', 'altKey': '…', 'altShiftKey': 'Ú' },
  'Quote': { 'keyCode': 222, 'shiftKey': '"', 'key': '\'', 'altKey': 'æ', 'altShiftKey': 'Æ' },
  'Enter': { 'keyCode': 13, 'key': 'Enter', 'text': '\r' },

  // Third row
  'ShiftLeft': { 'keyCode': 160, 'keyCodeWithoutLocation': 16, 'key': 'Shift', 'location': 1 },
  'KeyZ': { 'keyCode': 90, 'shiftKey': 'Z', 'key': 'z', 'altKey': 'Ω', 'altShiftKey': '¸' },
  'KeyX': { 'keyCode': 88, 'shiftKey': 'X', 'key': 'x', 'altKey': '≈', 'altShiftKey': '˛' },
  'KeyC': { 'keyCode': 67, 'shiftKey': 'C', 'key': 'c', 'altKey': 'ç', 'altShiftKey': 'Ç' },
  'KeyV': { 'keyCode': 86, 'shiftKey': 'V', 'key': 'v', 'altKey': '√', 'altShiftKey': '◊' },
  'KeyB': { 'keyCode': 66, 'shiftKey': 'B', 'key': 'b', 'altKey': '∫', 'altShiftKey': 'ı' },
  'KeyN': { 'keyCode': 78, 'shiftKey': 'N', 'key': 'n' },
  'KeyM': { 'keyCode': 77, 'shiftKey': 'M', 'key': 'm', 'altKey': 'µ', 'altShiftKey': 'Â' },
  'Comma': { 'keyCode': 188, 'shiftKey': '\<', 'key': ',', 'altKey': '≤', 'altShiftKey': '¯' },
  'Period': { 'keyCode': 190, 'shiftKey': '>', 'key': '.', 'altKey': '≥', 'altShiftKey': '˘' },
  'Slash': { 'keyCode': 191, 'shiftKey': '?', 'key': '/', 'altKey': '÷', 'altShiftKey': '¿' },
  'ShiftRight': { 'keyCode': 161, 'keyCodeWithoutLocation': 16, 'key': 'Shift', 'location': 2 },

  // Last row
  'ControlLeft': { 'keyCode': 162, 'keyCodeWithoutLocation': 17, 'key': 'Control', 'location': 1 },
  'MetaLeft': { 'keyCode': 91, 'key': 'Meta', 'location': 1 },
  'AltLeft': { 'keyCode': 164, 'keyCodeWithoutLocation': 18, 'key': 'Alt', 'location': 1 },
  'Space': { 'keyCode': 32, 'key': ' ', 'altKey': '\u00a0' },
  'AltRight': { 'keyCode': 165, 'keyCodeWithoutLocation': 18, 'key': 'Alt', 'location': 2 },
  'AltGraph': { 'keyCode': 225, 'key': 'AltGraph' },
  'MetaRight': { 'keyCode': 92, 'key': 'Meta', 'location': 2 },
  'ContextMenu': { 'keyCode': 93, 'key': 'ContextMenu' },
  'ControlRight': { 'keyCode': 163, 'keyCodeWithoutLocation': 17, 'key': 'Control', 'location': 2 },

  // Center block
  'PrintScreen': { 'keyCode': 44, 'key': 'PrintScreen' },
  'ScrollLock': { 'keyCode': 145, 'key': 'ScrollLock' },
  'Pause': { 'keyCode': 19, 'key': 'Pause' },

  'PageUp': { 'keyCode': 33, 'key': 'PageUp' },
  'PageDown': { 'keyCode': 34, 'key': 'PageDown' },
  'Insert': { 'keyCode': 45, 'key': 'Insert' },
  'Delete': { 'keyCode': 46, 'key': 'Delete' },
  'Home': { 'keyCode': 36, 'key': 'Home' },
  'End': { 'keyCode': 35, 'key': 'End' },

  'ArrowLeft': { 'keyCode': 37, 'key': 'ArrowLeft' },
  'ArrowUp': { 'keyCode': 38, 'key': 'ArrowUp' },
  'ArrowRight': { 'keyCode': 39, 'key': 'ArrowRight' },
  'ArrowDown': { 'keyCode': 40, 'key': 'ArrowDown' },

  // Numpad
  'NumLock': { 'keyCode': 144, 'key': 'NumLock' },
  'NumpadDivide': { 'keyCode': 111, 'key': '/', 'location': 3 },
  'NumpadMultiply': { 'keyCode': 106, 'key': '*', 'location': 3 },
  'NumpadSubtract': { 'keyCode': 109, 'key': '-', 'location': 3 },
  'Numpad7': { 'keyCode': 36, 'shiftKeyCode': 103, 'key': 'Home', 'shiftKey': '7', 'location': 3 },
  'Numpad8': { 'keyCode': 38, 'shiftKeyCode': 104, 'key': 'ArrowUp', 'shiftKey': '8', 'location': 3 },
  'Numpad9': { 'keyCode': 33, 'shiftKeyCode': 105, 'key': 'PageUp', 'shiftKey': '9', 'location': 3 },
  'Numpad4': { 'keyCode': 37, 'shiftKeyCode': 100, 'key': 'ArrowLeft', 'shiftKey': '4', 'location': 3 },
  'Numpad5': { 'keyCode': 12, 'shiftKeyCode': 101, 'key': 'Clear', 'shiftKey': '5', 'location': 3 },
  'Numpad6': { 'keyCode': 39, 'shiftKeyCode': 102, 'key': 'ArrowRight', 'shiftKey': '6', 'location': 3 },
  'NumpadAdd': { 'keyCode': 107, 'key': '+', 'location': 3 },
  'Numpad1': { 'keyCode': 35, 'shiftKeyCode': 97, 'key': 'End', 'shiftKey': '1', 'location': 3 },
  'Numpad2': { 'keyCode': 40, 'shiftKeyCode': 98, 'key': 'ArrowDown', 'shiftKey': '2', 'location': 3 },
  'Numpad3': { 'keyCode': 34, 'shiftKeyCode': 99, 'key': 'PageDown', 'shiftKey': '3', 'location': 3 },
  'Numpad0': { 'keyCode': 45, 'shiftKeyCode': 96, 'key': 'Insert', 'shiftKey': '0', 'location': 3 },
  'NumpadDecimal': { 'keyCode': 46, 'shiftKeyCode': 110, 'key': '\u0000', 'shiftKey': '.', 'location': 3 },
  'NumpadEnter': { 'keyCode': 13, 'key': 'Enter', 'text': '\r', 'location': 3 },
};
