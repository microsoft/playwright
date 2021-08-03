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
import { SplitView } from '../components/splitView';
import { TreeItem } from '../components/treeItem';
import { TabbedPane } from '../traceViewer/ui/tabbedPane';
import ansi2html from 'ansi-to-html';
import { JsonLocation, JsonReport, JsonSuite, JsonTestCase, JsonTestResult, JsonTestStep } from '../../test/reporters/html';
import { msToString } from '../uiUtils';

type Filter = 'Failing' | 'All';

export const Report: React.FC = () => {
  const [report, setReport] = React.useState<JsonReport | undefined>();
  const [selectedTest, setSelectedTest] = React.useState<JsonTestCase | undefined>();

  React.useEffect(() => {
    (async () => {
      const result = await fetch('report.json');
      const json = await result.json();
      setReport(json);
    })();
  }, []);
  const [filter, setFilter] = React.useState<Filter>('Failing');

  const failingTests = React.useMemo(() => {
    const map = new Map<JsonSuite, JsonTestCase[]>();
    for (const project of report?.suites || [])
      map.set(project, computeFailingTests(project));
    return map;
  }, [report]);

  return <div className='hbox'>
    <FilterView filter={filter} setFilter={setFilter}></FilterView>
    <SplitView sidebarSize={500} orientation='horizontal' sidebarIsFirst={true}>
      <TestCaseView test={selectedTest}></TestCaseView>
      <div className='suite-tree'>
        {filter === 'All' && report?.suites.map((s, i) => <ProjectTreeItem key={i} suite={s} setSelectedTest={setSelectedTest} selectedTest={selectedTest}></ProjectTreeItem>)}
        {filter === 'Failing' && report?.suites.map((s, i) => {
          const hasFailingTests = !!failingTests.get(s)?.length;
          return hasFailingTests && <ProjectFlatTreeItem key={i} suite={s} setSelectedTest={setSelectedTest} selectedTest={selectedTest} failingTests={failingTests.get(s)!}></ProjectFlatTreeItem>;
        })}
      </div>
    </SplitView>
  </div>;
};

const FilterView: React.FC<{
  filter: Filter,
  setFilter: (filter: Filter) => void
}> = ({ filter, setFilter }) => {
  return <div className='sidebar'>
    {
      (['Failing', 'All'] as Filter[]).map(item => {
        const selected = item === filter;
        return <div key={item} className={selected ? 'selected' : ''} onClick={e => {
          setFilter(item);
        }}>{item}</div>;
      })
    }
  </div>;
};

const ProjectTreeItem: React.FC<{
  suite?: JsonSuite;
  selectedTest?: JsonTestCase,
  setSelectedTest: (test: JsonTestCase) => void;
}> = ({ suite, setSelectedTest, selectedTest }) => {
  const location = renderLocation(suite?.location);

  return <TreeItem title={<div className='hbox'>
    <div style={{ flex: 'auto', alignItems: 'center', display: 'flex' }}>{testSuiteErrorStatusIcon(suite) || statusIcon('passed')}<div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{suite?.title}</div></div>
    {!!suite?.location?.line && location && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{location}</div>}
  </div>
  } loadChildren={() => {
    return suite?.suites.map((s, i) => <SuiteTreeItem key={i} suite={s} setSelectedTest={setSelectedTest} selectedTest={selectedTest} depth={1}></SuiteTreeItem>) || [];
  }} depth={0} expandByDefault={true}></TreeItem>;
};

const ProjectFlatTreeItem: React.FC<{
  suite?: JsonSuite;
  failingTests: JsonTestCase[],
  selectedTest?: JsonTestCase,
  setSelectedTest: (test: JsonTestCase) => void;
}> = ({ suite, setSelectedTest, selectedTest, failingTests }) => {
  const location = renderLocation(suite?.location);

  return <TreeItem title={<div className='hbox'>
    <div style={{ flex: 'auto', alignItems: 'center', display: 'flex' }}>{testSuiteErrorStatusIcon(suite) || statusIcon('passed')}<div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{suite?.title}</div></div>
    {!!suite?.location?.line && location && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{location}</div>}
  </div>
  } loadChildren={() => {
    return failingTests.map((t, i) => <TestTreeItem key={i} test={t} setSelectedTest={setSelectedTest} selectedTest={selectedTest} showFileName={false} depth={1}></TestTreeItem>) || [];
  }} depth={0} expandByDefault={true}></TreeItem>;
};

const SuiteTreeItem: React.FC<{
  suite?: JsonSuite;
  selectedTest?: JsonTestCase,
  setSelectedTest: (test: JsonTestCase) => void;
  depth: number,
}> = ({ suite, setSelectedTest, selectedTest, depth }) => {
  const location = renderLocation(suite?.location);
  return <TreeItem title={<div className='hbox'>
    <div style={{ flex: 'auto', alignItems: 'center', display: 'flex' }}>{testSuiteErrorStatusIcon(suite) || statusIcon('passed')}<div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{suite?.title}</div></div>
    {!!suite?.location?.line && location && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{location}</div>}
  </div>
  } loadChildren={() => {
    const suiteChildren = suite?.suites.map((s, i) => <SuiteTreeItem key={i} suite={s} setSelectedTest={setSelectedTest} selectedTest={selectedTest} depth={depth + 1}></SuiteTreeItem>) || [];
    const testChildren = suite?.tests.map((t, i) => <TestTreeItem key={i} test={t} setSelectedTest={setSelectedTest} selectedTest={selectedTest} showFileName={false} depth={depth + 1}></TestTreeItem>) || [];
    return [...suiteChildren, ...testChildren];
  }} depth={depth}></TreeItem>;
};

