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

import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import '../theme.css';
import { CoverageView } from './coverageView';
import { HeaderView } from '../headerView';
import { SearchParamsProvider } from '../links';
import { ZipReport } from '../zipReport';
import { applyTheme } from '@web/theme';
import logo from '@web/assets/playwright-logo.svg';

import type { LoadedCoverage } from './loadedCoverage';
import type { CoverageReport } from '../types';

const link = document.createElement('link');
link.rel = 'shortcut icon';
link.href = logo;
document.head.appendChild(link);

const CoverageLoader: React.FC = () => {
  const [coverage, setCoverage] = React.useState<LoadedCoverage | undefined>();
  React.useEffect(() => {
    const zipCoverage = new ZipReport<CoverageReport>('playwrightCoverageBase64', 'coverage.json');
    zipCoverage.load().then(() => setCoverage(zipCoverage));
  }, []);
  return <SearchParamsProvider>
    <HeaderView title='Coverage report' />
    <CoverageView coverage={coverage} />
  </SearchParamsProvider>;
};

window.onload = () => {
  applyTheme();
  ReactDOM.createRoot(document.querySelector('#root')!).render(<CoverageLoader />);
};
