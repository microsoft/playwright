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

import fs from 'fs';
import path from 'path';

import { mergeIstanbulCoverage } from '@isomorphic/istanbulCoverage';
import { ZipFile } from '@utils/zipFile';
import { resolveReporterOutputPath } from '../util';

import type { IstanbulCoverage, IstanbulFileCoverage } from '@isomorphic/istanbulCoverage';
import type { CommonReporterOptions } from './base';
import type { ReporterV2 } from './reporterV2';
import type { TestCase, TestResult } from '../../types/testReporter';

type CoverageReporterOptions = {
  outputDir?: string,
};

class CoverageReporter implements ReporterV2 {
  private _options: CoverageReporterOptions & CommonReporterOptions;
  private _traceFiles = new Set<string>();

  constructor(options: CoverageReporterOptions & CommonReporterOptions) {
    this._options = options;
  }

  version(): 'v2' {
    return 'v2';
  }

  printsToStdio() {
    return false;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const attachment of result.attachments) {
      if (attachment.name === 'trace' && attachment.path)
        this._traceFiles.add(attachment.path);
    }
  }

  async onEnd() {
    const coverage = new Map<string, IstanbulFileCoverage>();
    for (const traceFile of this._traceFiles) {
      const zipFile = new ZipFile(traceFile);
      try {
        const entries = await zipFile.entries();
        if (entries.includes('coverage.json'))
          mergeIstanbulCoverage(coverage, JSON.parse((await zipFile.read('coverage.json')).toString('utf8')));
      } catch {
      } finally {
        zipFile.close();
      }
    }

    if (!coverage.size) {
      writeLine([
        `\nNo code coverage was collected.`,
        `Make sure the application under test is built with istanbul instrumentation`,
        `(e.g. vite-plugin-istanbul or babel-plugin-istanbul) so that pages expose window.__coverage__,`,
        `and that tracing is configured with coverage, e.g. trace: { mode: 'on', coverage: true }.`,
        `Coverage is aggregated from the tests whose traces are kept.`,
      ].join('\n'));
      return;
    }

    const outputDir = resolveReporterOutputPath('coverage', this._options.configDir, this._options.outputDir);
    await fs.promises.mkdir(outputDir, { recursive: true });
    const mergedJson: IstanbulCoverage = Object.fromEntries([...coverage.entries()].sort(([a], [b]) => a.localeCompare(b)));
    await fs.promises.writeFile(path.join(outputDir, 'coverage-final.json'), JSON.stringify(mergedJson));
    await fs.promises.writeFile(path.join(outputDir, 'lcov.info'), lcovReport(mergedJson));
    const hasHtml = this._tryWriteHtmlReport(mergedJson, outputDir);

    const summary = computeSummary(mergedJson);
    const lines = [
      ``,
      `Code coverage (${coverage.size} files):`,
      `  statements: ${formatMetric(summary.statements)}`,
      `  branches:   ${formatMetric(summary.branches)}`,
      `  functions:  ${formatMetric(summary.functions)}`,
      `  lines:      ${formatMetric(summary.lines)}`,
      `Coverage report written to ${path.relative(process.cwd(), outputDir)}`,
    ];
    if (!hasHtml)
      lines.push(`For an HTML report, install istanbul-lib-coverage, istanbul-lib-report and istanbul-reports, or run 'npx nyc report --temp-dir=${path.relative(process.cwd(), outputDir)} --reporter=html'.`);
    writeLine(lines.join('\n'));
  }

  // Istanbul report libraries are not shipped with Playwright. Use them for the
  // html report when the project has them installed.
  private _tryWriteHtmlReport(mergedJson: IstanbulCoverage, outputDir: string): boolean {
    try {
      const resolveFrom = (name: string) => require.resolve(name, { paths: [this._options.configDir] });
      const libCoverage = require(resolveFrom('istanbul-lib-coverage'));
      const libReport = require(resolveFrom('istanbul-lib-report'));
      const reports = require(resolveFrom('istanbul-reports'));
      const context = libReport.createContext({
        dir: outputDir,
        coverageMap: libCoverage.createCoverageMap(mergedJson),
      });
      reports.create('html').execute(context);
      return true;
    } catch {
      return false;
    }
  }
}

type Metric = { covered: number, total: number };

function computeSummary(mergedJson: IstanbulCoverage) {
  const statements: Metric = { covered: 0, total: 0 };
  const branches: Metric = { covered: 0, total: 0 };
  const functions: Metric = { covered: 0, total: 0 };
  const lines: Metric = { covered: 0, total: 0 };
  for (const fileCov of Object.values(mergedJson)) {
    for (const count of Object.values(fileCov.s)) {
      ++statements.total;
      if (count > 0)
        ++statements.covered;
    }
    for (const count of Object.values(fileCov.f)) {
      ++functions.total;
      if (count > 0)
        ++functions.covered;
    }
    for (const counts of Object.values(fileCov.b)) {
      for (const count of counts) {
        ++branches.total;
        if (count > 0)
          ++branches.covered;
      }
    }
    for (const count of lineCoverage(fileCov).values()) {
      ++lines.total;
      if (count > 0)
        ++lines.covered;
    }
  }
  return { statements, branches, functions, lines };
}

function lineCoverage(fileCov: IstanbulFileCoverage): Map<number, number> {
  const lines = new Map<number, number>();
  for (const [key, statement] of Object.entries(fileCov.statementMap)) {
    const line = statement.start.line;
    const count = fileCov.s[key] || 0;
    lines.set(line, Math.max(lines.get(line) || 0, count));
  }
  return lines;
}

function formatMetric(metric: Metric) {
  const percent = metric.total ? (metric.covered / metric.total * 100).toFixed(2) : '100.00';
  return `${percent}% (${metric.covered}/${metric.total})`;
}

function lcovReport(mergedJson: IstanbulCoverage): string {
  const out: string[] = [];
  for (const [file, fileCov] of Object.entries(mergedJson)) {
    out.push(`SF:${file}`);
    let functionsCovered = 0;
    for (const [key, fn] of Object.entries(fileCov.fnMap)) {
      out.push(`FN:${fn.decl.start.line},${fn.name}`);
      out.push(`FNDA:${fileCov.f[key] || 0},${fn.name}`);
      if (fileCov.f[key] > 0)
        ++functionsCovered;
    }
    out.push(`FNF:${Object.keys(fileCov.fnMap).length}`);
    out.push(`FNH:${functionsCovered}`);
    let branchesFound = 0;
    let branchesCovered = 0;
    for (const [key, branch] of Object.entries(fileCov.branchMap)) {
      const counts: number[] = fileCov.b[key] || [];
      branch.locations.forEach((location, i) => {
        const count = counts[i] || 0;
        out.push(`BRDA:${location.start.line ?? branch.loc.start.line},${key},${i},${count}`);
        ++branchesFound;
        if (count > 0)
          ++branchesCovered;
      });
    }
    out.push(`BRF:${branchesFound}`);
    out.push(`BRH:${branchesCovered}`);
    const lines = lineCoverage(fileCov);
    let linesCovered = 0;
    for (const [line, count] of [...lines.entries()].sort((a, b) => a[0] - b[0])) {
      out.push(`DA:${line},${count}`);
      if (count > 0)
        ++linesCovered;
    }
    out.push(`LF:${lines.size}`);
    out.push(`LH:${linesCovered}`);
    out.push(`end_of_record`);
  }
  return out.join('\n') + '\n';
}

function writeLine(line: string) {
  // eslint-disable-next-line no-restricted-properties
  process.stdout.write(line + '\n');
}

export default CoverageReporter;
