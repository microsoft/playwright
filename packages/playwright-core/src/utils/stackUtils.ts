/**
 * The MIT License (MIT)
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Copyright (c) 2016-2023 Isaac Z. Schlueter i@izs.me, James Talmage james@talmage.io (github.com/jamestalmage), and
 * Contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 * Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as url from 'url';

type StackData = {
  line?: number;
  column?: number;
  file?: string;
  isConstructor?: boolean;
  evalOrigin?: string;
  native?: boolean;
  function?: string;
  method?: string;
  evalLine?: number | undefined;
  evalColumn?: number | undefined;
  evalFile?: string | undefined;
};

export function parseStackFrame(line: string): StackData | null {
  const match = line && line.match(re);
  if (!match)
    return null;

  const ctor = match[1] === 'new';
  let fname = match[2];
  const evalOrigin = match[3];
  const evalFile = match[4];
  const evalLine = Number(match[5]);
  const evalCol = Number(match[6]);
  let file = match[7];
  const lnum = match[8];
  const col = match[9];
  const native = match[10] === 'native';
  const closeParen = match[11] === ')';
  let method;

  const res: StackData = {};

  if (lnum)
    res.line = Number(lnum);

  if (col)
    res.column = Number(col);

  if (closeParen && file) {
    // make sure parens are balanced
    // if we have a file like "asdf) [as foo] (xyz.js", then odds are
    // that the fname should be += " (asdf) [as foo]" and the file
    // should be just "xyz.js"
    // walk backwards from the end to find the last unbalanced (
    let closes = 0;
    for (let i = file.length - 1; i > 0; i--) {
      if (file.charAt(i) === ')') {
        closes++;
      } else if (file.charAt(i) === '(' && file.charAt(i - 1) === ' ') {
        closes--;
        if (closes === -1 && file.charAt(i - 1) === ' ') {
          const before = file.slice(0, i - 1);
          const after = file.slice(i + 1);
          file = after;
          fname += ` (${before}`;
          break;
        }
      }
    }
  }

  if (fname) {
    const methodMatch = fname.match(methodRe);
    if (methodMatch) {
      fname = methodMatch[1];
      method = methodMatch[2];
    }
  }

  setFile(res, file);

  if (ctor)
    res.isConstructor = true;

  if (evalOrigin) {
    res.evalOrigin = evalOrigin;
    res.evalLine = evalLine;
    res.evalColumn = evalCol;
    res.evalFile = evalFile && evalFile.replace(/\\/g, '/');
  }

  if (native)
    res.native = true;
  if (fname)
    res.function = fname;
  if (method && fname !== method)
    res.method = method;
  return res;
}

function setFile(result: StackData, filename: string) {
  if (filename) {
    if (filename.startsWith('file://'))
      filename = url.fileURLToPath(filename);
    result.file = filename;
  }
}

const re = new RegExp('^' +
  // Sometimes we strip out the '    at' because it's noisy
  '(?:\\s*at )?' +
  // $1 = ctor if 'new'
  '(?:(new) )?' +
  // $2 = function name (can be literally anything)
  // May contain method at the end as [as xyz]
  '(?:(.*?) \\()?' +
  // (eval at <anonymous> (file.js:1:1),
  // $3 = eval origin
  // $4:$5:$6 are eval file/line/col, but not normally reported
  '(?:eval at ([^ ]+) \\((.+?):(\\d+):(\\d+)\\), )?' +
  // file:line:col
  // $7:$8:$9
  // $10 = 'native' if native
  '(?:(.+?):(\\d+):(\\d+)|(native))' +
  // maybe close the paren, then end
  // if $11 is ), then we only allow balanced parens in the filename
  // any imbalance is placed on the fname.  This is a heuristic, and
  // bound to be incorrect in some edge cases.  The bet is that
  // having weird characters in method names is more common than
  // having weird characters in filenames, which seems reasonable.
  '(\\)?)$'
);

const methodRe = /^(.*?) \[as (.*?)\]$/;
