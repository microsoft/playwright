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
import { Source, SourceProps } from '../components/source';

type Filter = 'Failing' | 'All';

export const Report: React.FC = () => {
  const [report, setReport] = React.useState<JsonReport | undefined>();
  const [selectedTest, setSelectedTest] = React.useState<JsonTestCase | undefined>();

  React.useEffect(() => {
    (async () => {
      const result = await fetch('report.json');
      const json = (await result.json()) as JsonReport;
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
    <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true}>
      <TestCaseView test={selectedTest}></TestCaseView>
      <div className='suite-tree-column'>
        <div className='tab-strip'>{
          (['Failing', 'All'] as Filter[]).map(item => {
            const selected = item === filter;
            return <div key={item} className={'tab-element' + (selected ? ' selected' : '')} onClick={e => {
              setFilter(item);
            }}>{item}</div>;
          })
        }</div>
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
    const suiteCount = suite ? suite.suites.length : 0;
    const testChildren = suite?.tests.map((t, i) => <TestTreeItem key={i + suiteCount} test={t} setSelectedTest={setSelectedTest} selectedTest={selectedTest} showFileName={false} depth={depth + 1}></TestTreeItem>) || [];
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
  test: JsonTestCase | undefined,
}> = ({ test }) => {
  const [selectedResultIndex, setSelectedResultIndex] = React.useState(0);
  const [selectedStep, setSelectedStep] = React.useState<JsonTestStep | undefined>(undefined);
  const result = test?.results[selectedResultIndex];
  return <SplitView sidebarSize={500} orientation='horizontal' sidebarIsFirst={true}>
    <div className='test-details-column vbox'>
      {!selectedStep && <TestResultDetails test={test} result={result} />}
      {!!selectedStep && <TestStepDetails test={test} result={result} step={selectedStep}/>}
    </div>
    <div className='test-case-column vbox'>
      { test && <div className='test-case-title' onClick={() => setSelectedStep(undefined)}>{test?.title}</div> }
      { test && <div className='test-case-location' onClick={() => setSelectedStep(undefined)}>{renderLocation(test.location, true)}</div> }
      { test && <TabbedPane tabs={
        test?.results.map((result, index) => ({
          id: String(index),
          title: <div style={{ display: 'flex', alignItems: 'center' }}>{statusIcon(result.status)} {retryLabel(index)}</div>,
          render: () => <TestResultView test={test} result={result} selectedStep={selectedStep} setSelectedStep={setSelectedStep}></TestResultView>
        })) || []} selectedTab={String(selectedResultIndex)} setSelectedTab={id => setSelectedResultIndex(+id)} />}
    </div>
  </SplitView>;
};

const TestResultView: React.FC<{
  test: JsonTestCase,
  result: JsonTestResult,
  selectedStep: JsonTestStep | undefined,
  setSelectedStep: (step: JsonTestStep | undefined) => void;
}> = ({ test, result, selectedStep, setSelectedStep }) => {
  return <div className='test-result'>
    {result.steps.map((step, i) => <StepTreeItem key={i} step={step} depth={0} selectedStep={selectedStep} setSelectedStep={setSelectedStep}></StepTreeItem>)}
  </div>;
};

const TestResultDetails: React.FC<{
  test: JsonTestCase | undefined,
  result: JsonTestResult | undefined,
}> = ({ test, result }) => {
  const [selectedTab, setSelectedTab] = React.useState('errors');
  const [source, setSource] = React.useState<SourceProps>({ text: '', language: 'javascript' });
  React.useEffect(() => {
    (async () => {
      if (!test || !test.location.sha1)
        return;
      try {
        const response = await fetch('resources/' + test.location.sha1);
        const text = await response.text();
        setSource({ text, language: 'javascript', highlight: [{ line: test.location.line, type: 'paused' }], revealLine: test.location.line });
      } catch (e) {
        setSource({ text: '', language: 'javascript' });
      }
    })();
  }, [test]);
  const { screenshots, video, attachmentsMap } = React.useMemo(() => {
    const attachmentsMap = new Map<string, JsonAttachment>();
    const attachments = result?.attachments || [];
    const screenshots = attachments.filter(a => a.name === 'screenshot');
    const video = attachments.filter(a => a.name === 'video');
    for (const a of attachments)
      attachmentsMap.set(a.name, a);
    return { attachmentsMap, screenshots, video };
  }, [ result ]);
  if (!result)
    return <div></div>;
  return <div className='vbox'>
    <TabbedPane selectedTab={selectedTab} setSelectedTab={setSelectedTab} tabs={[
      {
        id: 'errors',
        title: 'Errors',
        render: () => {
          return <div style={{ overflow: 'auto' }}>
            <div className='error-message' dangerouslySetInnerHTML={{ __html: new ansi2html({ colors: ansiColors }).toHtml(escapeHTML(result.failureSnippet?.trim() || '')) }}></div>
            {attachmentsMap.has('expected') && attachmentsMap.has('actual') && <ImageDiff actual={attachmentsMap.get('actual')!} expected={attachmentsMap.get('expected')!} diff={attachmentsMap.get('diff')}></ImageDiff>}
          </div>;
        }
      },
      {
        id: 'results',
        title: 'Results',
        render: () => {
          return <div style={{ overflow: 'auto' }}>
            {screenshots.map(a => <div className='image-preview'><img src={'resources/' + a.sha1} /></div>)}
            {video.map(a => <div className='image-preview'>
              <video controls>
                <source src={'resources/' + a.sha1} type={a.contentType}/>
              </video>
            </div>)}
            {!!result.attachments && <div className='test-overview-title'>Attachments</div>}
            {result.attachments.map(a => <AttachmentLink attachment={a}></AttachmentLink>)}
          </div>;
        }
      },
      {
        id: 'source',
        title: 'Source',
        render: () => <Source text={source.text} language={source.language} highlight={source.highlight} revealLine={source.revealLine}></Source>
      }
    ]}></TabbedPane>
  </div>;
};

const TestStepDetails: React.FC<{
  test: JsonTestCase | undefined,
  result: JsonTestResult | undefined,
  step: JsonTestStep | undefined,
}> = ({ test, result, step }) => {
  const [source, setSource] = React.useState<SourceProps>({ text: '', language: 'javascript' });
  React.useEffect(() => {
    (async () => {
      const frame = step?.stack?.[0];
      if (!frame || !frame.sha1)
        return;
      try {
        const response = await fetch('resources/' + frame.sha1);
        const text = await response.text();
        setSource({ text, language: 'javascript', highlight: [{ line: frame.line, type: 'paused' }], revealLine: frame.line });
      } catch (e) {
        setSource({ text: '', language: 'javascript' });
      }
    })();
  }, [step]);
  const [selectedTab, setSelectedTab] = React.useState('log');
  return <div className='vbox'>
    <TabbedPane selectedTab={selectedTab} setSelectedTab={setSelectedTab} tabs={[
      {
        id: 'log',
        title: 'Log',
        render: () => <div className='step-log'>{step?.log ? step.log.join('\n') : ''}</div>
      },
      {
        id: 'errors',
        title: 'Errors',
        render: () => <div className='error-message' dangerouslySetInnerHTML={{ __html: new ansi2html({ colors: ansiColors }).toHtml(escapeHTML(step?.failureSnippet?.trim() || '')) }}></div>
      },
      {
        id: 'source',
        title: 'Source',
        render: () => <Source text={source.text} language={source.language} highlight={source.highlight} revealLine={source.revealLine}></Source>
      }
    ]}></TabbedPane>
  </div>;
};

const StepTreeItem: React.FC<{
  step: JsonTestStep;
  depth: number,
  selectedStep?: JsonTestStep,
  setSelectedStep: (step: JsonTestStep | undefined) => void;
}> = ({ step, depth, selectedStep, setSelectedStep }) => {
  return <TreeItem title={<div style={{ display: 'flex', alignItems: 'center', flex: 'auto' }}>
    {testStepStatusIcon(step)}
    <span style={{ whiteSpace: 'pre' }}>{step.preview || step.title}</span>
    <div style={{ flex: 'auto' }}></div>
    <div>{msToString(step.duration)}</div>
  </div>} loadChildren={step.steps.length ? () => {
    return step.steps.map((s, i) => <StepTreeItem key={i} step={s} depth={depth + 1} selectedStep={selectedStep} setSelectedStep={setSelectedStep}></StepTreeItem>);
  } : undefined} depth={depth} selected={step === selectedStep} onClick={() => setSelectedStep(step)}></TreeItem>;
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
  return <TreeItem title={<div style={{ display: 'flex', alignItems: 'center', flex: 'auto' }}>
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

function escapeHTML(text: string): string {
  return text.replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]!));
}
