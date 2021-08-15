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
import type { JsonAttachment, JsonLocation, JsonReport, JsonSuite, JsonTestCase, JsonTestResult, JsonTestStep } from '../../test/reporters/html';
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

  const { unexpectedTests, unexpectedTestCount } = React.useMemo(() => {
    const unexpectedTests = new Map<JsonSuite, JsonTestCase[]>();
    let unexpectedTestCount = 0;
    for (const project of report?.suites || []) {
      const unexpected = computeUnexpectedTests(project);
      unexpectedTestCount += unexpected.length;
      unexpectedTests.set(project, unexpected);
    }
    return { unexpectedTests, unexpectedTestCount };
  }, [report]);

  return <div className='hbox'>
    <FilterView filter={filter} setFilter={setFilter}></FilterView>
    <SplitView sidebarSize={500} orientation='horizontal' sidebarIsFirst={true}>
      <TestCaseView test={selectedTest}></TestCaseView>
      <div className='suite-tree'>
        {filter === 'All' && report?.suites.map((s, i) => <ProjectTreeItem key={i} suite={s} setSelectedTest={setSelectedTest} selectedTest={selectedTest}></ProjectTreeItem>)}
        {filter === 'Failing' && !!unexpectedTestCount && report?.suites.map((s, i) => {
          const hasUnexpectedOutcomes = !!unexpectedTests.get(s)?.length;
          return hasUnexpectedOutcomes && <ProjectFlatTreeItem key={i} suite={s} setSelectedTest={setSelectedTest} selectedTest={selectedTest} unexpectedTests={unexpectedTests.get(s)!}></ProjectFlatTreeItem>;
        })}
        {filter === 'Failing' && !unexpectedTestCount && <div className='awesome'>You are awesome!</div>}
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
  const location = renderLocation(suite?.location, true);

  return <TreeItem title={<div className='hbox'>
    <div style={{ flex: 'auto', alignItems: 'center', display: 'flex' }}>{testSuiteErrorStatusIcon(suite) || statusIcon('passed')}<div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{suite?.title || 'Project'}</div></div>
    {!!suite?.location?.line && location && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{location}</div>}
  </div>
  } loadChildren={() => {
    return suite?.suites.map((s, i) => <SuiteTreeItem key={i} suite={s} setSelectedTest={setSelectedTest} selectedTest={selectedTest} depth={1} showFileName={true}></SuiteTreeItem>) || [];
  }} depth={0} expandByDefault={true}></TreeItem>;
};

const ProjectFlatTreeItem: React.FC<{
  suite?: JsonSuite;
  unexpectedTests: JsonTestCase[],
  selectedTest?: JsonTestCase,
  setSelectedTest: (test: JsonTestCase) => void;
}> = ({ suite, setSelectedTest, selectedTest, unexpectedTests }) => {
  const location = renderLocation(suite?.location, true);

  return <TreeItem title={<div className='hbox'>
    <div style={{ flex: 'auto', alignItems: 'center', display: 'flex' }}>{testSuiteErrorStatusIcon(suite) || statusIcon('passed')}<div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{suite?.title || 'Project'}</div></div>
    {!!suite?.location?.line && location && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{location}</div>}
  </div>
  } loadChildren={() => {
    return unexpectedTests.map((t, i) => <TestTreeItem key={i} test={t} setSelectedTest={setSelectedTest} selectedTest={selectedTest} showFileName={false} depth={1}></TestTreeItem>) || [];
  }} depth={0} expandByDefault={true}></TreeItem>;
};

