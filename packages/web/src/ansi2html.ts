/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

export function ansi2html(text: string, defaultColors?: { bg: string, fg: string }): string {
  const regex = /(\x1b\[(\d+(;\d+)*)m)|([^\x1b]+)/g;
  const tokens: string[] = [];
  let match;
  let style: any = {};

  let reverse = false;
  let fg: string | undefined = defaultColors?.fg;
  let bg: string | undefined = defaultColors?.bg;

  while ((match = regex.exec(text)) !== null) {
    const [, , codeStr, , text] = match;
    if (codeStr) {
      const code = +codeStr;
      switch (code) {
        case 0: style = {}; break;
        case 1: style['font-weight'] = 'bold'; break;
        case 2: style['opacity'] = '0.8'; break;
        case 3: style['font-style'] = 'italic'; break;
        case 4: style['text-decoration'] = 'underline'; break;
        case 7:
          reverse = true;
          break;
        case 8: style.display = 'none'; break;
        case 9: style['text-decoration'] = 'line-through'; break;
        case 22:
          delete style['font-weight'];
          delete style['font-style'];
          delete style['opacity'];
          delete style['text-decoration'];
          break;
        case 23:
          delete style['font-weight'];
          delete style['font-style'];
          delete style['opacity'];
          break;
        case 24:
          delete style['text-decoration'];
          break;
        case 27:
          reverse = false;
          break;
        case 30:
        case 31:
        case 32:
        case 33:
        case 34:
        case 35:
        case 36:
        case 37:
          fg = ansiColors[code - 30];
          break;
        case 39:
          fg = defaultColors?.fg;
          break;
        case 40:
        case 41:
        case 42:
        case 43:
        case 44:
        case 45:
        case 46:
        case 47:
          bg = ansiColors[code - 40];
          break;
        case 49:
          bg = defaultColors?.bg;
          break;
        case 53: style['text-decoration'] = 'overline'; break;
        case 90:
        case 91:
        case 92:
        case 93:
        case 94:
        case 95:
        case 96:
        case 97:
          fg = brightAnsiColors[code - 90];
          break;
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
          bg = brightAnsiColors[code - 100];
          break;
      }
    } else if (text) {
      const styleCopy = { ...style };
      const color = reverse ? bg : fg;
      if (color !== undefined)
        styleCopy['color'] = color;
      const backgroundColor = reverse ? fg : bg;
      if (backgroundColor !== undefined)
        styleCopy['background-color'] = backgroundColor;
      tokens.push(`<span style="${styleBody(styleCopy)}">${escapeHTML(text)}</span>`);
    }
  }
  return tokens.join('');
}

const ansiColors: Record<number, string> = {
  0: 'var(--vscode-terminal-ansiBlack)',
  1: 'var(--vscode-terminal-ansiRed)',
  2: 'var(--vscode-terminal-ansiGreen)',
  3: 'var(--vscode-terminal-ansiYellow)',
  4: 'var(--vscode-terminal-ansiBlue)',
  5: 'var(--vscode-terminal-ansiMagenta)',
  6: 'var(--vscode-terminal-ansiCyan)',
  7: 'var(--vscode-terminal-ansiWhite)',
};

const brightAnsiColors: Record<number, string> = {
  0: 'var(--vscode-terminal-ansiBrightBlack)',
  1: 'var(--vscode-terminal-ansiBrightRed)',
  2: 'var(--vscode-terminal-ansiBrightGreen)',
  3: 'var(--vscode-terminal-ansiBrightYellow)',
  4: 'var(--vscode-terminal-ansiBrightBlue)',
  5: 'var(--vscode-terminal-ansiBrightMagenta)',
  6: 'var(--vscode-terminal-ansiBrightCyan)',
  7: 'var(--vscode-terminal-ansiBrightWhite)',
};

function escapeHTML(text: string): string {
  return text.replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]!));
}

function styleBody(style: any): string {
  return Object.entries(style).map(([name, value]) => `${name}: ${value}`).join('; ');
}