const TestTreeItem: React.FC<{
  expandByDefault?: boolean,
  test: JsonTestCase;
  showFileName: boolean,
  selectedTest?: JsonTestCase,
  setSelectedTest: (test: JsonTestCase) => void;
  depth: number,
}> = ({ test, setSelectedTest, selectedTest, showFileName, expandByDefault, depth }) => {
  const fileName = test.location.file;
  const name = fileName.substring(fileName.lastIndexOf('/') + 1);
  return <TreeItem title={<div className='hbox'>
    <div style={{ flex: 'auto', alignItems: 'center', display: 'flex' }}>{testCaseStatusIcon(test)}<div style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{test.title}</div></div>
    {showFileName && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{name}:{test.location.line}</div>}
    {!showFileName && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{msToString(test.results.reduce((v, a) => v + a.duration, 0))}</div>}
  </div>
  } selected={test === selectedTest} depth={depth} expandByDefault={expandByDefault} onClick={() => setSelectedTest(test)}></TreeItem>;
};

const TestCaseView: React.FC<{
  test?: JsonTestCase,
}> = ({ test }) => {
  const [selectedTab, setSelectedTab] = React.useState<string>('0');
  return <div className="test-case vbox">
    { test && <TabbedPane tabs={
      test?.results.map((result, index) => ({
        id: String(index),
        title: <div style={{ display: 'flex', alignItems: 'center' }}>{statusIcon(result.status)} {retryLabel(index)}</div>,
        render: () => <TestOverview test={test} result={result}></TestOverview>
      })) || []} selectedTab={selectedTab} setSelectedTab={setSelectedTab} /> }
  </div>;
};

const TestOverview: React.FC<{
  test: JsonTestCase,
  result: JsonTestResult,
}> = ({ test, result }) => {
  return <div className="test-result">
    <div className='test-overview-title'>{test?.title}</div>
    <div className='test-overview-property'>{renderLocation(test.location)}<div style={{ flex: 'auto' }}></div><div>{msToString(result.duration)}</div></div>
    { result.failureSnippet && <div className='error-message' dangerouslySetInnerHTML={{__html: new ansi2html({
      colors: ansiColors
    }).toHtml(result.failureSnippet.trim()) }}></div> }
    { result.steps.map((step, i) => <StepTreeItem key={i} step={step} depth={0}></StepTreeItem>) }
    {/* <div style={{whiteSpace: 'pre'}}>{ JSON.stringify(result.steps, undefined, 2) }</div> */}
  </div>;
};

const StepTreeItem: React.FC<{
  step: JsonTestStep;
  depth: number,
}> = ({ step, depth }) => {
  return <TreeItem title={<div style={{ display: 'flex', alignItems: 'center', flex: 'auto', maxWidth: 430 }}>
    {testStepStatusIcon(step)}
    {step.title}
    <div style={{ flex: 'auto' }}></div>
    <div>{msToString(step.duration)}</div>
  </div>} loadChildren={step.steps.length ? () => {
    return step.steps.map((s, i) => <StepTreeItem key={i} step={s} depth={depth + 1}></StepTreeItem>);
  } : undefined} depth={depth}></TreeItem>;
};

function testSuiteErrorStatusIcon(suite?: JsonSuite): JSX.Element | undefined {
  if (!suite)
    return;
  for (const child of suite.suites) {
    const icon = testSuiteErrorStatusIcon(child);
    if (icon)
      return icon;
  }
  for (const test of suite.tests) {
    if (test.outcome !== 'expected' && test.outcome !== 'skipped')
      return testCaseStatusIcon(test);
  }
}

function testCaseStatusIcon(test?: JsonTestCase): JSX.Element {
  if (!test)
    return statusIcon('passed');
  return statusIcon(test.outcome);
}

function testStepStatusIcon(step: JsonTestStep): JSX.Element {
  if (step.category === 'internal')
    return <span></span>;
  return statusIcon(step.error ? 'failed' : 'passed');
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

function computeFailingTests(suite: JsonSuite): JsonTestCase[] {
  const failedTests: JsonTestCase[] = [];
  const visit = (suite: JsonSuite) => {
    for (const child of suite.suites)
      visit(child);
    for (const test of suite.tests) {
      if (test.results.find(r => r.status === 'failed' || r.status === 'timedOut'))
        failedTests.push(test);
    }
  };
  visit(suite);
  return failedTests;
}

function renderLocation(location?: JsonLocation) {
  if (!location)
    return '';
  return location.file + ':' + location.column;
}

function retryLabel(index: number) {
  if (!index)
    return 'Run';
  return `Retry #${index}`;
}

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
