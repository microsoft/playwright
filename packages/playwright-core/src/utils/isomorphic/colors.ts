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

export const colors = {
  enabled: true,
  reset: (text: string) => applyStyle(0, 0, text),

  bold: (text: string) => applyStyle(1, 22, text),
  dim: (text: string) => applyStyle(2, 22, text),
  italic: (text: string) => applyStyle(3, 23, text),
  underline: (text: string) => applyStyle(4, 24, text),
  inverse: (text: string) => applyStyle(7, 27, text),
  hidden: (text: string) => applyStyle(8, 28, text),
  strikethrough: (text: string) => applyStyle(9, 29, text),

  black: (text: string) => applyStyle(30, 39, text),
  red: (text: string) => applyStyle(31, 39, text),
  green: (text: string) => applyStyle(32, 39, text),
  yellow: (text: string) => applyStyle(33, 39, text),
  blue: (text: string) => applyStyle(34, 39, text),
  magenta: (text: string) => applyStyle(35, 39, text),
  cyan: (text: string) => applyStyle(36, 39, text),
  white: (text: string) => applyStyle(37, 39, text),
  gray: (text: string) => applyStyle(90, 39, text),
  grey: (text: string) => applyStyle(90, 39, text),

  brightRed: (text: string) => applyStyle(91, 39, text),
  brightGreen: (text: string) => applyStyle(92, 39, text),
  brightYellow: (text: string) => applyStyle(93, 39, text),
  brightBlue: (text: string) => applyStyle(94, 39, text),
  brightMagenta: (text: string) => applyStyle(95, 39, text),
  brightCyan: (text: string) => applyStyle(96, 39, text),
  brightWhite: (text: string) => applyStyle(97, 39, text),

  bgBlack: (text: string) => applyStyle(40, 49, text),
  bgRed: (text: string) => applyStyle(41, 49, text),
  bgGreen: (text: string) => applyStyle(42, 49, text),
  bgYellow: (text: string) => applyStyle(43, 49, text),
  bgBlue: (text: string) => applyStyle(44, 49, text),
  bgMagenta: (text: string) => applyStyle(45, 49, text),
  bgCyan: (text: string) => applyStyle(46, 49, text),
  bgWhite: (text: string) => applyStyle(47, 49, text),
  bgGray: (text: string) => applyStyle(100, 49, text),
  bgGrey: (text: string) => applyStyle(100, 49, text),

  bgBrightRed: (text: string) => applyStyle(101, 49, text),
  bgBrightGreen: (text: string) => applyStyle(102, 49, text),
  bgBrightYellow: (text: string) => applyStyle(103, 49, text),
  bgBrightBlue: (text: string) => applyStyle(104, 49, text),
  bgBrightMagenta: (text: string) => applyStyle(105, 49, text),
  bgBrightCyan: (text: string) => applyStyle(106, 49, text),
  bgBrightWhite: (text: string) => applyStyle(107, 49, text),
};

type Colors = typeof colors;

export const noColors: Colors = {
  enabled: false,
  reset: t => t,
  bold: t => t,
  dim: t => t,
  italic: t => t,
  underline: t => t,
  inverse: t => t,
  hidden: t => t,
  strikethrough: t => t,
  black: t => t,
  red: t => t,
  green: t => t,
  yellow: t => t,
  blue: t => t,
  magenta: t => t,
  cyan: t => t,
  white: t => t,
  gray: t => t,
  grey: t => t,
  brightRed: t => t,
  brightGreen: t => t,
  brightYellow: t => t,
  brightBlue: t => t,
  brightMagenta: t => t,
  brightCyan: t => t,
  brightWhite: t => t,
  bgBlack: t => t,
  bgRed: t => t,
  bgGreen: t => t,
  bgYellow: t => t,
  bgBlue: t => t,
  bgMagenta: t => t,
  bgCyan: t => t,
  bgWhite: t => t,
  bgGray: t => t,
  bgGrey: t => t,
  bgBrightRed: t => t,
  bgBrightGreen: t => t,
  bgBrightYellow: t => t,
  bgBrightBlue: t => t,
  bgBrightMagenta: t => t,
  bgBrightCyan: t => t,
  bgBrightWhite: t => t
};


const applyStyle = (open: number, close: number, text: string) => `\u001b[${open}m${text}\u001b[${close}m`;
