#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

/**
 * @typedef { import('../packages/playwright-core/src/server/keyboards/types').KeyDefinition } KeyDefinition
 * @typedef { import('playwright').Locator } Locator
 * @typedef { import('playwright').Page } Page
 */

const fs = require('fs');
const assert = require('assert');
const path = require('path');
const xml2js = require('xml2js');

// US keyboard
const defaultKlid = '00000409';

/**
 * @type { Object.<string, { layoutName: string, locales: string[] }> }
 */
const layoutUrls = {
  '00000409': { layoutName: 'US keyboard', locales: ['af-ZA', 'en-US', 'en-AU', 'en-BZ', 'en-CA', 'en-029', 'en-HK', 'en-JM', 'en-MY', 'en-PH', 'en-SG', 'en-ZA', 'en-TT', 'en-ZW', 'fil-PH', 'id-ID', 'jv', 'rw-RW', 'sw-KE', 'ms-MY', 'ms-BN', 'moh-CA', 'om-ET', 'pap-029', 'st-ZA', 'so-SO', 'uz-Latn-UZ', 'ts-ZA', 'xh-ZA', 'zu-ZA'] },
  '0000041C': { layoutName: 'Albanian keyboard', locales: ['sq-AL'] },
  '0000040C': { layoutName: 'French keyboard', locales: ['gsw-FR', 'br-FR', 'fr-FR', 'co-FR', 'fr-CM', 'fr-CI', 'fr-HT', 'fr-ML', 'fr-MC', 'fr-MA', 'fr-RE', 'fr-SN', 'fr-CD', 'mg', 'oc-FR'] },
  '00000401': { layoutName: 'Arabic (101) keyboard', locales: ['ar-SA', 'ar-BH', 'ar-EG', 'ar-IQ', 'ar-JO', 'ar-KW', 'ar-LB', 'ar-LY', 'ar-OM', 'ar-QA', 'ar-SY', 'ar-AE', 'ar-YE'] },
  '00020401': { layoutName: 'Arabic (102) AZERTY keyboard', locales: ['ar-DZ', 'ar-MA', 'ar-TN'] },
  '0002042B': { layoutName: 'Armenian Phonetic keyboard', locales: ['hy-AM'] },
  '0000044D': { layoutName: 'Assamese - INSCRIPT keyboard', locales: ['as-IN'] },
  '0000040A': { layoutName: 'Spanish keyboard', locales: ['es-ES_tradnl', 'eu-ES', 'ca-ES', 'gl-ES', 'es-ES', 'ca-ES-valencia'] },
  '0000042C': { layoutName: 'Azerbaijani Latin keyboard', locales: ['az-Latn-AZ'] },
  '0000082C': { layoutName: 'Azerbaijani Cyrillic keyboard', locales: ['az-Cyrl-AZ'] },
  '00000445': { layoutName: 'Bangla keyboard', locales: ['bn-BD'] },
  '0000046D': { layoutName: 'Bashkir keyboard', locales: ['ba-RU'] },
  '00000423': { layoutName: 'Belarusian keyboard', locales: ['be-BY'] },
  '00020445': { layoutName: 'Bangla - INSCRIPT keyboard', locales: ['bn-IN'] },
  '00000439': { layoutName: 'Devanagari - INSCRIPT keyboard', locales: ['kok-IN', 'sa-IN'] },
  '0000041A': { layoutName: 'Standard keyboard', locales: ['bs-Latn-BA', 'hr-HR', 'hr-BA'] },
  '0000201A': { layoutName: 'Bosnian (Cyrillic) keyboard', locales: ['bs-Cyrl-BA'] },
  '00030402': { layoutName: 'Bulgarian keyboard', locales: ['bg-BG'] },
  '00130C00': { layoutName: 'Myanmar (Visual order) keyboard', locales: ['my-MM'] },
  '00000410': { layoutName: 'Italian keyboard', locales: ['it-IT'] },
  '0000085F': { layoutName: 'Central Atlas Tamazight keyboard', locales: ['tzm-Latn-DZ'] },
  '0000105F': { layoutName: 'Tifinagh (Basic) keyboard', locales: ['tzm-Tfng-MA', 'zgh'] },
  '00000492': { layoutName: 'Central Kurdish keyboard', locales: ['ku-Arab-IQ'] },
  '00000419': { layoutName: 'Russian keyboard', locales: ['ru-RU'] },
  '0000045C': { layoutName: 'Cherokee Nation keyboard', locales: ['chr-Cher-US'] },
  '00000407': { layoutName: 'German keyboard', locales: ['de-DE', 'de-AT', 'de-LU'] },
  '00000809': { layoutName: 'United Kingdom keyboard', locales: ['en-GB'] },
  '00000405': { layoutName: 'Czech keyboard', locales: ['cs-CZ'] },
  '00000406': { layoutName: 'Danish keyboard', locales: ['da-DK', 'fo-FO', 'kl-GL'] },
  '00000465': { layoutName: 'Divehi Phonetic keyboard', locales: ['dv-MV'] },
  '00020409': { layoutName: 'United States-International keyboard', locales: ['nl-NL', 'fy-NL'] },
  '00000813': { layoutName: 'Belgian (Period) keyboard', locales: ['nl-BE'] },
  '00000C51': { layoutName: 'Dzongkha keyboard', locales: ['dz-BT'] },
  '0000080C': { layoutName: 'Belgian French keyboard', locales: ['fr-BE'] },
  '0000040B': { layoutName: 'Finnish keyboard', locales: ['fi-FI'] },
  '00004009': { layoutName: 'English (India) keyboard', locales: ['en-IN'] },
  '00001809': { layoutName: 'Irish keyboard', locales: ['en-IE', 'ga-IE'] },
  '00001409': { layoutName: 'NZ Aotearoa keyboard', locales: ['en-NZ'] },
  '00000424': { layoutName: 'Slovenian keyboard', locales: ['sl-SI'] },
  '0000041D': { layoutName: 'Swedish keyboard', locales: ['sv-SE', 'sv-FI'] },
  '00000425': { layoutName: 'Estonian keyboard', locales: ['et-EE'] },
  '00001009': { layoutName: 'Canadian French keyboard', locales: ['fr-CA'] },
  '0000100C': { layoutName: 'Swiss French keyboard', locales: ['fr-LU', 'fr-CH', 'it-CH'] },
  '00000488': { layoutName: 'Wolof keyboard', locales: ['ff-Latn-SN', 'wo-SN'] },
  '00010437': { layoutName: 'Georgian (QWERTY) keyboard', locales: ['ka-GE'] },
  '00000807': { layoutName: 'Swiss German keyboard', locales: ['de-LI', 'de-CH', 'rm-CH'] },
  '00000408': { layoutName: 'Greek keyboard', locales: ['el-GR'] },
  '00000474': { layoutName: 'Guarani keyboard', locales: ['gn-PY'] },
  '00000447': { layoutName: 'Gujarati keyboard', locales: ['gu-IN'] },
  '00000468': { layoutName: 'Hausa keyboard', locales: ['ha-Latn-NG'] },
  '00000475': { layoutName: 'Hawaiian keyboard', locales: ['haw-US'] },
  '0002040D': { layoutName: 'Hebrew (Standard) keyboard', locales: ['he-IL'] },
  '00010439': { layoutName: 'Hindi Traditional keyboard', locales: ['hi-IN'] },
  '0000040E': { layoutName: 'Hungarian keyboard', locales: ['hu-HU'] },
  '0000040F': { layoutName: 'Icelandic keyboard', locales: ['is-IS'] },
  '00000470': { layoutName: 'Igbo keyboard', locales: ['ig-NG'] },
  '0000085D': { layoutName: 'Inuktitut - Latin keyboard', locales: ['iu-Latn-CA'] },
  '0001045D': { layoutName: 'Inuktitut - Naqittaut keyboard', locales: ['iu-Cans-CA'] },
  '00110C00': { layoutName: 'Javanese keyboard', locales: ['jv-Java'] },
  '0000044B': { layoutName: 'Kannada keyboard', locales: ['kn-IN'] },
  '00000420': { layoutName: 'Urdu keyboard', locales: ['ur-PK', 'pa-Arab-PK', 'sd-Arab-PK', 'ur-IN'] },
  '0000043F': { layoutName: 'Kazakh keyboard', locales: ['kk-KZ'] },
  '00000453': { layoutName: 'Khmer keyboard', locales: ['km-KH'] },
  '00000440': { layoutName: 'Kyrgyz Cyrillic keyboard', locales: ['ky-KG'] },
  '0000080A': { layoutName: 'Latin American keyboard', locales: ['quc-Latn-GT', 'arn-CL', 'quz-BO', 'quz-EC', 'quz-PE', 'es-AR', 'es-BO', 'es-CL', 'es-CO', 'es-CR', 'es-MX', 'es-DO', 'es-EC', 'es-SV', 'es-GT', 'es-HN', 'es-419', 'es-NI', 'es-PA', 'es-PY', 'es-PE', 'es-PR', 'es-US', 'es-UY', 'es-VE'] },
  '00000454': { layoutName: 'Lao keyboard', locales: ['lo-LA'] },
  '00020426': { layoutName: 'Latvian (Standard) keyboard', locales: ['lv-LV'] },
  '00010427': { layoutName: 'Lithuanian keyboard', locales: ['lt-LT'] },
  '0002042E': { layoutName: 'Sorbian Standard keyboard', locales: ['dsb-DE', 'hsb-DE'] },
  '0000046E': { layoutName: 'Luxembourgish keyboard', locales: ['lb-LU'] },
  '0001042F': { layoutName: 'Macedonian - Standard keyboard', locales: ['mk-MK'] },
  '0000044C': { layoutName: 'Malayalam keyboard', locales: ['ml-IN'] },
  '0000043A': { layoutName: 'Maltese 47-Key keyboard', locales: ['mt-MT'] },
  '00000481': { layoutName: 'Maori keyboard', locales: ['mi-NZ'] },
  '0000044E': { layoutName: 'Marathi keyboard', locales: ['mr-IN'] },
  '00000429': { layoutName: 'Persian keyboard', locales: ['fa-IR'] },
  '00000450': { layoutName: 'Mongolian Cyrillic keyboard', locales: ['mn-MN'] },
  '00010850': { layoutName: 'Traditional Mongolian (Standard) keyboard', locales: ['mn-Mong-CN', 'mn-Mong-MN'] },
  '00090C00': { layoutName: 'N’Ko keyboard', locales: ['nqo'] },
  '00000461': { layoutName: 'Nepali keyboard', locales: ['ne-NP', 'ne-IN'] },
  '0000043B': { layoutName: 'Norwegian with Sami keyboard', locales: ['se-NO', 'smj-NO', 'sma-NO'] },
  '00000414': { layoutName: 'Norwegian keyboard', locales: ['nb-NO', 'nn-NO'] },
  '00000448': { layoutName: 'Odia keyboard', locales: ['or-IN'] },
  '00000463': { layoutName: 'Pashto (Afghanistan) keyboard', locales: ['ps-AF'] },
  '00050429': { layoutName: 'Persian (Standard) keyboard', locales: ['fa-AF'] },
  '00000415': { layoutName: 'Polish (Programmers) keyboard', locales: ['pl-PL'] },
  '00000416': { layoutName: 'Portuguese (Brazil ABNT) keyboard', locales: ['pt-BR'] },
  '00000816': { layoutName: 'Portuguese keyboard', locales: ['pt-PT'] },
  '00000446': { layoutName: 'Punjabi keyboard', locales: ['pa-IN'] },
  '00010418': { layoutName: 'Romanian (Standard) keyboard', locales: ['ro-RO', 'ro-MD'] },
  '00000485': { layoutName: 'Sakha keyboard', locales: ['sah-RU'] },
  '0001083B': { layoutName: 'Finnish with Sami keyboard', locales: ['smn-FI', 'sms-FI', 'se-FI'] },
  '0000083B': { layoutName: 'Swedish with Sami keyboard', locales: ['smj-SE', 'sma-SE', 'se-SE'] },
  '00011809': { layoutName: 'Scottish Gaelic keyboard', locales: ['gd-GB'] },
  '0000081A': { layoutName: 'Serbian (Latin) keyboard', locales: ['sr-Latn-RS', 'sr-Latn-BA', 'sr-Latn-ME'] },
  '00000C1A': { layoutName: 'Serbian (Cyrillic) keyboard', locales: ['sr-Cyrl-RS', 'sr-Cyrl-BA', 'sr-Cyrl-ME'] },
  '0000046C': { layoutName: 'Sesotho sa Leboa keyboard', locales: ['nso-ZA'] },
  '00000432': { layoutName: 'Setswana keyboard', locales: ['tn-ZA', 'tn-BW'] },
  '0000045B': { layoutName: 'Sinhala keyboard', locales: ['si-LK'] },
  '0000041B': { layoutName: 'Slovak keyboard', locales: ['sk-SK'] },
  '0000045A': { layoutName: 'Syriac keyboard', locales: ['syr-SY'] },
  '00000428': { layoutName: 'Tajik keyboard', locales: ['tg-Cyrl-TJ'] },
  '00020449': { layoutName: 'Tamil 99 keyboard', locales: ['ta-IN', 'ta-LK'] },
  '00010444': { layoutName: 'Tatar keyboard', locales: ['tt-RU'] },
  '0000044A': { layoutName: 'Telugu keyboard', locales: ['te-IN'] },
  '0000041E': { layoutName: 'Thai Kedmanee keyboard', locales: ['th-TH'] },
  '00010451': { layoutName: 'Tibetan (PRC) - Updated keyboard', locales: ['bo-CN'] },
  '00000451': { layoutName: 'Tibetan (PRC) keyboard', locales: [] },
  '0000041F': { layoutName: 'Turkish Q keyboard', locales: ['tr-TR'] },
  '00000442': { layoutName: 'Turkmen keyboard', locales: ['tk-TM'] },
  '00020422': { layoutName: 'Ukrainian (Enhanced) keyboard', locales: ['uk-UA'] },
  '00010480': { layoutName: 'Uyghur keyboard', locales: ['ug-CN'] },
  '00000843': { layoutName: 'Uzbek Cyrillic keyboard', locales: ['uz-Cyrl-UZ'] },
  '00000452': { layoutName: 'United Kingdom Extended keyboard', locales: ['cy-GB'] },
  '0000046A': { layoutName: 'Yoruba keyboard', locales: ['yo-NG'] },
};

