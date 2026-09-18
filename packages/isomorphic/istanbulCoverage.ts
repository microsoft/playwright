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

// The istanbul coverage format, mirrors the shapes from istanbul-lib-coverage.

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
  s: { [key: string]: number };
  f: { [key: string]: number };
  b: { [key: string]: number[] };
};

export type IstanbulCoverage = { [file: string]: IstanbulFileCoverage };

// The maps are only sent with the first report of each file.
export type IstanbulFileCoverageDelta = Partial<IstanbulFileCoverage> & Pick<IstanbulFileCoverage, 'path' | 's' | 'f' | 'b'>;

export type IstanbulCoverageDelta = { [file: string]: IstanbulFileCoverageDelta };

export const kCoverageStashPrefix = '__pwCoverage.';
export const kCoverageStashError = 'Failed to stash the coverage';

export type IstanbulCoverageChunk = {
  data: IstanbulCoverageDelta;
  id?: string;
};

export function sortedIstanbulCoverage(coverage: Map<string, IstanbulFileCoverage>): IstanbulCoverage {
  return Object.fromEntries([...coverage.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function mergeIstanbulCoverage(into: Map<string, IstanbulFileCoverage>, data: IstanbulCoverageDelta) {
  for (const [file, fileCov] of Object.entries(data)) {
    let existing = into.get(file);
    if (!existing) {
      existing = { path: fileCov.path, statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {} };
      into.set(file, existing);
    }
    // The maps can arrive late if the report that carried them was lost.
    if (fileCov.statementMap && !Object.keys(existing.statementMap).length) {
      existing.statementMap = fileCov.statementMap;
      existing.fnMap = fileCov.fnMap || {};
      existing.branchMap = fileCov.branchMap || {};
      // Reports only carry the counters that were hit, zero fill the rest.
      for (const key of Object.keys(existing.statementMap))
        existing.s[key] = existing.s[key] || 0;
      for (const key of Object.keys(existing.fnMap))
        existing.f[key] = existing.f[key] || 0;
      for (const [key, branch] of Object.entries(existing.branchMap))
        existing.b[key] = existing.b[key] || branch.locations.map(() => 0);
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

export type CoverageMetric = { covered: number, total: number };

export type CoverageSummary = {
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
};

export function emptyCoverageSummary(): CoverageSummary {
  return {
    statements: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 },
  };
}

export function fileCoverageSummary(fileCov: IstanbulFileCoverage): CoverageSummary {
  const summary = emptyCoverageSummary();
  countHits(summary.statements, Object.values(fileCov.s));
  countHits(summary.functions, Object.values(fileCov.f));
  for (const counts of Object.values(fileCov.b))
    countHits(summary.branches, counts);
  countHits(summary.lines, lineCoverage(fileCov).values());
  return summary;
}

export function addCoverageSummary(into: CoverageSummary, summary: CoverageSummary) {
  for (const key of ['statements', 'branches', 'functions', 'lines'] as const) {
    into[key].covered += summary[key].covered;
    into[key].total += summary[key].total;
  }
}

export function coveragePercent(metric: CoverageMetric): number {
  return metric.total ? metric.covered / metric.total * 100 : 100;
}

export function formatCoveragePercent(metric: CoverageMetric): string {
  return coveragePercent(metric).toFixed(2) + '%';
}

// Line coverage is derived from statements, as nyc does.
export function lineCoverage(fileCov: IstanbulFileCoverage): Map<number, number> {
  const lines = new Map<number, number>();
  for (const [key, statement] of Object.entries(fileCov.statementMap)) {
    const line = statement.start.line;
    const count = fileCov.s[key] || 0;
    lines.set(line, Math.max(lines.get(line) || 0, count));
  }
  return lines;
}

function countHits(metric: CoverageMetric, counts: Iterable<number>) {
  for (const count of counts) {
    ++metric.total;
    if (count > 0)
      ++metric.covered;
  }
}
