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
import { TreeItem } from '../components/treeItem';
import { TabbedPane } from '../traceViewer/ui/tabbedPane';
import { msToString } from '../uiUtils';
import type { ProjectTreeItem, SuiteTreeItem, TestCase, TestResult, TestStep, TestTreeItem, TestFile, Stats, TestAttachment, FailedFile, HTMLReport } from '@playwright/test/src/reporters/html';

export const Report: React.FC = () => {
  const [mode, setMode] = React.useState<'initial' | 'all' | 'test'>(computeMode());
  const [fetchError, setFetchError] = React.useState<string | undefined>();
  const [failedFiles, setFailedFiles] = React.useState<FailedFile[]>([]);
  const [report, setReport] = React.useState<HTMLReport | undefined>();

  React.useEffect(() => {
    (async () => {
      try {
        const [report, failures] = await Promise.all([
          fetch('data/report.json', { cache: 'no-cache' }).then(r => r.json() as Promise<HTMLReport>),
          fetch('data/failures.json', { cache: 'no-cache' }).then(r => r.json() as Promise<FailedFile[]>)
        ]);
        setReport(report);
        setFailedFiles(failures);
      } catch (e) {
        setFetchError(e.message);
      }
      window.addEventListener('popstate', () => {
        setMode(computeMode());
      });
    })();
  }, []);
  return <div className='vbox columns'>
    <div className='tab-strip'>
      <div key='failing' title='Failing Tests' className={'tab-element' + (mode === 'initial' ? ' selected' : '')}><Link href='/'>Failing</Link></div>
      <div key='all' title='All Tests' className={'tab-element' + (mode === 'all' ? ' selected' : '')}><Link href='/?all'>All Tests</Link></div>
    </div>
    {!fetchError && <div className='flow-container'>
      <Route params=''>
        <FailedTestsView failedFiles={failedFiles}></FailedTestsView>
      </Route>
      <Route params='all'>
        {report?.projects.map((project, i) => <ProjectTreeItemView key={i} project={project}></ProjectTreeItemView>)}
      </Route>
      <Route params='testId'>
        <TestCaseView testIdToFileId={report?.testIdToFileId}></TestCaseView>
      </Route>
    </div>}
  </div>;
};

const ProjectTreeItemView: React.FC<{
  project: ProjectTreeItem;
}> = ({ project }) => {
  return <TreeItem title={<div className='hbox'>
    <div className='tree-text'>{project.name || 'Project'}</div>
    <div style={{ flex: 'auto' }}></div>
    <StatsView stats={project.stats}></StatsView>
  </div>
  } loadChildren={() => {
    return project.suites.map((s, i) => <SuiteTreeItemView key={i} suite={s} depth={1}></SuiteTreeItemView>) || [];
  }} depth={0} expandByDefault={true}></TreeItem>;
};

const SuiteTreeItemView: React.FC<{
  suite: SuiteTreeItem,
  depth: number,
}> = ({ suite, depth }) => {
  return <TreeItem title={<div className='hbox'>
    <div className='tree-text' title={suite.title}>{suite.title || '<untitled>'}</div>
    <div style={{ flex: 'auto' }}></div>
    <StatsView stats={suite.stats}></StatsView>
  </div>
  } loadChildren={() => {
    const suiteChildren = suite.suites.map((s, i) => <SuiteTreeItemView key={i} suite={s} depth={depth + 1}></SuiteTreeItemView>) || [];
    const suiteCount = suite.suites.length;
    const testChildren = suite.tests.map((t, i) => <TestTreeItemView key={i + suiteCount} test={t} depth={depth + 1}></TestTreeItemView>) || [];
    return [...suiteChildren, ...testChildren];
  }} depth={depth}></TreeItem>;
};

const TestTreeItemView: React.FC<{
  test: TestTreeItem,
  depth: number,
}> = ({ test, depth }) => {
  return <TreeItem title={
    <Link href={`/?testId=${test.testId}`}>
      <div className='hbox'>
        {statusIcon(test.outcome)}<div className='tree-text' title={test.title}>{test.title}</div>
        <div style={{ flex: 'auto' }}></div>
        {<div style={{ flex: 'none', padding: '0 4px', color: '#666' }}>{msToString(test.duration)}</div>}
      </div>
    </Link>
  } depth={depth}></TreeItem>;
};

