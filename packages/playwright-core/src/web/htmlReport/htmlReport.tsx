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
import { downArrow, rightArrow, TreeItem } from '../components/treeItem';
import { TabbedPane } from '../traceViewer/ui/tabbedPane';
import { msToString } from '../uiUtils';
import type { TestCase, TestResult, TestStep, TestFile, Stats, TestAttachment, HTMLReport, TestFileSummary } from '@playwright/test/src/reporters/html';

export const Report: React.FC = () => {
  const [fetchError, setFetchError] = React.useState<string | undefined>();
  const [report, setReport] = React.useState<HTMLReport | undefined>();
  const [expandedFiles, setExpandedFiles] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (report)
      return;
    (async () => {
      try {
        const report = await fetch('data/report.json', { cache: 'no-cache' }).then(r => r.json() as Promise<HTMLReport>);
        if (report.files.length)
          expandedFiles.add(report.files[0].fileId);
        setReport(report);
      } catch (e) {
        setFetchError(e.message);
      }
    })();
  }, [report, expandedFiles]);

  return <div className='vbox columns'>
    {!fetchError && <div className='flow-container'>
      <Route params=''>
        <AllTestFilesSummaryView report={report} isFileExpanded={fileId => expandedFiles.has(fileId)} setFileExpanded={(fileId, expanded) => {
          const newExpanded = new Set(expandedFiles);
          if (expanded)
            newExpanded.add(fileId);
          else
            newExpanded.delete(fileId);
          setExpandedFiles(newExpanded);
        }}></AllTestFilesSummaryView>
      </Route>
      <Route params='testId'>
        {!!report && <TestCaseView report={report}></TestCaseView>}
      </Route>
    </div>}
  </div>;
};

const AllTestFilesSummaryView: React.FC<{
  report?: HTMLReport;
  isFileExpanded: (fileId: string) => boolean;
  setFileExpanded: (fileId: string, expanded: boolean) => void;
}> = ({ report, isFileExpanded, setFileExpanded }) => {
  return <div className='file-summary-list'>
    {report && <div className='global-stats'>
      <span>Ran {report.stats.total} tests</span>
      <StatsView stats={report.stats}></StatsView>
    </div>}
    {report && (report.files || []).map((file, i) => <TestFileSummaryView key={`file-${i}`} report={report} file={file} isFileExpanded={isFileExpanded} setFileExpanded={setFileExpanded}></TestFileSummaryView>)}
  </div>;
};

const TestFileSummaryView: React.FC<{
  report: HTMLReport;
  file: TestFileSummary;
  isFileExpanded: (fileId: string) => boolean;
  setFileExpanded: (fileId: string, expanded: boolean) => void;
}> = ({ file, report, isFileExpanded, setFileExpanded }) => {
  return <Chip
    expanded={isFileExpanded(file.fileId)}
    setExpanded={(expanded => setFileExpanded(file.fileId, expanded))}
    header={<span>
      <span style={{ float: 'right' }}>{msToString(file.stats.duration)}</span>
      {file.fileName}
      <StatsView stats={file.stats}></StatsView>
    </span>}>
    {file.tests.map((test, i) => <Link key={`test-${i}`} href={`?testId=${test.testId}`}>
      <div className={'test-summary outcome-' + test.outcome}>
        <span style={{ float: 'right' }}>{msToString(test.duration)}</span>
        {statusIcon(test.outcome)}
        {test.title}
        <span className='test-summary-path'>— {test.path.join(' › ')}</span>
        {report.projectNames.length > 1 && !!test.projectName && <span className={'label label-color-' + (report.projectNames.indexOf(test.projectName) % 8)}>{test.projectName}</span>}
      </div>
    </Link>)}
  </Chip>;
};

