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
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import './colors.css';
import type { LoadedReport } from './loadedReport';
import { ReportView } from './reportView';
import { ZipReport } from '@web/zipReport';

import logo from '@web/assets/playwright-logo.svg';
import { SearchParamsProvider } from './links';
import { applyTheme } from '@web/theme';

const link = document.createElement('link');
link.rel = 'shortcut icon';
link.href = logo;
document.head.appendChild(link);

const ReportLoader: React.FC = () => {
  const [report, setReport] = React.useState<LoadedReport | undefined>();
  React.useEffect(() => {
    const zipReport = new ZipReport<HTMLReport>('playwrightReportBase64', 'report.json');
    zipReport.load().then(() => setReport(zipReport));
  }, []);
  return <SearchParamsProvider>
    <ReportView report={report} />
  </SearchParamsProvider>;
};

window.onload = () => {
  applyTheme();
  ReactDOM.createRoot(document.querySelector('#root')!).render(<ReportLoader />);
};
