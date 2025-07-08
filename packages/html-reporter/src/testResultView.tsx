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
import * as React from 'react';
import { TreeItem } from './treeItem';
import { msToString } from './utils';
import { AutoChip } from './chip';
import { traceImage } from './images';
import { Anchor, AttachmentLink, generateTraceUrl, testResultHref } from './links';
import { statusIcon } from './statusIcon';
import type { ImageDiff } from '@web/shared/imageDiffView';
import { ImageDiffView } from '@web/shared/imageDiffView';
import { CodeSnippet, PromptButton, TestScreenshotErrorView } from './testErrorView';
import * as icons from './icons';
import './testResultView.css';
import { useAsyncMemo } from '@web/uiUtils';
import { copyPrompt } from '@web/shared/prompts';
import type { MetadataWithCommitInfo } from '@playwright/isomorphic/types';

interface ImageDiffWithAnchors extends ImageDiff {
  anchors: string[];
}

function groupImageDiffs(screenshots: Set<TestAttachment>, result: TestResult): ImageDiffWithAnchors[] {
  const snapshotNameToImageDiff = new Map<string, ImageDiffWithAnchors>();
  for (const attachment of screenshots) {
    const match = attachment.name.match(/^(.*)-(expected|actual|diff|previous)(\.[^.]+)?$/);
    if (!match)
      continue;
    const [, name, category, extension = ''] = match;
    const snapshotName = name + extension;
    let imageDiff = snapshotNameToImageDiff.get(snapshotName);
    if (!imageDiff) {
      imageDiff = { name: snapshotName, anchors: [`attachment-${name}`] };
      snapshotNameToImageDiff.set(snapshotName, imageDiff);
    }
    imageDiff.anchors.push(`attachment-${result.attachments.indexOf(attachment)}`);
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
  testRunMetadata: MetadataWithCommitInfo | undefined,
}> = ({ test, result, testRunMetadata }) => {
  const { screenshots, videos, traces, otherAttachments, diffs, errors, otherAttachmentAnchors, screenshotAnchors, errorContext } = React.useMemo(() => {
    const attachments = result.attachments.filter(a => !a.name.startsWith('_'));
    const screenshots = new Set(attachments.filter(a => a.contentType.startsWith('image/')));
    const screenshotAnchors = [...screenshots].map(a => `attachment-${attachments.indexOf(a)}`);
    const videos = attachments.filter(a => a.contentType.startsWith('video/'));
    const traces = attachments.filter(a => a.name === 'trace');
    const errorContext = attachments.find(a => a.name === 'error-context');
    const otherAttachments = new Set<TestAttachment>(attachments);
    [...screenshots, ...videos, ...traces].forEach(a => otherAttachments.delete(a));
    const otherAttachmentAnchors = [...otherAttachments].map(a => `attachment-${attachments.indexOf(a)}`);
    const diffs = groupImageDiffs(screenshots, result);
    const errors = result.errors.map(e => e.message);
    return { screenshots: [...screenshots], videos, traces, otherAttachments, diffs, errors, otherAttachmentAnchors, screenshotAnchors, errorContext };
  }, [result]);

  const prompt = useAsyncMemo(async () => {
    return await copyPrompt({
      testInfo: [
        `- Name: ${test.path.join(' >> ')} >> ${test.title}`,
        `- Location: ${test.location.file}:${test.location.line}:${test.location.column}`
      ].join('\n'),
      metadata: testRunMetadata,
      errorContext: errorContext?.path ? await fetch(errorContext.path!).then(r => r.text()) : errorContext?.body,
      errors: result.errors,
      buildCodeFrame: async error => error.codeframe,
    });
  }, [test, errorContext, testRunMetadata, result], undefined);

  return <div className='test-result'>
    {!!errors.length && <AutoChip header='Errors'>
      {prompt && (
        <div style={{ position: 'absolute', right: '16px', padding: '10px', zIndex: 1 }}>
          <PromptButton prompt={prompt} />
        </div>
      )}
      {errors.map((error, index) => {
        const diff = pickDiffForError(error, diffs);
        return <>
          <CodeSnippet key={'test-result-error-message-' + index} code={error}/>
          {diff && <TestScreenshotErrorView diff={diff}></TestScreenshotErrorView>}
        </>;
      })}
    </AutoChip>}
    {!!result.steps.length && <AutoChip header='Test Steps'>
      {result.steps.map((step, i) => <StepTreeItem key={`step-${i}`} step={step} result={result} test={test} depth={0}/>)}
    </AutoChip>}

    {diffs.map((diff, index) =>
      <Anchor key={`diff-${index}`} id={diff.anchors}>
        <AutoChip dataTestId='test-results-image-diff' header={`Image mismatch: ${diff.name}`} revealOnAnchorId={diff.anchors}>
          <ImageDiffView diff={diff}/>
        </AutoChip>
      </Anchor>
    )}

    {!!screenshots.length && <AutoChip header='Screenshots' revealOnAnchorId={screenshotAnchors}>
      {screenshots.map((a, i) => {
        return <Anchor key={`screenshot-${i}`} id={`attachment-${result.attachments.indexOf(a)}`}>
          <a href={a.path}>
            <img className='screenshot' src={a.path} />
          </a>
          <AttachmentLink attachment={a} result={result}></AttachmentLink>
        </Anchor>;
      })}
    </AutoChip>}

    {!!traces.length && <Anchor id='attachment-trace'><AutoChip header='Traces' revealOnAnchorId='attachment-trace'>
      {<div>
        <a href={generateTraceUrl(traces)}>
          <img className='screenshot' src={traceImage} style={{ width: 192, height: 117, marginLeft: 20 }} />
        </a>
        {traces.map((a, i) => <AttachmentLink key={`trace-${i}`} attachment={a} result={result} linkName={traces.length === 1 ? 'trace' : `trace-${i + 1}`}></AttachmentLink>)}
      </div>}
    </AutoChip></Anchor>}

    {!!videos.length && <Anchor id='attachment-video'><AutoChip header='Videos' revealOnAnchorId='attachment-video'>
      {videos.map(a => <div key={a.path}>
        <video controls>
          <source src={a.path} type={a.contentType}/>
        </video>
        <AttachmentLink attachment={a} result={result}></AttachmentLink>
      </div>)}
    </AutoChip></Anchor>}

    {!!otherAttachments.size && <AutoChip header='Attachments' revealOnAnchorId={otherAttachmentAnchors} dataTestId='attachments'>
      {[...otherAttachments].map((a, i) =>
        <Anchor key={`attachment-link-${i}`} id={`attachment-${result.attachments.indexOf(a)}`}>
          <AttachmentLink attachment={a} result={result} openInNewTab={a.contentType.startsWith('text/html')} />
        </Anchor>
      )}
    </AutoChip>}
  </div>;
};

function pickDiffForError(error: string, diffs: ImageDiff[]): ImageDiff | undefined {
  const firstLine = error.split('\n')[0];
  if (!firstLine.includes('toHaveScreenshot') && !firstLine.includes('toMatchSnapshot'))
    return undefined;
  return diffs.find(diff => error.includes(diff.name));
}

const StepTreeItem: React.FC<{
  test: TestCase;
  result: TestResult;
  step: TestStep;
  depth: number,
}> = ({ test, step, result, depth }) => {
  return <TreeItem title={<span aria-label={step.title}>
    <span style={{ float: 'right' }}>{msToString(step.duration)}</span>
    {step.attachments.length > 0 && <a style={{ float: 'right' }} title={`reveal attachment`} href={testResultHref({ test, result, anchor: `attachment-${step.attachments[0]}` })} onClick={evt => { evt.stopPropagation(); }}>{icons.attachment()}</a>}
    {statusIcon(step.error || step.duration === -1 ? 'failed' : (step.skipped ? 'skipped' : 'passed'))}
    <span>{step.title}</span>
    {step.count > 1 && <> ✕ <span className='test-result-counter'>{step.count}</span></>}
    {step.location && <span className='test-result-path'>— {step.location.file}:{step.location.line}</span>}
  </span>} loadChildren={step.steps.length || step.snippet ? () => {
    const snippet = step.snippet ? [<CodeSnippet testId='test-snippet' key='line' code={step.snippet} />] : [];
    const steps = step.steps.map((s, i) => <StepTreeItem key={i} step={s} depth={depth + 1} result={result} test={test} />);
    return snippet.concat(steps);
  } : undefined} depth={depth}/>;
};