const SuiteTreeItem: React.FC<{
  suite?: JsonSuite;
  selectedTest?: JsonTestCase,
  setSelectedTest: (test: JsonTestCase) => void;
  depth: number,
  showFileName: boolean,
}> = ({ suite, setSelectedTest, selectedTest, showFileName, depth }) => {
  const location = renderLocation(suite?.location, showFileName);
  return <TreeItem title={<div className='hbox'>
    <div style={{ flex: 'auto', alignItems: 'center', display: 'flex' }}>{testSuiteErrorStatusIcon(suite) || statusIcon('passed')}<div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{suite?.title}</div></div>
    {!!suite?.location?.line && location && <div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{location}</div>}
  </div>
  } loadChildren={() => {
    const suiteChildren = suite?.suites.map((s, i) => <SuiteTreeItem key={i} suite={s} setSelectedTest={setSelectedTest} selectedTest={selectedTest} depth={depth + 1} showFileName={false}></SuiteTreeItem>) || [];
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
  const { screenshots, attachmentsMap } = React.useMemo(() => {
    const attachmentsMap = new Map<string, JsonAttachment>();
    const screenshots = result.attachments.filter(a => a.name === 'screenshot');
    for (const a of result.attachments)
      attachmentsMap.set(a.name, a);
    return { attachmentsMap, screenshots };
  }, [ result ]);
  return <div className="test-result">
    <div className='test-overview-title'>{test?.title}</div>
    <div className='test-overview-property'>{renderLocation(test.location, true)}<div style={{ flex: 'auto' }}></div><div>{msToString(result.duration)}</div></div>
    {result.failureSnippet && <div className='error-message' dangerouslySetInnerHTML={{ __html: new ansi2html({ colors: ansiColors }).toHtml(result.failureSnippet.trim()) }}></div>}
    {result.steps.map((step, i) => <StepTreeItem key={i} step={step} depth={0}></StepTreeItem>)}
    {attachmentsMap.has('expected') && attachmentsMap.has('actual') && <ImageDiff actual={attachmentsMap.get('actual')!} expected={attachmentsMap.get('expected')!} diff={attachmentsMap.get('diff')}></ImageDiff>}
    {!!screenshots.length && <div className='test-overview-title'>Screenshots</div>}
    {screenshots.map(a => <div className='image-preview'><img src={'resources/' + a.sha1} /></div>)}
    {!!result.attachments && <div className='test-overview-title'>Attachments</div>}
    {result.attachments.map(a => <AttachmentLink attachment={a}></AttachmentLink>)}
    <div className='test-overview-title'></div>
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

export const ImageDiff: React.FunctionComponent<{
  actual: JsonAttachment,
  expected: JsonAttachment,
  diff?: JsonAttachment,
}> = ({ actual, expected, diff }) => {
  const [selectedTab, setSelectedTab] = React.useState<string>('actual');
  const tabs = [];
  tabs.push({
    id: 'actual',
    title: 'Actual',
    render: () => <div className='image-preview'><img src={'resources/' + actual.sha1}/></div>
  });
  tabs.push({
    id: 'expected',
    title: 'Expected',
    render: () => <div className='image-preview'><img src={'resources/' + expected.sha1}/></div>
  });
  if (diff) {
    tabs.push({
      id: 'diff',
      title: 'Diff',
      render: () => <div className='image-preview'><img src={'resources/' + diff.sha1}/></div>,
    });
  }
  return <div className='vbox test-image-mismatch'>
    <div className='test-overview-title'>Image mismatch</div>
    <TabbedPane tabs={tabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
  </div>;
};

export const AttachmentLink: React.FunctionComponent<{
  attachment: JsonAttachment,
}> = ({ attachment }) => {
  return <TreeItem title={<div style={{ display: 'flex', alignItems: 'center', flex: 'auto', maxWidth: 430 }}>
    <span className={'codicon codicon-cloud-download'}></span>
    {attachment.sha1 && <a href={'resources/' + attachment.sha1} target='_blank'>{attachment.name}</a>}
    {attachment.body && <span>{attachment.name}</span>}
  </div>} loadChildren={attachment.body ? () => {
    return [<div className='attachment-body'>${attachment.body}</div>];
  } : undefined} depth={0}></TreeItem>;
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

function computeUnexpectedTests(suite: JsonSuite): JsonTestCase[] {
  const failedTests: JsonTestCase[] = [];
  const visit = (suite: JsonSuite) => {
    for (const child of suite.suites)
      visit(child);
    for (const test of suite.tests) {
      if (test.outcome !== 'expected' && test.outcome !== 'skipped')
        failedTests.push(test);
    }
  };
  visit(suite);
  return failedTests;
}

function renderLocation(location: JsonLocation | undefined, showFileName: boolean) {
  if (!location)
    return '';
  return (showFileName ? location.file : '') + ':' + location.line;
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
