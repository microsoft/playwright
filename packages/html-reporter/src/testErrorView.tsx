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

import { ansi2html } from '@web/ansi2html';
import * as React from 'react';
import './testErrorView.css';
import type { ImageDiff } from '@web/shared/imageDiffView';
import { ImageDiffView } from '@web/shared/imageDiffView';

export const CodeSnippet = ({ code, children, testId }: React.PropsWithChildren<{ code: string; testId?: string; }>) => {
  const html = React.useMemo(() => ansiErrorToHtml(code), [code]);
  return (
    <div className='test-error-container test-error-text' data-testid={testId}>
      {children}
      <div className='test-error-view' dangerouslySetInnerHTML={{ __html: html || '' }}></div>
    </div>
  );
};

export const PromptButton: React.FC<{ prompt: string }> = ({ prompt }) => {
  const [copied, setCopied] = React.useState(false);
  return <button
    className='button'
    style={{ minWidth: 100 }}
    onClick={async () => {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 3000);
    }}>
    {copied ? 'Copied' : 'Copy prompt'}
  </button>;
};

export const TestScreenshotErrorView: React.FC<{
  diff: ImageDiff,
}> = ({ diff }) => {
  return <div data-testid='test-screenshot-error-view' className='test-error-view'>
    <ImageDiffView key='image-diff' diff={diff} hideDetails={true}></ImageDiffView>
  </div>;
};

function ansiErrorToHtml(text?: string): string {
  const defaultColors = {
    bg: 'var(--color-canvas-subtle)',
    fg: 'var(--color-fg-default)',
  };
  return ansi2html(text || '', defaultColors);
}
