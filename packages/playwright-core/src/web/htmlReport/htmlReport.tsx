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
import { traceImage } from './images';
import type { TestCase, TestResult, TestStep, TestFile, Stats, TestAttachment, HTMLReport, TestFileSummary, TestCaseSummary } from '@playwright/test/src/reporters/html';
import type zip from '@zip.js/zip.js';

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

  return <div className='vbox columns'>
    {<div className='flow-container'>
      <Route params=''>
        <AllTestFilesSummaryView report={report} filter={filter} expandedFiles={expandedFiles} setExpandedFiles={setExpandedFiles} filterText={filterText} setFilterText={setFilterText}></AllTestFilesSummaryView>
      </Route>
      <Route params='q'>
        <AllTestFilesSummaryView report={report} filter={filter} expandedFiles={expandedFiles} setExpandedFiles={setExpandedFiles} filterText={filterText} setFilterText={setFilterText}></AllTestFilesSummaryView>
      </Route>
      <Route params='testId'>
        {!!report && <TestCaseView report={report}></TestCaseView>}
      </Route>
    </div>}
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
  return <div className='file-summary-list'>
    {report && <div>
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
    {report && filteredFiles.map(({ file, defaultExpanded }) => {
      return <TestFileSummaryView
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
      </TestFileSummaryView>;
    })}
  </div>;
};

const TestFileSummaryView: React.FC<{
  report: HTMLReport;
  file: TestFileSummary;
  isFileExpanded: (fileId: string) => boolean;
  setFileExpanded: (fileId: string, expanded: boolean) => void;
  filter: Filter;
}> = ({ file, report, isFileExpanded, setFileExpanded, filter }) => {
  return <Chip
    expanded={isFileExpanded(file.fileId)}
    setExpanded={(expanded => setFileExpanded(file.fileId, expanded))}
    header={<span>
      <span style={{ float: 'right' }}>{msToString(file.stats.duration)}</span>
      {file.fileName}
    </span>}>
    {file.tests.filter(t => filter.matches(t)).map(test =>
      <div key={`test-${test.testId}`} className={'test-summary outcome-' + test.outcome}>
        <span style={{ float: 'right' }}>{msToString(test.duration)}</span>
        {report.projectNames.length > 1 && !!test.projectName &&
          <span style={{ float: 'right' }}><ProjectLink report={report} projectName={test.projectName}></ProjectLink></span>}
        {statusIcon(test.outcome)}
        <Link href={`#?testId=${test.testId}`} title={[...test.path, test.title].join(' › ')}>
          {[...test.path, test.title].join(' › ')}
          <span className='test-summary-path'>— {test.location.file}:{test.location.line}</span>
        </Link>
      </div>
    )}
  </Chip>;
};

const TestCaseView: React.FC<{
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

  const [selectedResultIndex, setSelectedResultIndex] = React.useState(0);
  return <div className='test-case-column vbox'>
    <div className='status-container ml-2 pl-2 d-flex' style={{ flexFlow: 'row-reverse' }}>
      <StatsNavView stats={report.stats}></StatsNavView>
    </div>
    {test && <div className='test-case-path'>{test.path.join(' › ')}</div>}
    {test && <div className='test-case-title'>{test?.title}</div>}
    {test && <div className='test-case-location'>{test.location.file}:{test.location.line}</div>}
    {test && !!test.projectName && <ProjectLink report={report} projectName={test.projectName}></ProjectLink>}
    {test && !!test.annotations.length && <Chip header='Annotations'>
      {test.annotations.map(a => <div className='test-case-annotation'>
        <span style={{ fontWeight: 'bold' }}>{a.type}</span>
        {a.description && <span>: {a.description}</span>}
      </div>)}
    </Chip>}
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
          <img src={traceImage} style={{ width: 192, height: 117, marginLeft: 20 }} />
          <AttachmentLink attachment={a}></AttachmentLink>
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
    {statusIcon(step.error || step.duration === -1 ? 'failed' : 'passed')}
    <span>{step.title}</span>
    {step.location && <span className='test-summary-path'>— {step.location.file}:{step.location.line}</span>}
  </span>} loadChildren={step.steps.length + (step.snippet ? 1 : 0) ? () => {
    const children = step.steps.map((s, i) => <StepTreeItem key={i} step={s} depth={depth + 1}></StepTreeItem>);
    if (step.snippet)
      children.unshift(<ErrorMessage key='line' error={step.snippet}></ErrorMessage>);
    return children;
  } : undefined} depth={depth}></TreeItem>;
};

const StatsNavView: React.FC<{
  stats: Stats
}> = ({ stats }) => {
  return <nav className='subnav-links d-flex no-wrap'>
    <Link className='subnav-item' href='#?'>
      All <span className='d-inline counter'>{stats.total}</span>
    </Link>
    <Link className='subnav-item' href='#?q=s:passed'>
      Passed <span className='d-inline counter'>{stats.expected}</span>
    </Link>
    <Link className='subnav-item' href='#?q=s:failed'>
      {!!stats.unexpected && statusIcon('unexpected')} Failed <span className='d-inline counter'>{stats.unexpected}</span>
    </Link>
    <Link className='subnav-item' href='#?q=s:flaky'>
      {!!stats.flaky && statusIcon('flaky')} Flaky <span className='d-inline counter'>{stats.flaky}</span>
    </Link>
    <Link className='subnav-item' href='#?q=s:skipped'>
      Skipped <span className='d-inline counter'>{stats.skipped}</span>
    </Link>
  </nav>;
};

