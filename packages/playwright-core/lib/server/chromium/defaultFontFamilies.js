"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.platformToFontFamilies = void 0;
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

// DO NOT EDIT: this map is generated from Chromium source code by utils/generate_chromium_default_font_families.js
const platformToFontFamilies = exports.platformToFontFamilies = {
  'linux': {
    'fontFamilies': {
      'standard': 'Times New Roman',
      'fixed': 'Monospace',
      'serif': 'Times New Roman',
      'sansSerif': 'Arial',
      'cursive': 'Comic Sans MS',
      'fantasy': 'Impact'
    }
  },
  'mac': {
    'fontFamilies': {
      'standard': 'Times',
      'fixed': 'Courier',
      'serif': 'Times',
      'sansSerif': 'Helvetica',
      'cursive': 'Apple Chancery',
      'fantasy': 'Papyrus'
    },
    'forScripts': [{
      'script': 'jpan',
      'fontFamilies': {
        'standard': 'Hiragino Kaku Gothic ProN',
        'fixed': 'Osaka-Mono',
        'serif': 'Hiragino Mincho ProN',
        'sansSerif': 'Hiragino Kaku Gothic ProN'
      }
    }, {
      'script': 'hang',
      'fontFamilies': {
        'standard': 'Apple SD Gothic Neo',
        'serif': 'AppleMyungjo',
        'sansSerif': 'Apple SD Gothic Neo'
      }
    }, {
      'script': 'hans',
      'fontFamilies': {
        'standard': ',PingFang SC,STHeiti',
        'serif': 'Songti SC',
        'sansSerif': ',PingFang SC,STHeiti',
        'cursive': 'Kaiti SC'
      }
    }, {
      'script': 'hant',
      'fontFamilies': {
        'standard': ',PingFang TC,Heiti TC',
        'serif': 'Songti TC',
        'sansSerif': ',PingFang TC,Heiti TC',
        'cursive': 'Kaiti TC'
      }
    }]
  },
  'win': {
    'fontFamilies': {
      'standard': 'Times New Roman',
      'fixed': 'Consolas',
      'serif': 'Times New Roman',
      'sansSerif': 'Arial',
      'cursive': 'Comic Sans MS',
      'fantasy': 'Impact'
    },
    'forScripts': [{
      'script': 'cyrl',
      'fontFamilies': {
        'standard': 'Times New Roman',
        'fixed': 'Courier New',
        'serif': 'Times New Roman',
        'sansSerif': 'Arial'
      }
    }, {
      'script': 'arab',
      'fontFamilies': {
        'fixed': 'Courier New',
        'sansSerif': 'Segoe UI'
      }
    }, {
      'script': 'grek',
      'fontFamilies': {
        'standard': 'Times New Roman',
        'fixed': 'Courier New',
        'serif': 'Times New Roman',
        'sansSerif': 'Arial'
      }
    }, {
      'script': 'jpan',
      'fontFamilies': {
        'standard': ',Meiryo,Yu Gothic',
        'fixed': 'MS Gothic',
        'serif': ',Yu Mincho,MS PMincho',
        'sansSerif': ',Meiryo,Yu Gothic'
      }
    }, {
      'script': 'hang',
      'fontFamilies': {
        'standard': 'Malgun Gothic',
        'fixed': 'Gulimche',
        'serif': 'Batang',
        'sansSerif': 'Malgun Gothic',
        'cursive': 'Gungsuh'
      }
    }, {
      'script': 'hans',
      'fontFamilies': {
        'standard': 'Microsoft YaHei',
        'fixed': 'NSimsun',
        'serif': 'Simsun',
        'sansSerif': 'Microsoft YaHei',
        'cursive': 'KaiTi'
      }
    }, {
      'script': 'hant',
      'fontFamilies': {
        'standard': 'Microsoft JhengHei',
        'fixed': 'MingLiU',
        'serif': 'PMingLiU',
        'sansSerif': 'Microsoft JhengHei',
        'cursive': 'DFKai-SB'
      }
    }]
  }
};