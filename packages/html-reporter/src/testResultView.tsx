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

import type { TestAttachment, TestCase, TestResult, TestStep } from '@playwright-test/reporters/html';
import ansi2html from 'ansi-to-html';
import * as React from 'react';
import { TreeItem } from './treeItem';
import { TabbedPane } from './tabbedPane';
import { msToString } from './uiUtils';
import { AutoChip } from './chip';
import { traceImage } from './images';
import { AttachmentLink } from './links';
import { statusIcon } from './statusIcon';
import './testResultView.css';

type DiffTab = {
  id: string,
  title: string,
  attachment: TestAttachment,
};

function classifyAttachments(attachments: TestAttachment[]) {
  const screenshots = new Set(attachments.filter(a => a.contentType.startsWith('image/')));
  const videos = attachments.filter(a => a.name === 'video');
  const traces = attachments.filter(a => a.name === 'trace');

  const otherAttachments = new Set<TestAttachment>(attachments);
  [...screenshots, ...videos, ...traces].forEach(a => otherAttachments.delete(a));

  const snapshotNameToDiffTabs = new Map<string, DiffTab[]>();
  let tabId = 0;
  for (const attachment of attachments) {
    const match = attachment.name.match(/^(.*)-(\w+)(\.[^.]+)?$/);
    if (!match)
      continue;
    const [, name, category, extension = ''] = match;
    const snapshotName = name + extension;
    let diffTabs = snapshotNameToDiffTabs.get(snapshotName);
    if (!diffTabs) {
      diffTabs = [];
      snapshotNameToDiffTabs.set(snapshotName, diffTabs);
    }
    diffTabs.push({
      id: 'tab-' + (++tabId),
      title: category,
      attachment,
    });
  }
  const diffs = [...snapshotNameToDiffTabs].map(([snapshotName, diffTabs]) => {
    diffTabs.sort((tab1: DiffTab, tab2: DiffTab) => {
      if (tab1.title === 'diff' || tab2.title === 'diff')
        return tab1.title === 'diff' ? -1 : 1;
      if (tab1.title !== tab2.title)
        return tab1.title < tab2.title ? -1 : 1;
      return 0;
    });
    const isImageDiff = diffTabs.some(tab => screenshots.has(tab.attachment));
    for (const tab of diffTabs)
      screenshots.delete(tab.attachment);
    return {
      tabs: diffTabs,
      isImageDiff,
      snapshotName,
    };
  }).filter(diff => diff.tabs.some(tab => ['diff', 'actual', 'expected'].includes(tab.title.toLowerCase())));
  return { diffs, screenshots: [...screenshots], videos, otherAttachments, traces };
}

export const TestResultView: React.FC<{
  test: TestCase,
  result: TestResult,
}> = ({ result }) => {

  const { screenshots, videos, traces, otherAttachments, diffs } = React.useMemo(() => {
    return classifyAttachments(result?.attachments || []);
  }, [ result ]);

  return <div className='test-result'>
    {!!result.errors.length && <AutoChip header='Errors'>
      {result.errors.map((error, index) => <ErrorMessage key={'test-result-error-message-' + index} error={error}></ErrorMessage>)}
    </AutoChip>}
    {!!result.steps.length && <AutoChip header='Test Steps'>
      {result.steps.map((step, i) => <StepTreeItem key={`step-${i}`} step={step} depth={0}></StepTreeItem>)}
    </AutoChip>}

    {diffs.map(({ tabs, snapshotName, isImageDiff }, index) =>
      <AutoChip key={`diff-${index}`} header={`${isImageDiff ? 'Image' : 'Snapshot'} mismatch: ${snapshotName}`}>
        {isImageDiff && <ImageDiff key='image-diff' tabs={tabs}></ImageDiff>}
        {tabs.map((tab: DiffTab) => <AttachmentLink key={tab.id} attachment={tab.attachment}></AttachmentLink>)}
      </AutoChip>
    )}

    {!!screenshots.length && <AutoChip header='Screenshots'>
      {screenshots.map((a, i) => {
        return <div key={`screenshot-${i}`}>
          <img src={a.path} />
          <AttachmentLink attachment={a}></AttachmentLink>
        </div>;
      })}
    </AutoChip>}

    {!!traces.length && <AutoChip header='Traces'>
      {<div>
        <a href={`trace/index.html?${traces.map((a, i) => `trace=${new URL(a.path!, window.location.href)}`).join('&')}`}>
          <img src={traceImage} style={{ width: 192, height: 117, marginLeft: 20 }} />
        </a>
        {traces.map((a, i) => <AttachmentLink key={`trace-${i}`} attachment={a} linkName={traces.length === 1 ? 'trace' : `trace-${i + 1}`}></AttachmentLink>)}
      </div>}
    </AutoChip>}

    {!!videos.length && <AutoChip header='Videos'>
      {videos.map((a, i) => <div key={`video-${i}`}>
        <video controls>
          <source src={a.path} type={a.contentType}/>
        </video>
        <AttachmentLink attachment={a}></AttachmentLink>
      </div>)}
    </AutoChip>}

    {!!otherAttachments.size && <AutoChip header='Attachments'>
      {[...otherAttachments].map((a, i) => <AttachmentLink key={`attachment-link-${i}`} attachment={a}></AttachmentLink>)}
    </AutoChip>}
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
    {step.count > 1 && <> ✕ <span className='test-result-counter'>{step.count}</span></>}
    {step.location && <span className='test-result-path'>— {step.location.file}:{step.location.line}</span>}
  </span>} loadChildren={step.steps.length + (step.snippet ? 1 : 0) ? () => {
    const children = step.steps.map((s, i) => <StepTreeItem key={i} step={s} depth={depth + 1}></StepTreeItem>);
    if (step.snippet)
      children.unshift(<ErrorMessage key='line' error={step.snippet}></ErrorMessage>);
    return children;
  } : undefined} depth={depth}></TreeItem>;
};

const ImageDiff: React.FunctionComponent<{
 tabs: DiffTab[],
}> = ({ tabs }) => {
  // Pre-select a tab called "actual", if any.
  const preselectedTab = tabs.find(tab => tab.title.toLowerCase() === 'actual') || tabs[0];
  const [selectedTab, setSelectedTab] = React.useState<string>(preselectedTab.id);
  const diffElement = React.useRef<HTMLImageElement>(null);
  const paneTabs = tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    render: () => <img src={tab.attachment.path} onLoad={() => {
      if (diffElement.current)
        diffElement.current.style.minHeight = diffElement.current.offsetHeight + 'px';
    }}/>
  }));
  return <div className='vbox' data-testid='test-result-image-mismatch' ref={diffElement}>
    <TabbedPane tabs={paneTabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
  </div>;
};

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
  return <div className='test-result-error-message' dangerouslySetInnerHTML={{ __html: html || '' }}></div>;
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