const TestCaseView: React.FC<{
  testIdToFileId?: { [key: string]: string }
}> = ({ testIdToFileId }) => {
  const [test, setTest] = React.useState<TestCase | undefined>();
  React.useEffect(() => {
    (async () => {
      const testId = new URL(window.location.href).searchParams.get('testId');
      if (!testId || testId === test?.testId)
        return;
      const fileId = testIdToFileId?.[testId];
      if (!fileId)
        return;
      const result = await fetch(`/data/${fileId}.json`, { cache: 'no-cache' });
      const file = await result.json() as TestFile;
      for (const t of file.tests) {
        if (t.testId === testId) {
          setTest(t);
          break;
        }
      }
    })();
  });

  const [selectedResultIndex, setSelectedResultIndex] = React.useState(0);
  return <div className='test-case-column vbox'>
    { test && <div className='test-case-title'>{test?.title}</div> }
    { test && <div className='test-case-location'>{test.path.join(' › ')}</div> }
    { test && <TabbedPane tabs={
      test.results.map((result, index) => ({
        id: String(index),
        title: <div style={{ display: 'flex', alignItems: 'center' }}>{statusIcon(result.status)} {retryLabel(index)}</div>,
        render: () => <TestResultView test={test!} result={result}></TestResultView>
      })) || []} selectedTab={String(selectedResultIndex)} setSelectedTab={id => setSelectedResultIndex(+id)} />}
  </div>;
};

const TestResultView: React.FC<{
  test: TestCase,
  result: TestResult,
}> = ({ result }) => {

  const { screenshots, videos, traces, otherAttachments, attachmentsMap } = React.useMemo(() => {
    const attachmentsMap = new Map<string, TestAttachment>();
    const attachments = result?.attachments || [];
    const otherAttachments: TestAttachment[] = [];
    const screenshots = attachments.filter(a => a.name === 'screenshot');
    const videos = attachments.filter(a => a.name === 'video');
    const traces = attachments.filter(a => a.name === 'trace');
    const knownNames = new Set(['screenshot', 'image', 'expected', 'actual', 'diff', 'video', 'trace']);
    for (const a of attachments) {
      attachmentsMap.set(a.name, a);
      if (!knownNames.has(a.name))
        otherAttachments.push(a);
    }
    return { attachmentsMap, screenshots, videos, otherAttachments, traces };
  }, [ result ]);

  const expected = attachmentsMap.get('expected');
  const actual = attachmentsMap.get('actual');
  const diff = attachmentsMap.get('diff');
  return <div className='test-result'>
    {result.error && <Chip header='Errors'>
      <ErrorMessage key='error-message' error={result.error} mode='light'></ErrorMessage>
    </Chip>}
    {!!result.steps.length && <Chip header='Test Steps'>
      {result.steps.map((step, i) => <StepTreeItem key={`step-${i}`} step={step} depth={0}></StepTreeItem>)}
    </Chip>}

    {expected && actual && <div className='vbox'>
      <Chip header='Image mismatch'>
        <ImageDiff actual={actual} expected={expected} diff={diff}></ImageDiff>
        <AttachmentLink key={`expected`} attachment={expected}></AttachmentLink>
        <AttachmentLink key={`actual`} attachment={actual}></AttachmentLink>
        {diff && <AttachmentLink key={`diff`} attachment={diff}></AttachmentLink>}
      </Chip>
    </div>}

    {!!screenshots.length && <Chip header='Screenshots'>
      {screenshots.map((a, i) => {
        return <div key={`screenshot-${i}`} className='vbox'>
          <img src={a.path} />
          <AttachmentLink attachment={a}></AttachmentLink>
        </div>;
      })}
    </Chip>}

    {!!traces.length && <Chip header='Traces'>
      {traces.map((a, i) => <div key={`trace-${i}`} className='vbox'>
        <AttachmentLink attachment={a} href={`trace/index.html?trace=${window.location.origin}/` + a.path}></AttachmentLink>
      </div>)}
    </Chip>}

    {!!videos.length && <Chip header='Videos'>
      {videos.map((a, i) => <div key={`video-${i}`} className='vbox'>
        <video controls>
          <source src={a.path} type={a.contentType}/>
        </video>
        <AttachmentLink attachment={a}></AttachmentLink>
      </div>)}
    </Chip>}

    {!!otherAttachments.length && <Chip header='Attachments'>
      {otherAttachments.map((a, i) => <AttachmentLink key={`attachment-link-${i}`} attachment={a}></AttachmentLink>)}
    </Chip>}
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
      children.unshift(<ErrorMessage key={-1} error={step.error} mode='light'></ErrorMessage>);
    return children;
  } : undefined} depth={depth}></TreeItem>;
};

const StatsView: React.FC<{
  stats: Stats
}> = ({ stats }) => {
  return <div className='hbox' style={{ flex: 'none' }}>
    {!!stats.expected && <div className='stats expected' title='Passed'>{stats.expected}</div>}
    {!!stats.unexpected && <div className='stats unexpected' title='Failed'>{stats.unexpected}</div>}
    {!!stats.flaky && <div className='stats flaky' title='Flaky'>{stats.flaky}</div>}
    {!!stats.skipped && <div className='stats skipped' title='Skipped'>{stats.skipped}</div>}
  </div>;
};

