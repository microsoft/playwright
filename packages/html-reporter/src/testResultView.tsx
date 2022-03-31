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

type ImageDiff = {
  name: string,
  left?: { attachment: TestAttachment, title: string },
  right?: { attachment: TestAttachment, title: string },
  diff?: { attachment: TestAttachment, title: string },
};

function groupImageDiffs(screenshots: Set<TestAttachment>): ImageDiff[] {
  const snapshotNameToImageDiff = new Map<string, ImageDiff>();
  for (const attachment of screenshots) {
    const match = attachment.name.match(/^(.*)-(expected|actual|diff|previous)(\.[^.]+)?$/);
    if (!match)
      continue;
    const [, name, category, extension = ''] = match;
    const snapshotName = name + extension;
    let imageDiff = snapshotNameToImageDiff.get(snapshotName);
    if (!imageDiff) {
      imageDiff = { name: snapshotName };
      snapshotNameToImageDiff.set(snapshotName, imageDiff);
    }
    if (category === 'actual')
      imageDiff.left = { attachment, title: 'Actual' };
    if (category === 'expected')
      imageDiff.right = { attachment, title: 'Expected' };
    if (category === 'previous')
      imageDiff.right = { attachment, title: 'Previous' };
    if (category === 'diff')
      imageDiff.diff = { attachment, title: 'Diff' };
  }
  for (const [name, diff] of snapshotNameToImageDiff) {
    if (!diff.left || !diff.right) {
      snapshotNameToImageDiff.delete(name);
    } else {
      screenshots.delete(diff.left.attachment);
      screenshots.delete(diff.right.attachment);
      screenshots.delete(diff.diff?.attachment!);
    }
  }
  return [...snapshotNameToImageDiff.values()];
}

export const TestResultView: React.FC<{
  test: TestCase,
  result: TestResult,
}> = ({ result }) => {

  const { screenshots, videos, traces, otherAttachments, diffs } = React.useMemo(() => {
    const attachments = result?.attachments || [];
    const screenshots = new Set(attachments.filter(a => a.contentType.startsWith('image/')));
    const videos = attachments.filter(a => a.name === 'video');
    const traces = attachments.filter(a => a.name === 'trace');
    const otherAttachments = new Set<TestAttachment>(attachments);
    [...screenshots, ...videos, ...traces].forEach(a => otherAttachments.delete(a));
    const diffs = groupImageDiffs(screenshots);
    return { screenshots: [...screenshots], videos, traces, otherAttachments, diffs };
  }, [ result ]);

  return <div className='test-result'>
    {!!result.errors.length && <AutoChip header='Errors'>
      {result.errors.map((error, index) => <ErrorMessage key={'test-result-error-message-' + index} error={error}></ErrorMessage>)}
    </AutoChip>}
    {!!result.steps.length && <AutoChip header='Test Steps'>
      {result.steps.map((step, i) => <StepTreeItem key={`step-${i}`} step={step} depth={0}></StepTreeItem>)}
    </AutoChip>}

    {diffs.map((diff, index) =>
      <AutoChip key={`diff-${index}`} header={`Image mismatch: ${diff.name}`}>
        <ImageDiffView key='image-diff' imageDiff={diff}></ImageDiffView>
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

const ImageDiffView: React.FunctionComponent<{
 imageDiff: ImageDiff,
}> = ({ imageDiff: diff }) => {
  // Pre-select a tab called "actual", if any.
  const [selectedTab, setSelectedTab] = React.useState<string>('left');
  const diffElement = React.useRef<HTMLImageElement>(null);
  const setMinHeight = () => {
    if (diffElement.current)
      diffElement.current.style.minHeight = diffElement.current.offsetHeight + 'px';
  };
  const tabs = [
    {
      id: 'left',
      title: diff.left!.title,
      render: () => <img src={diff.left!.attachment.path!} onLoad={setMinHeight}/>
    },
    {
      id: 'right',
      title: diff.right!.title,
      render: () => <img src={diff.right!.attachment.path!} onLoad={setMinHeight}/>
    },
  ];
  if (diff.diff) {
    tabs.push({
      id: 'diff',
      title: diff.diff.title,
      render: () => <img src={diff.diff!.attachment.path} onLoad={setMinHeight}/>
    });
  }
  return <div className='vbox' data-testid='test-result-image-mismatch' ref={diffElement}>
    <TabbedPane tabs={tabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
    <AttachmentLink attachment={diff.left!.attachment}></AttachmentLink>
    <AttachmentLink attachment={diff.right!.attachment}></AttachmentLink>
    {diff.diff && <AttachmentLink attachment={diff.diff.attachment}></AttachmentLink>}
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