const copyrightHeader =
`/**
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

// This file is generated by ${path.basename(__filename).split(path.sep).join(path.posix.sep)}, do not edit manually.
`;

/**
 * @type { Object.<string, KeyDefinition | number> }
 *
 * numbers correspond to scancodes
 */
const keyboardLayoutGenerator = {
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
  'Backquote': 0x29,
  'Digit1': 0x02,
  'Digit2': 0x03,
  'Digit3': 0x04,
  'Digit4': 0x05,
  'Digit5': 0x06,
  'Digit6': 0x07,
  'Digit7': 0x08,
  'Digit8': 0x09,
  'Digit9': 0x0A,
  'Digit0': 0x0B,
  'Minus': 0x0C,
  'Equal': 0x0D,
  'Backspace': { 'keyCode': 8, 'key': 'Backspace' },

  // First row
  'Tab': { 'keyCode': 9, 'key': 'Tab' },
  'KeyQ': 0x10,
  'KeyW': 0x11,
  'KeyE': 0x12,
  'KeyR': 0x13,
  'KeyT': 0x14,
  'KeyY': 0x15,
  'KeyU': 0x16,
  'KeyI': 0x17,
  'KeyO': 0x18,
  'KeyP': 0x19,
  'BracketLeft': 0x1A,
  'BracketRight': 0x1B,
  'Enter': { 'keyCode': 13, 'key': 'Enter', 'text': '\r' },

  // Second row
  'CapsLock': { 'keyCode': 20, 'key': 'CapsLock' },
  'KeyA': 0x1E,
  'KeyS': 0x1F,
  'KeyD': 0x20,
  'KeyF': 0x21,
  'KeyG': 0x22,
  'KeyH': 0x23,
  'KeyJ': 0x24,
  'KeyK': 0x25,
  'KeyL': 0x26,
  'Semicolon': 0x27,
  'Quote': 0x28,
  'Backslash': 0x2B,

  // Third row
  'ShiftLeft': { 'keyCode': 160, 'keyCodeWithoutLocation': 16, 'key': 'Shift', 'location': 1 },
  'IntlBackslash': 0x56,
  'KeyZ': 0x2C,
  'KeyX': 0x2D,
  'KeyC': 0x2E,
  'KeyV': 0x2F,
  'KeyB': 0x30,
  'KeyN': 0x31,
  'KeyM': 0x32,
  'Comma': 0x33,
  'Period': 0x34,
  'Slash': 0x35,
  'ShiftRight': { 'keyCode': 161, 'keyCodeWithoutLocation': 16, 'key': 'Shift', 'location': 2 },

  // Last row
  'ControlLeft': { 'keyCode': 162, 'keyCodeWithoutLocation': 17, 'key': 'Control', 'location': 1 },
  'MetaLeft': { 'keyCode': 91, 'key': 'Meta', 'location': 1 },
  'AltLeft': { 'keyCode': 164, 'keyCodeWithoutLocation': 18, 'key': 'Alt', 'location': 1 },
  'Space': 0x39,
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

/**
 * @param { Page } page
 * @param { string } url
 * @returns { Promise<Object.<string, number>> }
 */
async function extractLocatorToVirtualKeys(page, url) {
  await page.goto(`${url}/virtualkeys`);

  /** @type { Object.<string, number> } */
  const mappings = {};

  /** @type { string[] } */
  // @ts-ignore
  const locators = Object.values(keyboardLayoutGenerator).filter(v => typeof v === 'string');
  for (const loc of locators) {
    const scancode = await page.locator(loc).locator('> .kls > .kl10').textContent();
    const vk = await page.locator(`.scGroup tr:has(td:nth-child(1):text-is('${scancode}')) > td:nth-child(2)`).first().textContent();
    assert(vk, `No virtual key code found for ${loc} (scancode ${scancode})`);
    mappings[loc] = parseInt(vk, 16);
  }

  return mappings;
}

/**
 * @param {string} xml
 * @returns {object}
 */
function parseXML(xml) {
  let result;
  xml2js.parseString(xml, {trim: true}, (err, r) => result = r);
  return result;
}

function hex2char(hex) {
  return String.fromCharCode(parseInt(hex, 16));
}

/**
 * @param { string } klid
 * @returns { Promise<Object.<string, KeyDefinition>> }
 */
async function generate(klid) {
  const [xml, kdbtables] = await Promise.all([
    fetch(`https://kbdlayout.info/${klid}/download/xml`).then(r => r.text()),
    fetch(`https://kbdlayout.info/${klid}/download/kbdtables`).then(r => r.text()),
  ]);

  const sc2vkJson = parseXML(xml);
  assert(sc2vkJson);

  /**
   * scancode to keys
   *
   * @type {Object.<string, { key: string, shiftKey: string }>}
   */
  const sc2keys = Object.fromEntries(sc2vkJson.KeyboardLayout.PhysicalKeys[0].PK
      .map(({ Result, $: { SC } }) => {
        if (!Result) return;

        let key, shiftKey;
        for (const { $, DeadKeyTable } of Result) {
          const { Text, With } = $ ?? {};
          if (With && With !== 'VK_SHIFT') continue;

          const text = Text ?? DeadKeyTable?.[0].$.Accent;
          const isShift = With === 'VK_SHIFT';
          if (!isShift) key = text;
          if (isShift) shiftKey = text;
        }
        return [SC.toUpperCase(), { key, shiftKey }];
      }).filter(Boolean));

  const kdbtablesJson = parseXML(kdbtables);
  assert(kdbtablesJson);

  const { VSCtoVK: [sc2vkCodeStr] }= kdbtablesJson.KbdDll.KbdLayerDescriptor[0].KbdLayer[0];

  /**
   * virtual key codes. array index corresponds to scancode, as number
   *
   * @type {number[]}
   */
  const sc2vkCode = sc2vkCodeStr.split(' ').map(hex => parseInt(hex, 16));

  /** @type { Object.<string, KeyDefinition> } */
  const layout = {};

  for (const [keyname, def] of Object.entries(keyboardLayoutGenerator)) {
    if (typeof def === 'number') {
      const sc = def.toString(16).toUpperCase().padStart(2, '0');
      const { key, shiftKey } = sc2keys[sc] ?? {};

      if (key === shiftKey === undefined) continue;

      // def is the scancode as number
      const keyCode = sc2vkCode[def];

      layout[keyname] = { key, keyCode, shiftKey: keyname === 'Space' && key === shiftKey ? undefined : shiftKey };
    } else {
      layout[keyname] = def;
    }
  }
  return layout;
}

/** @param {string | undefined} str */
function fixQuotes(str) {
  if (str === undefined || str === null) return;
  const [, strBody] = /^"(.*)"$/.exec(JSON.stringify(str)) ?? [];
  return strBody?.replace(/'/g, `\\'`).replace(/\\"/g, '"');
}

/** @param {KeyDefinition} def */
function stringifyKeyDefinition(def) {
  const escaped = {
    ...def,
    key: fixQuotes(def.key),
    shiftKey: fixQuotes(def.shiftKey),
    text: fixQuotes(def.text),
  };
  /** @type {string[]} */
  const propStrs = [];
  if (escaped.key !== undefined) propStrs.push(`key: '${escaped.key}'`);
  if (escaped.keyCode !== undefined) propStrs.push(`keyCode: ${escaped.keyCode}`);
  if (escaped.keyCodeWithoutLocation !== undefined) propStrs.push(`keyCodeWithoutLocation: ${escaped.keyCodeWithoutLocation}`);
  if (escaped.shiftKey !== undefined) propStrs.push(`shiftKey: '${escaped.shiftKey}'`);
  if (escaped.shiftKeyCode !== undefined) propStrs.push(`shiftKeyCode: ${escaped.shiftKeyCode}`);
  if (escaped.text !== undefined) propStrs.push(`text: '${escaped.text}'`);
  if (escaped.location !== undefined) propStrs.push(`location: ${escaped.location}`);

  return `{ ${propStrs.join(', ')} }`;
}

const keyboardsDir = path.resolve(__dirname, '../packages/playwright-core/src/server/keyboards');

(async () => {;
  for (const [klid, { layoutName }] of Object.entries(layoutUrls)) {
    console.log(`Generating keyboard layout for ${layoutName} (KLID ${klid})`);
    const layout = await generate(klid);

    const layoutData = [
      copyrightHeader,
      `import type { KeyboardLayout } from '../types';`,
      ``,
      `// KLID ${klid} - ${layoutName}`,
      `const keyboardLayout: KeyboardLayout = {`,
      ...Object.entries(layout).map(([keyName, def]) => `  ${keyName}: ${stringifyKeyDefinition(def)},`),
      `};`,
      ``,
      `export default keyboardLayout;`,
      ``,
    ].join('\n');

    fs.writeFileSync(path.resolve(keyboardsDir, 'layouts', `${klid}.ts`), layoutData, 'utf-8');
  }

  const mapEntries = Object.entries(layoutUrls)
      .flatMap(([klid, { layoutName, locales }]) => locales.map(locale => `  ['${locale.replace(/-/g, '_').toLowerCase()}', '${klid}'], // ${layoutName}`));

  const index = [
    copyrightHeader,
    `import defaultKeyboardLayoutObject from './layouts/${defaultKlid}';`,
    `import type { KeyboardLayout } from './types';`,
    ``,
    `export type * from './types';`,
    `export const defaultKlid = '${defaultKlid}';`,
    `export const defaultKeyboardLayout: KeyboardLayout = defaultKeyboardLayoutObject;`,
    ``,
    `export const localeMapping = new Map<string, string>([`,
    ...mapEntries,
    `]);`,
    ``,
    `export const keypadLocation = 3;`,
    ``,
  ].join('\n');

  fs.writeFileSync(path.resolve(keyboardsDir, 'index.ts'), index, 'utf-8');
})();
