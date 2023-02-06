/**
 * Copyright (c) Microsoft Corporation.
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

import type { HTMLReport, Stats } from './types';
import type zip from '@zip.js/zip.js';
// @ts-ignore
import * as zipImport from '@zip.js/zip.js/lib/zip-no-worker-inflate.js';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './colors.css';
import type { LoadedReport } from './loadedReport';
import { ReportView } from './reportView';
// @ts-ignore
const zipjs = zipImport as typeof zip;

const ReportLoader: React.FC = () => {
  const [report, setReport] = React.useState<LoadedReport | undefined>();
  React.useEffect(() => {
    if (report)
      return;
    const shardTotal = window.playwrightShardTotal;
    const zipReport = new ZipReport();
    const loadPromis = shardTotal ?
      zipReport.loadFromShards(shardTotal) :
      zipReport.loadFromBase64(window.playwrightReportBase64!);
    loadPromis.then(() => setReport(zipReport));
  }, [report]);
  return <ReportView report={report}></ReportView>;
};

window.onload = () => {
  ReactDOM.render(<ReportLoader />, document.querySelector('#root'));
};

class ZipReport implements LoadedReport {
  private _entries = new Map<string, zip.Entry>();
  private _json!: HTMLReport;

  async loadFromBase64(reportBase64: string) {
    const zipReader = new zipjs.ZipReader(new zipjs.Data64URIReader(reportBase64), { useWebWorkers: false }) as zip.ZipReader;
    this._json = await this._readReportAndTestEntries(zipReader);
  }

  async loadFromShards(shardTotal: number) {
    const readers = [];
    for (let i = 0; i < shardTotal; i++) {
      const fileName = `/report-${i + 1}-of-${shardTotal}.zip`;
      const zipReader = new zipjs.ZipReader(new zipjs.HttpReader(fileName), { useWebWorkers: false }) as zip.ZipReader;
      readers.push(this._readReportAndTestEntries(zipReader));
    }
    this._json = mergeReports(await Promise.all(readers));
  }

  private async _readReportAndTestEntries(zipReader: zip.ZipReader): Promise<HTMLReport> {
    for (const entry of await zipReader.getEntries())
      this._entries.set(entry.filename, entry);
    return await this.entry('report.json') as HTMLReport;
  }

  json(): HTMLReport {
    return this._json;
  }

  async entry(name: string): Promise<Object> {
    const reportEntry = this._entries.get(name);
    const writer = new zipjs.TextWriter() as zip.TextWriter;
    await reportEntry!.getData!(writer);
    return JSON.parse(await writer.getData());
  }
}

function mergeReports(reports: HTMLReport[]): HTMLReport {
  const [report, ...rest] = reports;

  for (const currentReport of rest) {
    currentReport.files.forEach(file => {
      const existingGroup = report.files.find(({ fileId }) => fileId === file.fileId);

      if (existingGroup) {
        existingGroup.tests.push(...file.tests);
        mergeStats(existingGroup.stats, file.stats);
      } else {
        report.files.push(file);
      }
    });

    mergeStats(report.stats, currentReport.stats);
    report.metadata.duration += currentReport.metadata.duration;
  }

  return report;
}

function mergeStats(toStats: Stats, fromStats: Stats) {
  toStats.total += fromStats.total;
  toStats.expected += fromStats.expected;
  toStats.unexpected += fromStats.unexpected;
  toStats.flaky += fromStats.flaky;
  toStats.skipped += fromStats.skipped;
  toStats.duration += fromStats.duration;
  toStats.ok = toStats.ok && fromStats.ok;
}
