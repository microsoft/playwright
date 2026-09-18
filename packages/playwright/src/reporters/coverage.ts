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

import * as yazl from 'yazl';
import { addCoverageSummary, emptyCoverageSummary, fileCoverageSummary, formatCoveragePercent, lineCoverage, mergeIstanbulCoverage, sortedIstanbulCoverage } from '@isomorphic/istanbulCoverage';
import { calculateSha1 } from '@utils/crypto';
import { toPosixPath } from '@utils/fileUtils';
import { ZipFile } from '@utils/zipFile';
import { terminalScreen } from './base';
import { appendZipDataTemplate, inlineViteApp } from './htmlUtils';
import { resolveReporterOutputPath } from '../util';

import type { CoverageFile, CoverageMetric, CoverageReport, IstanbulCoverage, IstanbulFileCoverage } from '@isomorphic/istanbulCoverage';
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
    // Traces of several contexts are merged into one, each keeping its own coverage entry.
    const traceFiles = [...this._traceFiles];
    while (traceFiles.length) {
      const batch = traceFiles.splice(0, 16).map(async traceFile => {
        const zipFile = new ZipFile(traceFile);
        try {
          const entries = (await zipFile.entries()).filter(entry => entry.match(/(^|-)trace\.coverage$/));
          return await Promise.all(entries.map(entry => zipFile.read(entry)));
        } catch {
          return [];
        } finally {
          zipFile.close();
        }
      });
      for (const buffers of await Promise.all(batch)) {
        for (const buffer of buffers) {
          try {
            mergeIstanbulCoverage(coverage, JSON.parse(buffer.toString('utf8')));
          } catch {
          }
        }
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
    const mergedJson = sortedIstanbulCoverage(coverage);
    await fs.promises.writeFile(path.join(outputDir, 'coverage-final.json'), JSON.stringify(mergedJson));
    await fs.promises.writeFile(path.join(outputDir, 'lcov.info'), lcovReport(mergedJson));
    const report = await this._writeHtmlReport(mergedJson, outputDir);

    const { summary } = report;
    writeLine([
      ``,
      `Code coverage (${report.files.length} files):`,
      `  statements: ${formatMetric(summary.statements)}`,
      `  branches:   ${formatMetric(summary.branches)}`,
      `  functions:  ${formatMetric(summary.functions)}`,
      `  lines:      ${formatMetric(summary.lines)}`,
      `Coverage report written to ${path.relative(process.cwd(), outputDir)}`,
    ].join('\n'));
  }

  private async _writeHtmlReport(mergedJson: IstanbulCoverage, outputDir: string): Promise<CoverageReport> {
    const report: CoverageReport = { files: [], summary: emptyCoverageSummary() };
    const dataZipFile = new yazl.ZipFile();
    const sources = await Promise.all(Object.keys(mergedJson).map(filePath => this._readSource(filePath)));
    Object.entries(mergedJson).forEach(([filePath, coverage], index) => {
      const fileId = calculateSha1(filePath).slice(0, 20);
      const summary = fileCoverageSummary(coverage);
      report.files.push({ fileId, path: toPosixPath(filePath), summary });
      addCoverageSummary(report.summary, summary);
      const file: CoverageFile = { path: toPosixPath(filePath), source: sources[index], coverage };
      dataZipFile.addBuffer(Buffer.from(JSON.stringify(file)), `coverage/${fileId}.json`);
    });
    dataZipFile.addBuffer(Buffer.from(JSON.stringify(report)), 'coverage.json');

    const appFolder = path.join(require.resolve('playwright-core'), '..', 'lib', 'vite', 'coverageReport');
    const reportIndexFile = path.join(outputDir, 'index.html');
    await fs.promises.writeFile(reportIndexFile, await inlineViteApp(appFolder));
    await appendZipDataTemplate(reportIndexFile, dataZipFile, 'playwrightCoverageBase64');
    return report;
  }

  private async _readSource(filePath: string): Promise<string | undefined> {
    return fs.promises.readFile(path.resolve(this._options.configDir, filePath), 'utf8').catch(() => undefined);
  }
}

function formatMetric(metric: CoverageMetric) {
  return `${formatCoveragePercent(metric)} (${metric.covered}/${metric.total})`;
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
  terminalScreen.stdout.write(line + '\n');
}

export default CoverageReporter;
