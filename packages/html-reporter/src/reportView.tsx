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

import type { AsyncResult, FilteredStats, TestCase, TestCaseSummary, TestFile, TestFileSummary } from './types';
import * as React from 'react';
import './colors.css';
import './common.css';
import { Filter } from './filter';
import { HeaderView } from './headerView';
import { Route, SearchParamsContext } from './links';
import type { ParsedReport } from './parsedReport';
import './reportView.css';
import { TestCaseView } from './testCaseView';
import { TestFilesHeader, TestFilesView } from './testFilesView';
import './theme.css';

declare global {
  interface Window {
    playwrightReportBase64?: string;
  }
}

// These are extracted to preserve the function identity between renders to avoid re-triggering effects.
const testFilesRoutePredicate = (params: URLSearchParams) => !params.has('testId');
const testCaseRoutePredicate = (params: URLSearchParams) => params.has('testId');

type TestModelSummary = {
  files: TestFileSummary[];
  tests: TestCaseSummary[];
};

export const ReportView: React.FC<{
  report: AsyncResult<ParsedReport>,
}> = ({ report }) => {
  return <div className='htmlreport vbox px-4 pb-4'>
    <main>
      <RenderedReportResult report={report} />
    </main>
  </div>;
};

const LoadedReportView: React.FC<{
  report: ParsedReport,
}> = ({ report }) => {
  const searchParams = React.useContext(SearchParamsContext);
  const [expandedFiles, setExpandedFiles] = React.useState<Map<string, boolean>>(new Map());
  const [filterText, setFilterText] = React.useState(searchParams.get('q') || '');
  const [metadataVisible, setMetadataVisible] = React.useState(false);

  const testIdToFileIdMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const file of report.json().files) {
      for (const test of file.tests)
        map.set(test.testId, file.fileId);
    }
    return map;
  }, [report]);

  const filter = React.useMemo(() => Filter.parse(filterText), [filterText]);
  const filteredStats = React.useMemo(() => filter.empty() ? undefined : computeStats(report.json().files || [], filter), [report, filter]);
  const filteredTests = React.useMemo(() => {
    const result: TestModelSummary = { files: [], tests: [] };
    for (const file of report.json().files) {
      const tests = file.tests.filter(t => filter.matches(t));
      if (tests.length)
        result.files.push({ ...file, tests });
      result.tests.push(...tests);
    }
    return result;
  }, [report, filter]);

  return <div className='htmlreport vbox px-4 pb-4'>
    <main>
      <HeaderView stats={report.json().stats} filterText={filterText} setFilterText={setFilterText} />
      <Route predicate={testFilesRoutePredicate}>
        <TestFilesHeader report={report.json()} filteredStats={filteredStats} metadataVisible={metadataVisible} toggleMetadataVisible={() => setMetadataVisible(visible => !visible)}/>
        <TestFilesView
          tests={filteredTests.files}
          expandedFiles={expandedFiles}
          setExpandedFiles={setExpandedFiles}
          projectNames={report.json().projectNames}
        />
      </Route>
      <Route predicate={testCaseRoutePredicate}>
        <TestCaseViewLoader report={report} tests={filteredTests.tests} testIdToFileIdMap={testIdToFileIdMap} />
      </Route>
    </main>
  </div>;
};

const RenderedReportResult: React.FC<{
  report: AsyncResult<ParsedReport>
}> = ({ report }) => {
  switch (report.type) {
    case 'loading':
      return <div />;
    case 'data':
      return <LoadedReportView report={report.data} />;
    case 'error':
      return <div className='fatal-report-error'>Report data could not be found. Please reload the page or regenerate the HTML report</div>;
  }
};

const TestCaseViewLoader: React.FC<{
  report: ParsedReport,
  tests: TestCaseSummary[],
  testIdToFileIdMap: Map<string, string>,
}> = ({ report, testIdToFileIdMap, tests }) => {
  const searchParams = React.useContext(SearchParamsContext);
  const [test, setTest] = React.useState<AsyncResult<TestCase>>({ type: 'loading' });
  const testId = searchParams.get('testId');
  const run = +(searchParams.get('run') || '0');

  const { prev, next } = React.useMemo(() => {
    const index = tests.findIndex(t => t.testId === testId);
    const prev = index > 0 ? tests[index - 1] : undefined;
    const next = index < tests.length - 1 ? tests[index + 1] : undefined;
    return { prev, next };
  }, [testId, tests]);

  const currentTestId = test.type === 'data' ? test.data.testId : undefined;

  React.useEffect(() => {
    (async () => {
      if (testId === currentTestId)
        return;
      if (!testId) {
        setTest({ type: 'error' });
        return;
      }
      const fileId = testIdToFileIdMap.get(testId);
      if (!fileId) {
        setTest({ type: 'error' });
        return;
      }
      try {
        const file = await report.entry(`${fileId}.json`) as TestFile;
        const testCase = file.tests.find(t => t.testId === testId);
        setTest(!!testCase ? { type: 'data', data: testCase } : { type: 'error' });
      } catch (e) {
        setTest({ type: 'error' });
      }
    })();
  }, [report, testId, currentTestId, testIdToFileIdMap]);

  switch (test.type) {
    case 'loading':
    case 'data':
      return <TestCaseView
        projectNames={report.json().projectNames}
        next={next}
        prev={prev}
        test={test.type === 'data' ? test.data : undefined}
        run={run}
      />;
    case 'error':
      return <div className='test-case-column vbox'>
        <div className='test-case-title'>Test not found</div>
        <div className='test-case-location'>Test ID: {testId}</div>
      </div>;
  }
};

function computeStats(files: TestFileSummary[], filter: Filter): FilteredStats {
  const stats: FilteredStats = {
    total: 0,
    duration: 0,
  };
  for (const file of files) {
    const tests = file.tests.filter(t => filter.matches(t));
    stats.total += tests.length;
    for (const test of tests)
      stats.duration += test.duration;
  }
  return stats;
}
