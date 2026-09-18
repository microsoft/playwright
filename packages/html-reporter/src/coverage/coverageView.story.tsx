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

import * as React from 'react';
import { CoverageView } from './coverageView';
import { createMemoryCoverage } from './loadedCoverage';

import type { CoverageFile } from '../types';

const appSource = [
  `export function greet(name) {`,
  `  if (name)`,
  `    return 'Hello, ' + name;`,
  `  return 'Hello';`,
  `}`,
  ``,
  `export function unused(value) {`,
  `  return value ? 'yes' : 'no';`,
  `}`,
].join('\n');

const app: CoverageFile = {
  path: '/home/user/project/src/app.js',
  source: appSource,
  coverage: {
    path: '/home/user/project/src/app.js',
    statementMap: {
      '0': { start: { line: 2, column: 2 }, end: { line: 4, column: 17 } },
      '1': { start: { line: 3, column: 4 }, end: { line: 3, column: 28 } },
      '2': { start: { line: 4, column: 2 }, end: { line: 4, column: 17 } },
      '3': { start: { line: 8, column: 2 }, end: { line: 8, column: 30 } },
    },
    fnMap: {
      '0': { name: 'greet', decl: { start: { line: 1, column: 16 }, end: { line: 1, column: 21 } }, loc: { start: { line: 1, column: 28 }, end: { line: 5, column: 1 } }, line: 1 },
      '1': { name: 'unused', decl: { start: { line: 7, column: 16 }, end: { line: 7, column: 22 } }, loc: { start: { line: 7, column: 30 }, end: { line: 9, column: 1 } }, line: 7 },
    },
    branchMap: {
      '0': { type: 'if', loc: { start: { line: 2, column: 2 }, end: { line: 4, column: 17 } }, locations: [{ start: { line: 2, column: 2 }, end: { line: 4, column: 17 } }, { start: {} as any, end: {} as any }], line: 2 },
      '1': { type: 'cond-expr', loc: { start: { line: 8, column: 9 }, end: { line: 8, column: 29 } }, locations: [{ start: { line: 8, column: 17 }, end: { line: 8, column: 22 } }, { start: { line: 8, column: 25 }, end: { line: 8, column: 29 } }], line: 8 },
    },
    s: { '0': 3, '1': 3, '2': 0, '3': 0 },
    f: { '0': 3, '1': 0 },
    b: { '0': [3, 0], '1': [0, 0] },
  },
};

const button: CoverageFile = {
  path: '/home/user/project/src/components/button.tsx',
  source: [
    `export const Button = ({ label }) => {`,
    `  return <button>{label}</button>;`,
    `};`,
  ].join('\n'),
  coverage: {
    path: '/home/user/project/src/components/button.tsx',
    statementMap: {
      '0': { start: { line: 1, column: 22 }, end: { line: 3, column: 1 } },
      '1': { start: { line: 2, column: 2 }, end: { line: 2, column: 34 } },
    },
    fnMap: {
      '0': { name: 'Button', decl: { start: { line: 1, column: 13 }, end: { line: 1, column: 19 } }, loc: { start: { line: 1, column: 22 }, end: { line: 3, column: 1 } }, line: 1 },
    },
    branchMap: {},
    s: { '0': 1, '1': 5 },
    f: { '0': 5 },
    b: {},
  },
};

const util: CoverageFile = {
  path: '/home/user/project/lib/util.js',
  coverage: {
    path: '/home/user/project/lib/util.js',
    statementMap: {
      '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
    },
    fnMap: {},
    branchMap: {},
    s: { '0': 0 },
    f: {},
    b: {},
  },
};

const defaultCoverage = createMemoryCoverage([app, button, util]);
const emptyCoverage = createMemoryCoverage([]);

export const Default = () => <CoverageView coverage={defaultCoverage} />;

export const Empty = () => <CoverageView coverage={emptyCoverage} />;
