/**
 * MIT License
 *
 * Copyright (c) 2013 James Halliday and contributors
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export interface MinimistOptions {
  string?: string | string[];
  boolean?: string | string[];
}

export interface MinimistArgs {
  _: string[];
  [key: string]: string | boolean | string[] | undefined;
}

export function minimist(args: string[], opts?: MinimistOptions): MinimistArgs {
  if (!opts)
    opts = {};

  const bools: Record<string, boolean> = {};
  const strings: Record<string, boolean> = {};

  for (const key of toArray(opts.boolean))
    bools[key] = true;

  for (const key of toArray(opts.string))
    strings[key] = true;

  const argv: MinimistArgs = { _: [] };

  function setArg(key: string, val: string | boolean): void {
    if (argv[key] === undefined || bools[key] || typeof argv[key] === 'boolean')
      argv[key] = val;
    else if (Array.isArray(argv[key]))
      (argv[key] as string[]).push(val as string);
    else
      argv[key] = [argv[key] as string, val as string];
  }

  let notFlags: string[] = [];
  const doubleDashIndex = args.indexOf('--');
  if (doubleDashIndex !== -1) {
    notFlags = args.slice(doubleDashIndex + 1);
    args = args.slice(0, doubleDashIndex);
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    let key: string;
    let next: string;

    if ((/^--.+=/).test(arg)) {
      const m = arg.match(/^--([^=]+)=([\s\S]*)$/)!;
      key = m[1];
      if (bools[key])
        throw new Error(`boolean option '--${key}' should not be passed with '=value', use '--${key}' or '--no-${key}' instead`);
      setArg(key, m[2]);
    } else if ((/^--no-.+/).test(arg)) {
      key = arg.match(/^--no-(.+)/)![1];
      setArg(key, false);
    } else if ((/^--.+/).test(arg)) {
      key = arg.match(/^--(.+)/)![1];
      next = args[i + 1];
      if (
        next !== undefined
        && !(/^(-|--)[^-]/).test(next)
        && !bools[key]
      ) {
        setArg(key, next);
        i += 1;
      } else if ((/^(true|false)$/).test(next)) {
        setArg(key, next === 'true');
        i += 1;
      } else {
        setArg(key, strings[key] ? '' : true);
      }
    } else if ((/^-[^-]+/).test(arg)) {
      const letters = arg.slice(1, -1).split('');

      let broken = false;
      for (let j = 0; j < letters.length; j++) {
        next = arg.slice(j + 2);

        if (next === '-') {
          setArg(letters[j], next);
          continue;
        }

        if ((/[A-Za-z]/).test(letters[j]) && next[0] === '=') {
          setArg(letters[j], next.slice(1));
          broken = true;
          break;
        }

        if (
          (/[A-Za-z]/).test(letters[j])
          && (/-?\d+(\.\d*)?(e-?\d+)?$/).test(next)
        ) {
          setArg(letters[j], next);
          broken = true;
          break;
        }

        if (letters[j + 1] && letters[j + 1].match(/\W/)) {
          setArg(letters[j], arg.slice(j + 2));
          broken = true;
          break;
        } else {
          setArg(letters[j], strings[letters[j]] ? '' : true);
        }
      }

      key = arg.slice(-1)[0];
      if (!broken && key !== '-') {
        if (
          args[i + 1]
          && !(/^(-|--)[^-]/).test(args[i + 1])
          && !bools[key]
        ) {
          setArg(key, args[i + 1]);
          i += 1;
        } else if (args[i + 1] && (/^(true|false)$/).test(args[i + 1])) {
          setArg(key, args[i + 1] === 'true');
          i += 1;
        } else {
          setArg(key, strings[key] ? '' : true);
        }
      }
    } else {
      argv._.push(arg);
    }
  }

  for (const k of notFlags)
    argv._.push(k);

  return argv;
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value)
    return [];
  return Array.isArray(value) ? value : [value];
}