const AttachmentLink: React.FunctionComponent<{
  attachment: TestAttachment,
  href?: string,
}> = ({ attachment, href }) => {
  return <TreeItem title={<span>
    {attachment.contentType === kMissingContentType ?
      <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-text-warning'>
        <path fillRule='evenodd' d='M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z'></path>
      </svg> :
      <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-fg-muted'>
        <path fillRule='evenodd' d='M3.5 1.75a.25.25 0 01.25-.25h3a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h2.086a.25.25 0 01.177.073l2.914 2.914a.25.25 0 01.073.177v8.586a.25.25 0 01-.25.25h-.5a.75.75 0 000 1.5h.5A1.75 1.75 0 0014 13.25V4.664c0-.464-.184-.909-.513-1.237L10.573.513A1.75 1.75 0 009.336 0H3.75A1.75 1.75 0 002 1.75v11.5c0 .649.353 1.214.874 1.515a.75.75 0 10.752-1.298.25.25 0 01-.126-.217V1.75zM8.75 3a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zM6 5.25a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5A.75.75 0 016 5.25zm2 1.5A.75.75 0 018.75 6h.5a.75.75 0 010 1.5h-.5A.75.75 0 018 6.75zm-1.25.75a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zM8 9.75A.75.75 0 018.75 9h.5a.75.75 0 010 1.5h-.5A.75.75 0 018 9.75zm-.75.75a1.75 1.75 0 00-1.75 1.75v3c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75v-3a1.75 1.75 0 00-1.75-1.75h-.5zM7 12.25a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v2.25H7v-2.25z'></path>
      </svg>
    }
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

const ProjectLink: React.FunctionComponent<{
  report: HTMLReport,
  projectName: string,
}> = ({ report, projectName }) => {
  const encoded = encodeURIComponent(projectName);
  const value = projectName === encoded ? projectName : `"${encoded.replace(/%22/g, '%5C%22')}"`;
  return <Link href={`#?q=p:${value}`}>
    <span className={'label label-color-' + (report.projectNames.indexOf(projectName) % 6)}>
      {projectName}
    </span>
  </Link>;
};

const Link: React.FunctionComponent<{
  href: string,
  className?: string,
  title?: string,
  children: any,
}> = ({ href, className, children, title }) => {
  return <a className={`no-decorations${className ? ' ' + className : ''}`} href={href} title={title}>{children}</a>;
};

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

class Filter {
  project: string[] = [];
  status: string[] = [];
  text: string[] = [];

  empty(): boolean {
    return this.project.length + this.status.length + this.text.length === 0;
  }

  static parse(expression: string): Filter {
    const tokens = Filter.tokenize(expression);
    const project = new Set<string>();
    const status = new Set<string>();
    const text: string[] = [];
    for (const token of tokens) {
      if (token.startsWith('p:')) {
        project.add(token.slice(2));
        continue;
      }
      if (token.startsWith('s:')) {
        status.add(token.slice(2));
        continue;
      }
      text.push(token.toLowerCase());
    }

    const filter = new Filter();
    filter.text = text;
    filter.project = [...project];
    filter.status = [...status];
    return filter;
  }

  private static tokenize(expression: string): string[] {
    const result: string[] = [];
    let quote: '\'' | '"' | undefined;
    let token: string[] = [];
    for (let i = 0; i < expression.length; ++i) {
      const c = expression[i];
      if (quote && c === '\\' && expression[i + 1] === quote) {
        token.push(quote);
        ++i;
        continue;
      }
      if (c === '"' || c === '\'') {
        if (quote === c) {
          result.push(token.join('').toLowerCase());
          token = [];
          quote = undefined;
        } else if (quote) {
          token.push(c);
        } else {
          quote = c;
        }
        continue;
      }
      if (quote) {
        token.push(c);
        continue;
      }
      if (c === ' ') {
        if (token.length) {
          result.push(token.join('').toLowerCase());
          token = [];
        }
        continue;
      }
      token.push(c);
    }
    if (token.length)
      result.push(token.join('').toLowerCase());
    return result;
  }

  matches(test: TestCaseSummary): boolean {
    if (!(test as any).searchValues) {
      let status = 'passed';
      if (test.outcome === 'unexpected')
        status = 'failed';
      if (test.outcome === 'flaky')
        status = 'flaky';
      if (test.outcome === 'skipped')
        status = 'skipped';
      const searchValues: SearchValues = {
        text: (status + ' ' + test.projectName + ' ' + test.path.join(' ') + test.title).toLowerCase(),
        project: test.projectName.toLowerCase(),
        status: status as any
      };
      (test as any).searchValues = searchValues;
    }

    const searchValues = (test as any).searchValues as SearchValues;
    if (this.project.length) {
      const matches = !!this.project.find(p => searchValues.project.includes(p));
      if (!matches)
        return false;
    }
    if (this.status.length) {
      const matches = !!this.status.find(s => searchValues.status.includes(s));
      if (!matches)
        return false;
    }

    if (this.text.length) {
      const matches = this.text.filter(t => searchValues.text.includes(t)).length === this.text.length;
      if (!matches)
        return false;
    }

    return true;
  }
}

async function readJsonEntry(entryName: string): Promise<any> {
  const reportEntry = window.entries.get(entryName);
  const writer = new zipjs.TextWriter() as zip.TextWriter;
  await reportEntry!.getData!(writer);
  return JSON.parse(await writer.getData());
}

type SearchValues = {
  text: string;
  project: string;
  status: 'passed' | 'failed' | 'flaky' | 'skipped';
};

const kMissingContentType = 'x-playwright/missing';
