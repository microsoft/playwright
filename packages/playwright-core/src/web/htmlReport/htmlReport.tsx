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

import type { HTMLReport, TestFileSummary, TestCase, TestFile } from '@playwright/test/src/reporters/html';
import type zip from '@zip.js/zip.js';
import * as React from 'react';
import { Filter } from './filter';
import './colors.css';
import './common.css';
import './htmlReport.css';
import { StatsNavView } from './statsNavView';
import { TestCaseView } from './testCaseView';
import { TestFileView } from './testFileView';

const zipjs = (self as any).zip;

declare global {
  interface Window {
    playwrightReportBase64?: string;
    entries: Map<string, zip.Entry>;
  }
}

export const Report: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.hash.slice(1));

  const [report, setReport] = React.useState<HTMLReport | undefined>();
  const [expandedFiles, setExpandedFiles] = React.useState<Map<string, boolean>>(new Map());
  const [filterText, setFilterText] = React.useState(searchParams.get('q') || '');

  React.useEffect(() => {
    if (report)
      return;
    (async () => {
      const zipReader = new zipjs.ZipReader(new zipjs.Data64URIReader(window.playwrightReportBase64), { useWebWorkers: false }) as zip.ZipReader;
      window.entries = new Map<string, zip.Entry>();
      for (const entry of await zipReader.getEntries())
        window.entries.set(entry.filename, entry);
      setReport(await readJsonEntry('report.json') as HTMLReport);
      window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        setFilterText(params.get('q') || '');
      });
    })();
  }, [report]);

  const filter = React.useMemo(() => Filter.parse(filterText), [filterText]);

  return <div className='htmlreport vbox px-4'>
    {report && <div className='pt-3'>
      <div className='status-container ml-2 pl-2 d-flex'>
        <StatsNavView stats={report.stats}></StatsNavView>
      </div>
      <form className='subnav-search' onSubmit={
        event => {
          event.preventDefault();
          navigate(`#?q=${filterText ? encodeURIComponent(filterText) : ''}`);
        }
      }>
        <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon subnav-search-icon'>
          <path fillRule='evenodd' d='M11.5 7a4.499 4.499 0 11-8.998 0A4.499 4.499 0 0111.5 7zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z'></path>
        </svg>
        {/* Use navigationId to reset defaultValue */}
        <input type='search' spellCheck={false} className='form-control subnav-search-input input-contrast width-full' value={filterText} onChange={e => {
          setFilterText(e.target.value);
        }}></input>
      </form>
    </div>}
    {<>
      <Route params=''>
        <AllTestFilesSummaryView report={report} filter={filter} expandedFiles={expandedFiles} setExpandedFiles={setExpandedFiles} filterText={filterText} setFilterText={setFilterText}></AllTestFilesSummaryView>
      </Route>
      <Route params='q'>
        <AllTestFilesSummaryView report={report} filter={filter} expandedFiles={expandedFiles} setExpandedFiles={setExpandedFiles} filterText={filterText} setFilterText={setFilterText}></AllTestFilesSummaryView>
      </Route>
      <Route params='testId'>
        {!!report && <TestCaseViewWrapper report={report}></TestCaseViewWrapper>}
      </Route>
    </>}
  </div>;
};

const AllTestFilesSummaryView: React.FC<{
  report?: HTMLReport,
  expandedFiles: Map<string, boolean>,
  setExpandedFiles: (value: Map<string, boolean>) => void,
  filter: Filter,
  filterText: string,
  setFilterText: (filter: string) => void,
}> = ({ report, filter, expandedFiles, setExpandedFiles, filterText, setFilterText }) => {

  const filteredFiles = React.useMemo(() => {
    const result: { file: TestFileSummary, defaultExpanded: boolean }[] = [];
    let visibleTests = 0;
    for (const file of report?.files || []) {
      const tests = file.tests.filter(t => filter.matches(t));
      visibleTests += tests.length;
      if (tests.length)
        result.push({ file, defaultExpanded: visibleTests < 200 });
    }
    return result;
  }, [report, filter]);
  return <>
    {report && filteredFiles.map(({ file, defaultExpanded }) => {
      return <TestFileView
        key={`file-${file.fileId}`}
        report={report}
        file={file}
        isFileExpanded={fileId => {
          const value = expandedFiles.get(fileId);
          if (value === undefined)
            return defaultExpanded;
          return !!value;
        }}
        setFileExpanded={(fileId, expanded) => {
          const newExpanded = new Map(expandedFiles);
          newExpanded.set(fileId, expanded);
          setExpandedFiles(newExpanded);
        }}
        filter={filter}>
      </TestFileView>;
    })}
  </>;
};

const TestCaseViewWrapper: React.FC<{
  report: HTMLReport,
}> = ({ report }) => {
  const searchParams = new URLSearchParams(window.location.hash.slice(1));
  const [test, setTest] = React.useState<TestCase | undefined>();
  const testId = searchParams.get('testId');
  React.useEffect(() => {
    (async () => {
      if (!testId || testId === test?.testId)
        return;
      const fileId = testId.split('-')[0];
      if (!fileId)
        return;
      const file = await readJsonEntry(`${fileId}.json`) as TestFile;
      for (const t of file.tests) {
        if (t.testId === testId) {
          setTest(t);
          break;
        }
      }
    })();
  }, [test, report, testId]);
  return <TestCaseView report={report} test={test}></TestCaseView>;
};

function navigate(href: string) {
  window.history.pushState({}, '', href);
  const navEvent = new PopStateEvent('popstate');
  window.dispatchEvent(navEvent);
}

const Route: React.FunctionComponent<{
  params: string,
  children: any
}> = ({ params, children }) => {
  const initialParams = [...new URLSearchParams(window.location.hash.slice(1)).keys()].join('&');
  const [currentParams, setCurrentParam] = React.useState(initialParams);
  React.useEffect(() => {
    const listener = () => {
      const newParams = [...new URLSearchParams(window.location.hash.slice(1)).keys()].join('&');
      setCurrentParam(newParams);
    };
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  return currentParams === params ? children : null;
};

async function readJsonEntry(entryName: string): Promise<any> {
  const reportEntry = window.entries.get(entryName);
  const writer = new zipjs.TextWriter() as zip.TextWriter;
  await reportEntry!.getData!(writer);
  return JSON.parse(await writer.getData());
}
