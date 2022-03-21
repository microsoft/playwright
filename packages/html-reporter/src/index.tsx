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

import type { HTMLReport, TestAttachment } from '@playwright/test/src/reporters/html';
import type zip from '@zip.js/zip.js';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './colors.css';
import { LoadedReport } from './loadedReport';
import { ReportView } from './reportView';

export type Metadata = Partial<{
  'generatedAt': number;
  'revision.id': string;
  'revision.author': string;
  'revision.email': string;
  'revision.subject': string;
  'revision.timestamp': number;
  'revision.link': string;
  'revision.localPendingChanges': boolean;
  'ci.link': string;
}>;

const extractMetadata = (attachments: TestAttachment[]): Metadata | undefined => {
  const field = (name: string) => attachments.find(({ name: n }) => n === name)?.body;
  const fieldAsJSON = (name: string) => {
    const raw = field(name);
    if (raw !== undefined)
      return JSON.parse(raw);
  };

  const out = {
    'generatedAt': fieldAsJSON('generatedAt'),
    'revision.id': field('revision.id'),
    'revision.author': field('revision.author'),
    'revision.email': field('revision.email'),
    'revision.subject': field('revision.subject'),
    'revision.timestamp': fieldAsJSON('revision.timestamp'),
    'revision.link': field('revision.link'),
    'revision.localPendingChanges': fieldAsJSON('revision.localPendingChanges'),
    'ci.link': field('ci.link'),
  };

  if (Object.entries(out).filter(([_, v]) => v !== undefined).length)
    return out;
};

const zipjs = (self as any).zip;

const ReportLoader: React.FC = () => {
  const [report, setReport] = React.useState<LoadedReport | undefined>();
  React.useEffect(() => {
    if (report)
      return;
    const zipReport = new ZipReport();
    zipReport.load().then(() => setReport(zipReport));
  }, [report]);
  return <ReportView report={report}></ReportView>;
};

window.onload = () => {
  ReactDOM.render(<ReportLoader />, document.querySelector('#root'));
};

class ZipReport implements LoadedReport {
  private _entries = new Map<string, zip.Entry>();
  private _json!: HTMLReport & { metadata?: Metadata };

  async load() {
    const zipReader = new zipjs.ZipReader(new zipjs.Data64URIReader(window.playwrightReportBase64), { useWebWorkers: false }) as zip.ZipReader;
    for (const entry of await zipReader.getEntries())
      this._entries.set(entry.filename, entry);
    this._json = await this.entry('report.json') as HTMLReport;
    this._json.metadata = extractMetadata(this._json.attachments);
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
