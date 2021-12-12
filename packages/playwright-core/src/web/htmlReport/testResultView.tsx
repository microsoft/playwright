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

import type { TestAttachment, TestCase, TestResult, TestStep } from '@playwright/test/src/reporters/html';
import ansi2html from 'ansi-to-html';
import * as React from 'react';
import { TreeItem } from './treeItem';
import { TabbedPane } from './tabbedPane';
import { msToString } from '../uiUtils';
import { Chip } from './chip';
import { traceImage } from './images';
import { AttachmentLink } from './links';
import { statusIcon } from './statusIcon';
import './testResultView.css';

export const TestResultView: React.FC<{
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
      <ErrorMessage key='test-result-error-message' error={result.error}></ErrorMessage>
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
        </a>
        <AttachmentLink attachment={a}></AttachmentLink>
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
    {step.location && <span className='test-result-path'>— {step.location.file}:{step.location.line}</span>}
  </span>} loadChildren={step.steps.length + (step.snippet ? 1 : 0) ? () => {
    const children = step.steps.map((s, i) => <StepTreeItem key={i} step={s} depth={depth + 1}></StepTreeItem>);
    if (step.snippet)
      children.unshift(<ErrorMessage key='line' error={step.snippet}></ErrorMessage>);
    return children;
  } : undefined} depth={depth}></TreeItem>;
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
  return <div className='vbox' data-testid='test-result-image-mismatch'>
    <TabbedPane tabs={tabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
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
