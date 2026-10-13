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

import { noColors } from './colors';

import type { Colors } from './colors';

export type CodeFrameLocation = {
  line: number;
  column?: number;
};

export type CodeFrameOptions = {
  colors?: Colors;
  linesAbove?: number;
  linesBelow?: number;
  message?: string;
};

const kLineBreak = /\r\n|[\n\r\u2028\u2029]/;

export function codeFrame(source: string, location: CodeFrameLocation, options: CodeFrameOptions = {}): string {
  const colors = options.colors ?? noColors;
  const rawLines = source.split(kLineBreak);
  const lines = colors.enabled ? highlight(source, colors).split(kLineBreak) : rawLines;
  const first = Math.max(location.line - (options.linesAbove ?? 2), 1);
  const last = Math.min(location.line + (options.linesBelow ?? 3), rawLines.length);
  const width = String(last).length;
  const column = location.column || 0;

  const frame: string[] = [];
  for (let lineNumber = first; lineNumber <= last; lineNumber++) {
    const rawLine = rawLines[lineNumber - 1];
    const isMarked = lineNumber === location.line;
    const gutter = colors.gray(` ${String(lineNumber).padStart(width)} |`);
    frame.push((isMarked ? colors.red(colors.bold('>')) : ' ') + gutter + (rawLine ? ' ' + lines[lineNumber - 1] : ''));
    if (!isMarked || !column)
      continue;
    const spacing = rawLine.slice(0, column - 1).replace(/[^\t]/g, ' ');
    const message = options.message ? ' ' + colors.red(colors.bold(options.message)) : '';
    frame.push(' ' + colors.gray(` ${' '.repeat(width)} |`) + ' ' + spacing + colors.red(colors.bold('^')) + message);
  }
  if (options.message && location.column === undefined)
    return ' '.repeat(width + 1) + options.message + '\n' + frame.join('\n');
  return frame.join('\n');
}

const kKeywords = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in',
  'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
  'var', 'void', 'while', 'with', 'yield',
  'implements', 'interface', 'let', 'package', 'private', 'protected', 'public', 'static',
  'as', 'async', 'from', 'get', 'of', 'set',
]);

const kValueKeywords = new Set(['this', 'super', 'null', 'true', 'false']);

type TokenType = 'whitespace' | 'comment' | 'string' | 'regex' | 'number' | 'name' | 'punctuator' | 'bracket' | 'other';

// Returns the end of the token starting at `index`, or `index` when there is no match.
type Matcher = (source: string, index: number) => number;

function regexMatcher(regex: RegExp): Matcher {
  return (source, index) => {
    regex.lastIndex = index;
    return regex.exec(source) ? regex.lastIndex : index;
  };
}

const quotedString = regexMatcher(/'(?:[^'\\\n\r]|\\[\s\S])*'?|"(?:[^"\\\n\r]|\\[\s\S])*"?/y);

function templateEnd(source: string, index: number): number {
  if (source[index] !== '`')
    return index;
  for (let i = index + 1; i < source.length; i++) {
    if (source[i] === '\\')
      i++;
    else if (source[i] === '`')
      return i + 1;
    else if (source[i] === '$' && source[i + 1] === '{')
      i = substitutionEnd(source, i + 2) - 1;
  }
  return source.length;
}

function substitutionEnd(source: string, index: number): number {
  let depth = 1;
  for (let i = index; i < source.length;) {
    const end = Math.max(templateEnd(source, i), quotedString(source, i));
    if (end > i) {
      i = end;
      continue;
    }
    if (source[i] === '{')
      depth++;
    else if (source[i] === '}' && --depth === 0)
      return i + 1;
    i++;
  }
  return source.length;
}

const kTokens: [TokenType, Matcher][] = [
  ['whitespace', regexMatcher(/\s+/y)],
  ['comment', regexMatcher(/\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/y)],
  ['string', (source, index) => Math.max(quotedString(source, index), templateEnd(source, index))],
  ['regex', regexMatcher(/\/(?:[^/\\[\n\r]|\\.|\[(?:[^\]\\\n\r]|\\.)*\])+\/[a-z]*/y)],
  ['number', regexMatcher(/(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?/y)],
  ['name', regexMatcher(/#?[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*/uy)],
  ['bracket', regexMatcher(/[()[\]{}]/y)],
  ['punctuator', regexMatcher(/<\/(?=[\p{ID_Start}>])|\.\.\.|>>>=?|\*\*=?|&&=?|\|\|=?|\?\?=?|\?\.(?!\d)|=>|\+\+|--|<<=?|>>=?|[=!]=?=?|[<>+\-*/%&|^]=?|[~?:;,.@]/uy)],
  ['other', (source, index) => index + 1],
];

function highlight(source: string, colors: Colors): string {
  const result: string[] = [];
  let previous: { type: TokenType, text: string, end: number } | undefined;
  for (let index = 0; index < source.length;) {
    for (const [type, matcher] of kTokens) {
      if (type === 'regex' && !regexAllowed(previous))
        continue;
      const end = matcher(source, index);
      if (end === index)
        continue;
      const text = source.slice(index, end);
      result.push(colorize(text, tokenColor(type, text, previous, index), colors));
      if (type !== 'whitespace' && type !== 'comment')
        previous = { type, text, end };
      index = end;
      break;
    }
  }
  return result.join('');
}

function regexAllowed(previous: { type: TokenType, text: string } | undefined): boolean {
  if (!previous)
    return true;
  if (previous.type === 'punctuator')
    return true;
  if (previous.type === 'bracket')
    return '([{'.includes(previous.text);
  if (previous.type === 'name')
    return kKeywords.has(previous.text) && !kValueKeywords.has(previous.text);
  return false;
}

type Color = 'cyan' | 'yellow' | 'green' | 'magenta' | 'gray' | undefined;

function tokenColor(type: TokenType, text: string, previous: { type: TokenType, text: string, end: number } | undefined, start: number): Color {
  switch (type) {
    case 'comment': return 'gray';
    case 'string': return 'green';
    case 'regex': return 'magenta';
    case 'number': return 'magenta';
    case 'punctuator': return 'yellow';
    case 'name': {
      const isProperty = previous?.type === 'punctuator' && (previous.text === '.' || previous.text === '?.');
      const isTagName = previous?.type === 'punctuator' && (previous.text === '<' || previous.text === '</') && previous.end === start;
      if (kKeywords.has(text) && !isProperty)
        return 'cyan';
      if (isTagName || /^\p{Lu}/u.test(text))
        return 'yellow';
      return undefined;
    }
  }
  return undefined;
}

function colorize(text: string, color: Color, colors: Colors): string {
  if (!color)
    return text;
  return text.split(/(\r\n|[\n\r\u2028\u2029])/).map((part, i) => i % 2 || !part ? part : colors[color](part)).join('');
}
