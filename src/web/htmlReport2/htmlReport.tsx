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

import './htmlReport.css';
import * as React from 'react';
import ansi2html from 'ansi-to-html';
import { SplitView } from '../components/splitView';
import { TreeItem } from '../components/treeItem';
import { TabbedPane } from '../traceViewer/ui/tabbedPane';
import { msToString } from '../uiUtils';
import type { ProjectTreeItem, SuiteTreeItem, TestCase, TestResult, TestStep, TestTreeItem, Location, TestFile } from '../../test/html/types';

type Filter = 'Failing' | 'All';

type TestId = {
  fileId: string;
  testId: string;
};

export const Report: React.FC = () => {
  const [report, setReport] = React.useState<ProjectTreeItem[]>([]);
  const [fetchError, setFetchError] = React.useState<string | undefined>();
  const [testId, setTestId] = React.useState<TestId | undefined>();

  React.useEffect(() => {
    (async () => {
      try {
        const result = await fetch('data/projects.json', { cache: 'no-cache' });
        const json = (await result.json()) as ProjectTreeItem[];
        setReport(json);
      } catch (e) {
        setFetchError(e.message);
      }
    })();
  }, []);
  const [filter, setFilter] = React.useState<Filter>('Failing');

  return <div className='hbox'>
    <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true}>
      <TestCaseView key={testId?.testId} testId={testId}></TestCaseView>
      <div className='suite-tree-column'>
        <div className='tab-strip'>{
          (['Failing', 'All'] as Filter[]).map(item => {
            const selected = item === filter;
            return <div key={item} className={'tab-element' + (selected ? ' selected' : '')} onClick={e => {
              setFilter(item);
            }}>{item}</div>;
          })
        }</div>
        {!fetchError && filter === 'All' && report?.map((project, i) => <ProjectTreeItemView key={i} project={project} setTestId={setTestId} testId={testId}></ProjectTreeItemView>)}
        {!fetchError && filter === 'Failing' && report?.map((project, i) => <ProjectTreeItemView key={i} project={project} setTestId={setTestId} testId={testId} failingOnly={true}></ProjectTreeItemView>)}
      </div>
    </SplitView>
  </div>;
};

const ProjectTreeItemView: React.FC<{
  project: ProjectTreeItem;
  testId?: TestId,
  setTestId: (id: TestId) => void;
  failingOnly?: boolean;
}> = ({ project, testId, setTestId, failingOnly }) => {
  return <TreeItem title={<div className='hbox'>
    {statusIconForFailedTests(project.failedTests)}<div className='tree-text'>{project.name || 'Project'}</div>
  </div>
  } loadChildren={() => {
    return project.suites.map((s, i) => <SuiteTreeItemView key={i} suite={s} setTestId={setTestId} testId={testId} depth={1} showFileName={true}></SuiteTreeItemView>) || [];
  }} depth={0} expandByDefault={true}></TreeItem>;
};

const SuiteTreeItemView: React.FC<{
  suite: SuiteTreeItem,
  testId?: TestId,
  setTestId: (id: TestId) => void;
  depth: number,
  showFileName: boolean,
}> = ({ suite, testId, setTestId, showFileName, depth }) => {
  const location = renderLocation(suite.location, showFileName);
  return <TreeItem title={<div className='hbox'>
    {statusIconForFailedTests(suite.failedTests)}<div className='tree-text'>{suite.title}</div>
    {!!suite.location?.line && location && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{location}</div>}
  </div>
  } loadChildren={() => {
    const suiteChildren = suite.suites.map((s, i) => <SuiteTreeItemView key={i} suite={s} setTestId={setTestId} testId={testId} depth={depth + 1} showFileName={false}></SuiteTreeItemView>) || [];
    const suiteCount = suite.suites.length;
    const testChildren = suite.tests.map((t, i) => <TestTreeItemView key={i + suiteCount} test={t} setTestId={setTestId} testId={testId} showFileName={false} depth={depth + 1}></TestTreeItemView>) || [];
    return [...suiteChildren, ...testChildren];
  }} depth={depth}></TreeItem>;
};

const TestTreeItemView: React.FC<{
  test: TestTreeItem,
  showFileName: boolean,
  testId?: TestId,
  setTestId: (id: TestId) => void;
  depth: number,
}> = ({ test, testId, setTestId, showFileName, depth }) => {
  const fileName = test.location.file;
  const name = fileName.substring(fileName.lastIndexOf('/') + 1);
  return <TreeItem title={<div className='hbox'>
    {statusIcon(test.outcome)}<div className='tree-text'>{test.title}</div>
    {showFileName && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{name}:{test.location.line}</div>}
    {!showFileName && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{msToString(test.duration)}</div>}
  </div>
  } selected={test.testId === testId?.testId} depth={depth} onClick={() => setTestId({ testId: test.testId, fileId: test.fileId })}></TreeItem>;
};

