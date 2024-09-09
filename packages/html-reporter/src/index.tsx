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

import type { HTMLReport } from './types';
import type zip from '@zip.js/zip.js';
// @ts-ignore
import * as zipImport from '@zip.js/zip.js/lib/zip-no-worker-inflate.js';
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import './colors.css';
import type { LoadedReport } from './loadedReport';
import { ReportView } from './reportView';
// @ts-ignore
const zipjs = zipImport as typeof zip;

import logo from '@web/assets/playwright-logo.svg';
const link = document.createElement('link');
link.rel = 'shortcut icon';
link.href = logo;
document.head.appendChild(link);

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
  ReactDOM.createRoot(document.querySelector('#root')!).render(<ReportLoader />);
};

class ZipReport implements LoadedReport {
  private _entries = new Map<string, zip.Entry>();
  private _json!: HTMLReport;

  async load() {
    const zipReader = new zipjs.ZipReader(new zipjs.Data64URIReader(window.playwrightReportBase64!), { useWebWorkers: false });
    for (const entry of await zipReader.getEntries())
      this._entries.set(entry.filename, entry);
    this._json = await this.entry('report.json') as HTMLReport;
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
