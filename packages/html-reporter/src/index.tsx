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

import type { HTMLReport, TestAttachment } from '@playwright-test/reporters/html';
import type zip from '@zip.js/zip.js';
// @ts-ignore
import zipImport from '@zip.js/zip.js/dist/zip-no-worker-inflate.min.js';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './colors.css';
import type { LoadedReport } from './loadedReport';
import { ReportView } from './reportView';
// @ts-ignore
const zipjs = zipImport as typeof zip;

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
  // The last plugin to register for a given key will take precedence
  attachments = [...attachments];
  attachments.reverse();
  const field = (name: string) => attachments.find(({ name: n }) => n === name)?.body;
  const fieldAsJSON = (name: string) => {
    const raw = field(name);
    if (raw !== undefined)
      return JSON.parse(raw);
  };
  const fieldAsNumber = (name: string) => {
    const v = fieldAsJSON(name);
    if (v !== undefined && typeof v !== 'number')
      throw new Error(`Invalid value for field '${name}'. Expected type 'number', but got ${typeof v}.`);

    return v;
  };
  const fieldAsBool = (name: string) => {
    const v = fieldAsJSON(name);
    if (v !== undefined && typeof v !== 'boolean')
      throw new Error(`Invalid value for field '${name}'. Expected type 'boolean', but got ${typeof v}.`);

    return v;
  };

  const out = {
    'generatedAt': fieldAsNumber('generatedAt'),
    'revision.id': field('revision.id'),
    'revision.author': field('revision.author'),
    'revision.email': field('revision.email'),
    'revision.subject': field('revision.subject'),
    'revision.timestamp': fieldAsNumber('revision.timestamp'),
    'revision.link': field('revision.link'),
    'revision.localPendingChanges': fieldAsBool('revision.localPendingChanges'),
    'ci.link': field('ci.link'),
  };

  if (Object.entries(out).filter(([_, v]) => v !== undefined).length)
    return out;
};

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
    const zipReader = new zipjs.ZipReader(new zipjs.Data64URIReader((window as any).playwrightReportBase64), { useWebWorkers: false }) as zip.ZipReader;
    for (const entry of await zipReader.getEntries())
      this._entries.set(entry.filename, entry);
    this._json = await this.entry('report.json') as HTMLReport;
    // this._json.metadata = extractMetadata(this._json.attachments);
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
