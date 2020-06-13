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

export class Formatter {
  private _baseIndent: string;
  private _baseOffset: string;
  private _lines: string[] = [];

  constructor(offset = 0) {
    this._baseIndent = ' '.repeat(2);
    this._baseOffset = ' '.repeat(offset);
  }

  prepend(text: string) {
    this._lines = text.trim().split('\n').map(line => line.trim()).concat(this._lines);
  }

  add(text: string) {
    this._lines.push(...text.trim().split('\n').map(line => line.trim()));
  }

  newLine() {
    this._lines.push('');
  }

  format(): string {
    let spaces = '';
    let previousLine = '';
    return this._lines.map((line: string) => {
      if (line === '')
        return line;
      if (line.startsWith('}') || line.startsWith(']'))
        spaces = spaces.substring(this._baseIndent.length);

      const extraSpaces = /^(for|while|if).*\(.*\)$/.test(previousLine) ? this._baseIndent : '';
      previousLine = line;

      line = spaces + extraSpaces + line;
      if (line.endsWith('{') || line.endsWith('['))
        spaces += this._baseIndent;
      return this._baseOffset + line;
    }).join('\n');
  }
}

type StringFormatter = (s: string) => string;

export const formatColors: { cst: StringFormatter; kwd: StringFormatter; fnc: StringFormatter; prp: StringFormatter, str: StringFormatter; cmt: StringFormatter } = {
  cst: text => `\u001b[38;5;72m${text}\x1b[0m`,
  kwd: text => `\u001b[38;5;39m${text}\x1b[0m`,
  fnc: text => `\u001b[38;5;223m${text}\x1b[0m`,
  prp: text => `\u001b[38;5;159m${text}\x1b[0m`,
  str: text => `\u001b[38;5;130m${quote(text)}\x1b[0m`,
  cmt: text => `\u001b[38;5;23m// ${text}\x1b[0m`
};

function quote(text: string, char: string = '\'') {
  if (char === '\'')
    return char + text.replace(/[']/g, '\\\'').replace(/\\/g, '\\\\') + char;
  if (char === '"')
    return char + text.replace(/["]/g, '\\"').replace(/\\/g, '\\\\') + char;
  if (char === '`')
    return char + text.replace(/[`]/g, '\\`').replace(/\\/g, '\\\\') + char;
  throw new Error('Invalid escape char');
}
