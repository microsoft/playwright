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

import { test, expect } from '@playwright/test';
import { codeFrame } from '../../../packages/isomorphic/codeFrame';
import { noColors } from '../../../packages/isomorphic/colors';

import type { Colors } from '../../../packages/isomorphic/colors';

const tagColors = Object.fromEntries(Object.keys(noColors).map(name => [name, name === 'enabled' ? true : (text: string) => `<${name}>${text}</${name}>`])) as Colors;

const source = Array.from({ length: 12 }, (_, i) => `line${i + 1} = foo(${i + 1});`).join('\n');

test('should mark the column', () => {
  expect(codeFrame(source, { line: 5, column: 3 })).toBe([
    '  3 | line3 = foo(3);',
    '  4 | line4 = foo(4);',
    '> 5 | line5 = foo(5);',
    '    |   ^',
    '  6 | line6 = foo(6);',
    '  7 | line7 = foo(7);',
    '  8 | line8 = foo(8);',
  ].join('\n'));
});

test('should mark the line without a column', () => {
  expect(codeFrame(source, { line: 5 })).toBe([
    '  3 | line3 = foo(3);',
    '  4 | line4 = foo(4);',
    '> 5 | line5 = foo(5);',
    '  6 | line6 = foo(6);',
    '  7 | line7 = foo(7);',
    '  8 | line8 = foo(8);',
  ].join('\n'));
});

test('should respect linesAbove and linesBelow', () => {
  expect(codeFrame(source, { line: 6, column: 2 }, { linesAbove: 0, linesBelow: 1 })).toBe([
    '> 6 | line6 = foo(6);',
    '    |  ^',
    '  7 | line7 = foo(7);',
  ].join('\n'));
});

test('should clip to the source lines', () => {
  expect(codeFrame(source, { line: 12, column: 2 })).toBe([
    '  10 | line10 = foo(10);',
    '  11 | line11 = foo(11);',
    '> 12 | line12 = foo(12);',
    '     |  ^',
  ].join('\n'));
});

test('should pad line numbers to the widest one', () => {
  expect(codeFrame(source, { line: 9, column: 1 })).toBe([
    '   7 | line7 = foo(7);',
    '   8 | line8 = foo(8);',
    '>  9 | line9 = foo(9);',
    '     | ^',
    '  10 | line10 = foo(10);',
    '  11 | line11 = foo(11);',
    '  12 | line12 = foo(12);',
  ].join('\n'));
});

test('should print the message after the marker', () => {
  expect(codeFrame(source, { line: 5, column: 3 }, { linesAbove: 0, linesBelow: 0, message: 'Boom' })).toBe([
    '> 5 | line5 = foo(5);',
    '    |   ^ Boom',
  ].join('\n'));
});

test('should print the message above the frame without a column', () => {
  expect(codeFrame(source, { line: 5 }, { linesAbove: 0, linesBelow: 0, message: 'Boom' })).toBe([
    '  Boom',
    '> 5 | line5 = foo(5);',
  ].join('\n'));
});

test('should keep tabs before the marker', () => {
  expect(codeFrame('a\n\t\tfoo(\tbar)\nb', { line: 2, column: 6 })).toBe([
    '  1 | a',
    '> 2 | \t\tfoo(\tbar)',
    '    | \t\t   ^',
    '  3 | b',
  ].join('\n'));
});

test('should not add a space after the gutter for empty lines', () => {
  expect(codeFrame('a\n\nfoo\n   \nb', { line: 3, column: 1 })).toBe([
    '  1 | a',
    '  2 |',
    '> 3 | foo',
    '    | ^',
    '  4 |    ',
    '  5 | b',
  ].join('\n'));
});

test('should split lines on all line terminators', () => {
  expect(codeFrame('a\r\nb\rc\u2028d\ne', { line: 3, column: 1 }, { linesAbove: 5, linesBelow: 5 })).toBe([
    '  1 | a',
    '  2 | b',
    '> 3 | c',
    '    | ^',
    '  4 | d',
    '  5 | e',
  ].join('\n'));
});

test('should highlight code', () => {
  const code = `const page = new Page(/re/g, 'a', 42) + x; // comment`;
  expect(codeFrame(code, { line: 1, column: 7 }, { colors: tagColors, message: 'Boom' })).toBe([
    '<red><bold>></bold></red><gray> 1 |</gray> ' +
      '<cyan>const</cyan> page <yellow>=</yellow> <cyan>new</cyan> <yellow>Page</yellow>(<magenta>/re/g</magenta><yellow>,</yellow> ' +
      `<green>'a'</green><yellow>,</yellow> <magenta>42</magenta>) <yellow>+</yellow> x<yellow>;</yellow> <gray>// comment</gray>`,
    ' <gray>   |</gray>       <red><bold>^</bold></red> <red><bold>Boom</bold></red>',
  ].join('\n'));
});

test('should highlight multi-line tokens on each line', () => {
  expect(codeFrame('a = `x ${`y`}\nz`; /* b\nc */', { line: 1 }, { colors: tagColors })).toBe([
    '<red><bold>></bold></red><gray> 1 |</gray> a <yellow>=</yellow> <green>`x ${`y`}</green>',
    ' <gray> 2 |</gray> <green>z`</green><yellow>;</yellow> <gray>/* b</gray>',
    ' <gray> 3 |</gray> <gray>c */</gray>',
  ].join('\n'));
});

test('should highlight keywords used as property names as identifiers', () => {
  expect(codeFrame('promise.catch(e => e).finally(done);', { line: 1 }, { colors: tagColors })).toBe(
      '<red><bold>></bold></red><gray> 1 |</gray> promise<yellow>.</yellow>catch(e <yellow>=></yellow> e)<yellow>.</yellow>finally(done)<yellow>;</yellow>'
  );
});