const TestCaseView: React.FC<{
  testId: TestId | undefined,
}> = ({ testId }) => {
  const [file, setFile] = React.useState<TestFile | undefined>();

  React.useEffect(() => {
    (async () => {
      if (!testId || file?.fileId === testId.fileId)
        return;
      try {
        const result = await fetch(`data/${testId.fileId}.json`, { cache: 'no-cache' });
        setFile((await result.json()) as TestFile);
      } catch (e) {
      }
    })();
  });

  let test: TestCase | undefined;
  if (file && testId) {
    for (const t of file.tests) {
      if (t.testId === testId.testId) {
        test = t;
        break;
      }
    }
  }

  const [selectedResultIndex, setSelectedResultIndex] = React.useState(0);
  return <SplitView sidebarSize={500} orientation='horizontal' sidebarIsFirst={true}>
    <div className='test-details-column vbox'>
    </div>
    <div className='test-case-column vbox'>
      { test && <div className='test-case-title'>{test?.title}</div> }
      { test && <div className='test-case-location'>{renderLocation(test.location, true)}</div> }
      { test && <TabbedPane tabs={
        test.results.map((result, index) => ({
          id: String(index),
          title: <div style={{ display: 'flex', alignItems: 'center' }}>{statusIcon(result.status)} {retryLabel(index)}</div>,
          render: () => <TestResultView test={test!} result={result}></TestResultView>
        })) || []} selectedTab={String(selectedResultIndex)} setSelectedTab={id => setSelectedResultIndex(+id)} />}
    </div>
  </SplitView>;
};

const TestResultView: React.FC<{
  test: TestCase,
  result: TestResult,
}> = ({ test, result }) => {
  return <div className='test-result'>
    {result.error && <ErrorMessage error={result.error}></ErrorMessage>}
    {result.steps.map((step, i) => <StepTreeItem key={i} step={step} depth={0}></StepTreeItem>)}
  </div>;
};

const StepTreeItem: React.FC<{
  step: TestStep;
  depth: number,
}> = ({ step, depth }) => {
  return <TreeItem title={<div style={{ display: 'flex', alignItems: 'center', flex: 'auto' }}>
    {statusIcon(step.error ? 'failed' : 'passed')}
    <span style={{ whiteSpace: 'pre' }}>{step.title}</span>
    <div style={{ flex: 'auto' }}></div>
    <div>{msToString(step.duration)}</div>
  </div>} loadChildren={step.steps.length + (step.error ? 1 : 0) ? () => {
    const children = step.steps.map((s, i) => <StepTreeItem key={i} step={s} depth={depth + 1}></StepTreeItem>);
    if (step.error)
      children.unshift(<ErrorMessage error={step.error}></ErrorMessage>);
    return children;
  } : undefined} depth={depth}></TreeItem>;
};

function statusIconForFailedTests(failedTests: number) {
  return failedTests ? statusIcon('failed') : statusIcon('passed');
}

function statusIcon(status: 'failed' | 'timedOut' | 'skipped' | 'passed' | 'expected' | 'unexpected' | 'flaky'): JSX.Element {
  switch (status) {
    case 'failed':
    case 'unexpected':
      return <span className={'codicon codicon-error status-icon'}></span>;
    case 'passed':
    case 'expected':
      return <span className={'codicon codicon-circle-filled status-icon'}></span>;
    case 'timedOut':
      return <span className={'codicon codicon-clock status-icon'}></span>;
    case 'flaky':
      return <span className={'codicon codicon-alert status-icon'}></span>;
    case 'skipped':
      return <span className={'codicon codicon-tag status-icon'}></span>;
  }
}

function renderLocation(location: Location | undefined, showFileName: boolean) {
  if (!location)
    return '';
  return (showFileName ? location.file : '') + ':' + location.line;
}

function retryLabel(index: number) {
  if (!index)
    return 'Run';
  return `Retry #${index}`;
}

const ErrorMessage: React.FC<{
  error: string;
}> = ({ error }) => {
  const html = React.useMemo(() => {
    return new ansi2html({ colors: ansiColors }).toHtml(escapeHTML(error));
  }, [error]);
  return <div className='error-message' dangerouslySetInnerHTML={{ __html: html || '' }}></div>;
};

const ansiColors = {
  0: '#000',
  1: '#C00',
  2: '#0C0',
  3: '#C50',
  4: '#00C',
  5: '#C0C',
  6: '#0CC',
  7: '#CCC',
  8: '#555',
  9: '#F55',
  10: '#5F5',
  11: '#FF5',
  12: '#55F',
  13: '#F5F',
  14: '#5FF',
  15: '#FFF'
};

function escapeHTML(text: string): string {
  return text.replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]!));
}
