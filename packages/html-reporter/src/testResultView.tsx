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

import type { TestAttachment, TestCase, TestResult, TestStep } from './types';
import ansi2html from 'ansi-to-html';
import * as React from 'react';
import { TreeItem } from './treeItem';
import { msToString } from './uiUtils';
import { AutoChip } from './chip';
import { traceImage } from './images';
import { AttachmentLink, generateTraceUrl } from './links';
import { statusIcon } from './statusIcon';
import type { ImageDiff } from './imageDiffView';
import { ImageDiffView } from './imageDiffView';
import './testResultView.css';

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
      imageDiff.actual = { attachment };
    if (category === 'expected')
      imageDiff.expected = { attachment, title: 'Expected' };
    if (category === 'previous')
      imageDiff.expected = { attachment, title: 'Previous' };
    if (category === 'diff')
      imageDiff.diff = { attachment };
  }
  for (const [name, diff] of snapshotNameToImageDiff) {
    if (!diff.actual || !diff.expected) {
      snapshotNameToImageDiff.delete(name);
    } else {
      screenshots.delete(diff.actual.attachment);
      screenshots.delete(diff.expected.attachment);
      screenshots.delete(diff.diff?.attachment!);
    }
  }
  return [...snapshotNameToImageDiff.values()];
}

export const TestResultView: React.FC<{
  test: TestCase,
  result: TestResult,
  anchor: 'video' | 'diff' | '',
}> = ({ result, anchor }) => {

  const { screenshots, videos, traces, otherAttachments, diffs } = React.useMemo(() => {
    const attachments = result?.attachments || [];
    const screenshots = new Set(attachments.filter(a => a.contentType.startsWith('image/')));
    const videos = attachments.filter(a => a.name === 'video');
    const traces = attachments.filter(a => a.name === 'trace');
    const otherAttachments = new Set<TestAttachment>(attachments);
    [...screenshots, ...videos, ...traces].forEach(a => otherAttachments.delete(a));
    const diffs = groupImageDiffs(screenshots);
    return { screenshots: [...screenshots], videos, traces, otherAttachments, diffs };
  }, [result]);

  const videoRef = React.useRef<HTMLDivElement>(null);
  const imageDiffRef = React.useRef<HTMLDivElement>(null);

  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    if (scrolled)
      return;
    setScrolled(true);
    if (anchor === 'video')
      videoRef.current?.scrollIntoView({ block: 'start', inline: 'start' });
    if (anchor === 'diff')
      imageDiffRef.current?.scrollIntoView({ block: 'start', inline: 'start' });
  }, [scrolled, anchor, setScrolled, videoRef]);

  return <div className='test-result'>
    {!!result.errors.length && <AutoChip header='Errors'>
      {result.errors.map((error, index) => <ErrorMessage key={'test-result-error-message-' + index} error={error}></ErrorMessage>)}
    </AutoChip>}
    {!!result.steps.length && <AutoChip header='Test Steps'>
      {result.steps.map((step, i) => <StepTreeItem key={`step-${i}`} step={step} depth={0}></StepTreeItem>)}
    </AutoChip>}

    {diffs.map((diff, index) =>
      <AutoChip key={`diff-${index}`} header={`Image mismatch: ${diff.name}`} targetRef={imageDiffRef}>
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
        <a href={generateTraceUrl(traces)}>
          <img src={traceImage} style={{ width: 192, height: 117, marginLeft: 20 }} />
        </a>
        {traces.map((a, i) => <AttachmentLink key={`trace-${i}`} attachment={a} linkName={traces.length === 1 ? 'trace' : `trace-${i + 1}`}></AttachmentLink>)}
      </div>}
    </AutoChip>}

    {!!videos.length && <AutoChip header='Videos' targetRef={videoRef}>
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