const AttachmentLink: React.FunctionComponent<{
  attachment: TestAttachment,
  href?: string,
}> = ({ attachment, href }) => {
  return <TreeItem title={<div style={{ display: 'flex', alignItems: 'center', flex: 'auto' }}>
    <span className={'codicon codicon-cloud-download'}></span>
    {attachment.path && <a href={href || attachment.path} target='_blank'>{attachment.name}</a>}
    {attachment.body && <span>{attachment.name}</span>}
  </div>} loadChildren={attachment.body ? () => {
    return [<div className='attachment-body'>{attachment.body}</div>];
  } : undefined} depth={0}></TreeItem>;
};

const ImageDiff: React.FunctionComponent<{
 actual: TestAttachment,
 expected: TestAttachment,
 diff?: TestAttachment,
}> = ({ actual, expected, diff }) => {
  const [selectedTab, setSelectedTab] = React.useState<string>('actual');
  const tabs = [];
  tabs.push({
    id: 'actual',
    title: 'Actual',
    render: () => <img src={actual.path}/>
  });
  tabs.push({
    id: 'expected',
    title: 'Expected',
    render: () => <img src={expected.path}/>
  });
  if (diff) {
    tabs.push({
      id: 'diff',
      title: 'Diff',
      render: () => <img src={diff.path}/>
    });
  }
  return <div className='vbox test-image-mismatch'>
    <TabbedPane tabs={tabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
  </div>;
};

const FailedTestsView: React.FC<{
  failedFiles: FailedFile[]
}> = ({ failedFiles }) => {
  return <div className='failed-tests'>
    {failedFiles.map((file, i) =>
      <Chip key={`snippet-${i}`} header={
        <span>
          {file.fileName}
          <span className='failed-file-subtitle'>— {file.tests.length} failure{file.tests.length > 1 ? 's' : ''}</span>
        </span>}>
        {file.tests.map((t, i) =>
          <div key={`test-${i}`} className='failed-test'>
            <Link href={`/?testId=${t.testId}`}>
              <div>
                <div className='failed-test-title'>{i + 1}) {t.title}</div>
                <div className='hbox'>
                  <div className='failed-test-path'>{t.location.file}:{t.location.column}</div>
                  {!!t.path.length && <div className='failed-test-path'> › {t.path.join(' › ')}</div>}
                </div>
              </div>
              {t.errors.map((e, i) => <ErrorMessage key={`error-message-${i}`} error={e} mode='light'></ErrorMessage>)}
            </Link>
          </div>
        )}
      </Chip>)}
  </div>;
};

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

function retryLabel(index: number) {
  if (!index)
    return 'Run';
  return `Retry #${index}`;
}

const ErrorMessage: React.FC<{
  error: string;
  mode: 'dark' | 'light'
}> = ({ error, mode }) => {
  const html = React.useMemo(() => {
    const config: any = {
      fg: mode === 'dark' ? '#FFF' : '#252423',
      bg: mode === 'dark' ? '#252423' : '#FFF',
    };
    if (mode === 'dark')
      config.colors = ansiColors;
    return new ansi2html(config).toHtml(escapeHTML(error));
  }, [error, mode]);
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

const Chip: React.FunctionComponent<{
  header: JSX.Element | string,
  children: any
}> = ({ header, children }) => {
  return <div className='chip'>
    <div className='chip-header'>{header}</div>
    <div className='chip-body'>{children}</div>
  </div>;
};

const Link: React.FunctionComponent<{
  href: string,
  children: any
}> = ({ href, children }) => {
  return <a onClick={event => {
    event.preventDefault();
    window.history.pushState({}, '', href);
    const navEvent = new PopStateEvent('popstate');
    window.dispatchEvent(navEvent);
  }} className='no-decorations' href={href}>{children}</a>;
};

const Route: React.FunctionComponent<{
  params: string,
  children: any
}> = ({ params, children }) => {
  const initialParams = [...new URL(window.location.href).searchParams.keys()].join('&');
  const [currentParams, setCurrentParam] = React.useState(initialParams);
  React.useEffect(() => {
    const listener = () => {
      const newParams = [...new URL(window.location.href).searchParams.keys()].join('&');
      setCurrentParam(newParams);
    };
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  return currentParams === params ? children : null;
};

function computeMode(): 'initial' | 'all' | 'test' {
  if (window.location.search === '?all')
    return 'all';
  if (window.location.search.includes('testId'))
    return 'test';
  return 'initial';
}
