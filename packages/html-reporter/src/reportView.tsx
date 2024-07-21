/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { FilteredStats, TestCase, TestFile, TestFileSummary } from './types';
import * as React from 'react';
import './colors.css';
import './common.css';
import { Filter } from './filter';
import { HeaderView } from './headerView';
import { Route } from './links';
import type { LoadedReport } from './loadedReport';
import './reportView.css';
import type { Metainfo } from './metadataView';
import { MetadataView } from './metadataView';
import { TestCaseView } from './testCaseView';
import { TestFilesView } from './testFilesView';
import './theme.css';
import { useSearchParams } from './use-search-params';

declare global {
  interface Window {
    playwrightReportBase64?: string;
  }
}

// These are extracted to preserve the function identity between renders to avoid re-triggering effects.
const testFilesRoutePredicate = (params: URLSearchParams) => !params.has('testId');
const testCaseRoutePredicate = (params: URLSearchParams) => params.has('testId');

export const ReportView: React.FC<{
  report: LoadedReport | undefined,
}> = ({ report }) => {
  const searchParams = useSearchParams();
  const [expandedFiles, setExpandedFiles] = React.useState<Map<string, boolean>>(new Map());
  const [filterText, setFilterText] = React.useState(searchParams.get('q') || '');

  const reportData = report?.json();
  const filter = React.useMemo(() => Filter.parse(filterText), [filterText]);

  const filteredFiles = React.useMemo(() => {
    const files = reportData?.files ?? [];

    return files
        .map(file => {
          const tests = file.tests.filter(test => filter.matches(test));
          return { ...file, tests };
        })
        .filter(file => file.tests.length !== 0);
  }, [filter, reportData?.files]);

  const filteredStats = React.useMemo(() => computeStats(filteredFiles), [filteredFiles]);

  return <div className='htmlreport vbox px-4 pb-4'>
    <main>
      {reportData && <HeaderView stats={reportData.stats} filterText={filterText} setFilterText={setFilterText}></HeaderView>}
      {reportData?.metadata && <MetadataView {...reportData.metadata as Metainfo} />}
      <Route predicate={testFilesRoutePredicate}>
        <TestFilesView
          report={reportData}
          filter={filter}
          expandedFiles={expandedFiles}
          setExpandedFiles={setExpandedFiles}
          projectNames={reportData?.projectNames ?? []}
          filteredStats={filteredStats}
          filteredFiles={filteredFiles}
        />
      </Route>
      <Route predicate={testCaseRoutePredicate}>
        {!!report && (
          <TestCaseViewLoader
            report={report}
            filteredFiles={filteredFiles}
            filter={filter}
          />
        )}
      </Route>
    </main>
  </div>;
};

const TestCaseViewLoader: React.FC<{
  report: LoadedReport,
  filteredFiles: TestFileSummary[],
  filter: Filter
}> = ({ report, filteredFiles, filter }) => {
  const searchParams = useSearchParams();
  const [test, setTest] = React.useState<TestCase | undefined>();
  const testId = searchParams.get('testId') ?? '';
  const anchor = (searchParams.get('anchor') || '') as 'video' | 'diff' | '';
  const run = +(searchParams.get('run') || '0');

  const testIdToFileIdMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const file of filteredFiles) {
      for (const test of file.tests)
        map.set(test.testId, file.fileId);
    }
    return map;
  }, [filteredFiles]);

  const { prevTestId, nextTestId } = getAdjacentTestIds(testIdToFileIdMap, testId);

  React.useEffect(() => {
    (async () => {
      if (!testId || testId === test?.testId)
        return;
      const fileId = testIdToFileIdMap.get(testId);
      if (!fileId)
        return;
      const file = await report.entry(`${fileId}.json`) as TestFile;
      for (const t of file.tests) {
        if (t.testId === testId) {
          setTest(t);
          break;
        }
      }
    })();
  }, [test, report, testId, testIdToFileIdMap]);

  return (
    <TestCaseView
      projectNames={report.json().projectNames}
      test={test}
      anchor={anchor}
      run={run}
      prevTestId={prevTestId}
      nextTestId={nextTestId}
    />
  );
};


function computeStats(filteredFiles: TestFileSummary[]): FilteredStats {
  const stats: FilteredStats = {
    total: 0,
    duration: 0,
  };
  for (const file of filteredFiles) {
    stats.total += file.tests.length;
    for (const test of file.tests)
      stats.duration += test.duration;
  }
  return stats;
}

function getAdjacentTestIds(testIdToFileIdMap: Map<string, string>, currentTestId: string) {
  const testIds = [...testIdToFileIdMap.keys()];
  const currentIndex = testIds.indexOf(currentTestId);

  const lastIndex = testIds.length - 1;
  const nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
  const prevIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;

  return {
    prevTestId: testIds[prevIndex],
    nextTestId: testIds[nextIndex],
  };
}
