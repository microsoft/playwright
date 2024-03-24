/**
* Copyright Microsoft Corporation. All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import type { WriteStream } from 'tty';
import { colors as realColors } from 'playwright-core/lib/utilsBundle';

export type TTYParams = {
  rows: number;
  columns: number;
  colorDepth: number;
};

function getTTYParams(stream: WriteStream): TTYParams | undefined {
  // Explicitly disabled.
  if (process.env.PLAYWRIGHT_TTY === 'false' || process.env.PLAYWRIGHT_TTY === '0')
    return;

  // Format is COLUMNS[xROWS[xDEPTH]] similar to xvfb screen.
  const match = (process.env.PLAYWRIGHT_TTY || '').match(/^(\d+)(?:x(\d+))?(?:x(\d+))?$/);
  if (!match && !stream.isTTY)
    return;

  // Use an override from PLAYWRIGHT_TTY or the real value for each.
  return {
    columns: match?.[1] ? +match[1] : (stream.isTTY ? stream.columns : 0),
    rows: match?.[2] ? +match[2] : (stream.isTTY ? stream.rows : 0),
    colorDepth: match?.[3] ? +match[3] : (stream.isTTY ? (stream.getColorDepth?.() || 8) : 8),
  };
}

export const stdoutTTY = getTTYParams(process.stdout);
export const stderrTTY = getTTYParams(process.stderr);

let useColors = !!stdoutTTY;
if (process.env.DEBUG_COLORS === '0'
    || process.env.DEBUG_COLORS === 'false'
    || process.env.FORCE_COLOR === '0'
    || process.env.FORCE_COLOR === 'false')
  useColors = false;
else if (process.env.DEBUG_COLORS || process.env.FORCE_COLOR)
  useColors = true;

export const colors = useColors ? realColors : {
  bold: (t: string) => t,
  cyan: (t: string) => t,
  dim: (t: string) => t,
  gray: (t: string) => t,
  green: (t: string) => t,
  red: (t: string) => t,
  yellow: (t: string) => t,
  enabled: false,
};

export function setTTYParams(stream: WriteStream, params: TTYParams | undefined) {
  if (!params) {
    stream.isTTY = false;
    stream.rows = 0;
    stream.columns = 0;
    stream.getColorDepth = () => 8;
    return;
  }

  stream.isTTY = true;
  if (params.rows)
    stream.rows = params.rows;
  if (params.columns)
    stream.columns = params.columns;
  stream.getColorDepth = () => params.colorDepth;
  stream.hasColors = ((count = 16) => {
    // count is optional and the first argument may actually be env.
    if (typeof count !== 'number')
      count = 16;
    return count <= 2 ** params.colorDepth;
  })as any;

  // Stubs for the rest of the methods to avoid exceptions in user code.
  stream.clearLine = (dir: any, callback?: () => void) => {
    callback?.();
    return true;
  };
  stream.clearScreenDown = (callback?: () => void) => {
    callback?.();
    return true;
  };
  (stream as any).cursorTo = (x: number, y?: number | (() => void), callback?: () => void) => {
    if (callback)
      callback();
    else if (y instanceof Function)
      y();
    return true;
  };
  stream.moveCursor = (dx: number, dy: number, callback?: () => void) => {
    callback?.();
    return true;
  };
  stream.getWindowSize = () => [stream.columns, stream.rows];
}

export function resizeTTY(columns: number, rows: number) {
  if (stdoutTTY) {
    process.stdout.columns = stdoutTTY.columns = columns;
    process.stdout.rows = stdoutTTY.rows = rows;
  }
  if (stderrTTY) {
    process.stderr.columns = stderrTTY.rows = rows;
    process.stderr.rows = stderrTTY.columns = columns;
  }
}