const TestCaseView: React.FC<{
  report: HTMLReport,
}> = ({ report }) => {
  const [test, setTest] = React.useState<TestCase | undefined>();
  React.useEffect(() => {
    (async () => {
      const testId = new URL(window.location.href).searchParams.get('testId');
      if (!testId || testId === test?.testId)
        return;
      const fileId = testId.split('-')[0];
      if (!fileId)
        return;
      const result = await fetch(`data/${fileId}.json`, { cache: 'no-cache' });
      const file = await result.json() as TestFile;
      for (const t of file.tests) {
        if (t.testId === testId) {
          setTest(t);
          break;
        }
      }
    })();
  }, [test, report]);

  const [selectedResultIndex, setSelectedResultIndex] = React.useState(0);
  return <div className='test-case-column vbox'>
    {test && <div className='test-case-title'>{test?.title}</div>}
    {test && <div className='test-case-location'>{test.path.join(' › ')}</div>}
    {test && !!test.projectName && <div><span className={'label label-color-' + (report.projectNames.indexOf(test.projectName) % 8)}>{test.projectName}</span></div>}
    {test && <TabbedPane tabs={
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
      <ErrorMessage key='error-message' error={result.error}></ErrorMessage>
    </Chip>}
    {!!result.steps.length && <Chip header='Test Steps'>
      {result.steps.map((step, i) => <StepTreeItem key={`step-${i}`} step={step} depth={0}></StepTreeItem>)}
    </Chip>}

    {expected && actual && <Chip header='Image mismatch'>
      <ImageDiff actual={actual} expected={expected} diff={diff}></ImageDiff>
      <AttachmentLink key={`expected`} attachment={expected}></AttachmentLink>
      <AttachmentLink key={`actual`} attachment={actual}></AttachmentLink>
      {diff && <AttachmentLink key={`diff`} attachment={diff}></AttachmentLink>}
    </Chip>}

    {!!screenshots.length && <Chip header='Screenshots'>
      {screenshots.map((a, i) => {
        return <div key={`screenshot-${i}`}>
          <img src={a.path} />
          <AttachmentLink attachment={a}></AttachmentLink>
        </div>;
      })}
    </Chip>}

    {!!traces.length && <Chip header='Traces'>
      {traces.map((a, i) => <div key={`trace-${i}`}>
        <a href={`trace/index.html?trace=${new URL(a.path!, window.location.href)}`}>
          <img src='trace.png' style={{ width: 192, height: 117, marginLeft: 20 }} />
        </a>
      </div>)}
    </Chip>}

    {!!videos.length && <Chip header='Videos'>
      {videos.map((a, i) => <div key={`video-${i}`}>
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
  return <TreeItem title={<span>
    <span style={{ float: 'right' }}>{msToString(step.duration)}</span>
    {statusIcon(step.error ? 'failed' : 'passed')}
    <span>{step.title}</span>
    {step.location && <span className='test-summary-path'>— {step.location.file}:{step.location.line}</span>}
  </span>} loadChildren={step.steps.length + (step.snippet ? 1 : 0) ? () => {
    const children = step.steps.map((s, i) => <StepTreeItem key={i} step={s} depth={depth + 1}></StepTreeItem>);
    if (step.snippet)
      children.unshift(<ErrorMessage key='line' error={step.snippet}></ErrorMessage>);
    return children;
  } : undefined} depth={depth}></TreeItem>;
};

const StatsView: React.FC<{
  stats: Stats
}> = ({ stats }) => {
  return <span className='stats-line'>
    —
    {!!stats.unexpected && <span className='stats unexpected'>{stats.unexpected} failed</span>}
    {!!stats.flaky && <span className='stats flaky'>{stats.flaky} flaky</span>}
    {!!stats.expected && <span className='stats expected'>{stats.expected} passed</span>}
    {!!stats.skipped && <span className='stats skipped'>{stats.skipped} skipped</span>}
  </span>;
};

const AttachmentLink: React.FunctionComponent<{
  attachment: TestAttachment,
  href?: string,
}> = ({ attachment, href }) => {
  return <TreeItem title={<span>
    <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-fg-muted'>
      <path fillRule='evenodd' d='M3.5 1.75a.25.25 0 01.25-.25h3a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h2.086a.25.25 0 01.177.073l2.914 2.914a.25.25 0 01.073.177v8.586a.25.25 0 01-.25.25h-.5a.75.75 0 000 1.5h.5A1.75 1.75 0 0014 13.25V4.664c0-.464-.184-.909-.513-1.237L10.573.513A1.75 1.75 0 009.336 0H3.75A1.75 1.75 0 002 1.75v11.5c0 .649.353 1.214.874 1.515a.75.75 0 10.752-1.298.25.25 0 01-.126-.217V1.75zM8.75 3a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zM6 5.25a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5A.75.75 0 016 5.25zm2 1.5A.75.75 0 018.75 6h.5a.75.75 0 010 1.5h-.5A.75.75 0 018 6.75zm-1.25.75a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zM8 9.75A.75.75 0 018.75 9h.5a.75.75 0 010 1.5h-.5A.75.75 0 018 9.75zm-.75.75a1.75 1.75 0 00-1.75 1.75v3c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75v-3a1.75 1.75 0 00-1.75-1.75h-.5zM7 12.25a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v2.25H7v-2.25z'></path>
    </svg>
    {attachment.path && <a href={href || attachment.path} target='_blank'>{attachment.name}</a>}
    {attachment.body && <span>{attachment.name}</span>}
  </span>} loadChildren={attachment.body ? () => {
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

function statusIcon(status: 'failed' | 'timedOut' | 'skipped' | 'passed' | 'expected' | 'unexpected' | 'flaky'): JSX.Element {
  switch (status) {
    case 'failed':
    case 'unexpected':
      return <svg className='octicon color-text-danger' viewBox='0 0 16 16' version='1.1' width='16' height='16' aria-hidden='true'>
        <path fillRule='evenodd' d='M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z'></path>
      </svg>;
    case 'passed':
    case 'expected':
      return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-icon-success'>
        <path fillRule='evenodd' d='M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z'></path>
      </svg>;
    case 'timedOut':
      return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-text-danger'>
        <path fillRule='evenodd' d='M5.75.75A.75.75 0 016.5 0h3a.75.75 0 010 1.5h-.75v1l-.001.041a6.718 6.718 0 013.464 1.435l.007-.006.75-.75a.75.75 0 111.06 1.06l-.75.75-.006.007a6.75 6.75 0 11-10.548 0L2.72 5.03l-.75-.75a.75.75 0 011.06-1.06l.75.75.007.006A6.718 6.718 0 017.25 2.541a.756.756 0 010-.041v-1H6.5a.75.75 0 01-.75-.75zM8 14.5A5.25 5.25 0 108 4a5.25 5.25 0 000 10.5zm.389-6.7l1.33-1.33a.75.75 0 111.061 1.06L9.45 8.861A1.502 1.502 0 018 10.75a1.5 1.5 0 11.389-2.95z'></path>
      </svg>;
    case 'flaky':
      return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-text-warning'>
        <path fillRule='evenodd' d='M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z'></path>
      </svg>;
    case 'skipped':
      return <svg className='octicon' viewBox='0 0 16 16' version='1.1' width='16' height='16' aria-hidden='true'></svg>;
  }
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
    const config: any = {
      bg: 'var(--color-canvas-subtle)',
      fg: 'var(--color-fg-default)',
    };
    config.colors = ansiColors;
    return new ansi2html(config).toHtml(escapeHTML(error));
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

const Chip: React.FunctionComponent<{
  header: JSX.Element | string,
  expanded?: boolean,
  setExpanded?: (expanded: boolean) => void,
  children?: any
}> = ({ header, expanded, setExpanded, children }) => {
  return <div className='chip'>
    <div className={'chip-header' + (setExpanded ? ' expanded-' + expanded : '')} onClick={() => setExpanded?.(!expanded)}>
      {setExpanded && !!expanded && downArrow()}
      {setExpanded && !expanded && rightArrow()}
      {header}
    </div>
    { (!setExpanded || expanded) && <div className='chip-body'>{children}</div>}
  </div>;
};

function navigate(href: string) {
  window.history.pushState({}, '', href);
  const navEvent = new PopStateEvent('popstate');
  window.dispatchEvent(navEvent);
}

const Link: React.FunctionComponent<{
  href: string,
  children: any
}> = ({ href, children }) => {
  return <a onClick={event => {
    event.preventDefault();
    navigate(href);
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
