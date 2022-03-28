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

import type { TestCase, TestFile } from '@playwright-test/reporters/html';
import * as React from 'react';
import './colors.css';
import './common.css';
import { Filter } from './filter';
import { HeaderView } from './headerView';
import { Route } from './links';
import { LoadedReport } from './loadedReport';
import './reportView.css';
import { TestCaseView } from './testCaseView';
import { TestFilesView } from './testFilesView';
import './theme.css';
import * as icons from './icons';
import { Metadata } from './index';

declare global {
  interface Window {
    playwrightReportBase64?: string;
  }
}

export const ReportView: React.FC<{
  report: LoadedReport | undefined,
}> = ({ report }) => {
  const searchParams = new URLSearchParams(window.location.hash.slice(1));
  const [expandedFiles, setExpandedFiles] = React.useState<Map<string, boolean>>(new Map());
  const [filterText, setFilterText] = React.useState(searchParams.get('q') || '');

  const filter = React.useMemo(() => Filter.parse(filterText), [filterText]);

  return <div className='htmlreport vbox px-4 pb-4'>

    {report?.json().metadata && <MetadataView {...report?.json().metadata!} />}
    <main>
      {report?.json() && <HeaderView stats={report.json().stats} filterText={filterText} setFilterText={setFilterText}></HeaderView>}
      <Route params=''>
        <TestFilesView report={report?.json()} filter={filter} expandedFiles={expandedFiles} setExpandedFiles={setExpandedFiles}></TestFilesView>
      </Route>
      <Route params='q'>
        <TestFilesView report={report?.json()} filter={filter} expandedFiles={expandedFiles} setExpandedFiles={setExpandedFiles}></TestFilesView>
      </Route>
      <Route params='testId'>
        {!!report && <TestCaseViewLoader report={report}></TestCaseViewLoader>}
      </Route>
    </main>
  </div>;
};

const MetadataView: React.FC<Metadata> = metadata => {
  return (
    <header className='metadata-view pt-3'>
      <h1>{metadata['revision.subject'] || 'Playwright Test Report'}</h1>
      {metadata['revision.id'] &&
        <MetadatViewItem
          testId='revision.id'
          content={<span style={{ fontFamily: 'monospace' }}>{metadata['revision.id'].slice(0, 7)}</span>}
          href={metadata['revision.link']}
          icon='commit'
        />
      }
      {(metadata['revision.author'] || metadata['revision.email']) &&
        <MetadatViewItem
          content={(
            metadata['revision.author'] && metadata['revision.email']
              ? <>{metadata['revision.author']}<br/>{metadata['revision.email']}</>
              : (metadata['revision.author'] || metadata['revision.email'])
            )!}
          icon='person'
        />
      }
      {metadata['revision.timestamp'] &&
        <MetadatViewItem
          testId='revision.timestamp'
          content={
            <>
              {Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(metadata['revision.timestamp'])}
              <br />
              {Intl.DateTimeFormat(undefined, { timeStyle: 'long' }).format(metadata['revision.timestamp'])}
            </>
          }
          icon='calendar'
        />
      }
      {metadata['ci.link'] &&
        <MetadatViewItem
          content='CI/CD Logs'
          href={metadata['ci.link']}
          icon='externalLink'
        />
      }
      {metadata['revision.localPendingChanges'] &&
        <p style={{ fontStyle: 'italic', color: 'var(--color-fg-subtle)' }}>This report was generated with <strong>uncommitted changes</strong>.</p>
      }
      {metadata['generatedAt'] &&
        <p style={{ fontStyle: 'italic', color: 'var(--color-fg-subtle)' }}>Report generated on {Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(metadata['generatedAt'])}</p>
      }
    </header>
  );
};

const MetadatViewItem: React.FC<{ content: JSX.Element | string; icon: keyof typeof icons, href?: string, testId?: string }> = ({ content, icon, href, testId }) => {
  return (
    <div className='mt-2 hbox' data-test-id={testId} >
      <div className='mr-2'>
        {icons[icon]()}
      </div>
      <div style={{ flex: 1 }}>
        {href ? <a href={href} target='_blank' rel='noopener noreferrer'>{content}</a> : content}
      </div>
    </div>
  );
};

const TestCaseViewLoader: React.FC<{
  report: LoadedReport,
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
      const file = await report.entry(`${fileId}.json`) as TestFile;
      for (const t of file.tests) {
        if (t.testId === testId) {
          setTest(t);
          break;
        }
      }
    })();
  }, [test, report, testId]);
  return <TestCaseView projectNames={report.json().projectNames} test={test}></TestCaseView>;
};
