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

// The istanbul coverage format, as produced by istanbul-instrumented code in
// the `__coverage__` global and consumed by istanbul report tooling.
// Mirrors the shapes from istanbul-lib-coverage.

export type IstanbulLocation = {
  line: number;
  column: number;
};

export type IstanbulRange = {
  start: IstanbulLocation;
  end: IstanbulLocation;
};

export type IstanbulFunctionMapping = {
  name: string;
  decl: IstanbulRange;
  loc: IstanbulRange;
  line?: number;
};

export type IstanbulBranchMapping = {
  type: string;
  loc: IstanbulRange;
  locations: IstanbulRange[];
  line?: number;
};

export type IstanbulFileCoverage = {
  path: string;
  statementMap: { [key: string]: IstanbulRange };
  fnMap: { [key: string]: IstanbulFunctionMapping };
  branchMap: { [key: string]: IstanbulBranchMapping };
  // Hit counts, keyed by the corresponding map entries above.
  s: { [key: string]: number };
  f: { [key: string]: number };
  b: { [key: string]: number[] };
};

export type IstanbulCoverage = { [file: string]: IstanbulFileCoverage };

// Merges istanbul hit counts: counters add up, map entries are taken from the
// first occurrence of each file. Assumes all data comes from the same build.
export function mergeIstanbulCoverage(into: Map<string, IstanbulFileCoverage>, data: IstanbulCoverage) {
  for (const [file, fileCov] of Object.entries(data)) {
    const existing = into.get(file);
    if (!existing) {
      into.set(file, fileCov);
      continue;
    }
    for (const key of Object.keys(fileCov.s))
      existing.s[key] = (existing.s[key] || 0) + fileCov.s[key];
    for (const key of Object.keys(fileCov.f))
      existing.f[key] = (existing.f[key] || 0) + fileCov.f[key];
    for (const key of Object.keys(fileCov.b)) {
      const branches = existing.b[key] || (existing.b[key] = []);
      fileCov.b[key].forEach((count, i) => branches[i] = (branches[i] || 0) + count);
    }
  }
}
