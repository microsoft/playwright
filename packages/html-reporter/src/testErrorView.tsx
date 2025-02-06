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
import { GitCommitInfoContext } from './reportView';

export const TestErrorView: React.FC<{
  error: string;
  testId?: string;
  hidePrompt?: boolean;
}> = ({ error, testId, hidePrompt }) => {
  const html = React.useMemo(() => ansiErrorToHtml(error), [error]);
  return (
    <div className='test-error-view test-error-text' data-testid={testId}>
      {!hidePrompt && <PromptButton error={error} />}
      <div dangerouslySetInnerHTML={{ __html: html || '' }}></div>
    </div>
  );
};

const ansiRegex = new RegExp('([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))', 'g');
export function stripAnsiEscapes(str: string): string {
  return str.replace(ansiRegex, '');
}

const PromptButton: React.FC<{
  error: string;
}> = ({ error }) => {
  const [copied, setCopied] = React.useState(false);
  const gitCommitInfo = React.useContext(GitCommitInfoContext);
  if (!gitCommitInfo)
    return undefined;

  const diff = gitCommitInfo['pull.diff'] ?? gitCommitInfo['revision.diff'];
  if (!diff)
    return undefined;

  return (
    <button
      style={{ width: 200, padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: copied ? '#4caf50' : '#f0f0f0', color: copied ? '#fff' : '#000', cursor: 'pointer' }}
      onClick={async () => {
        await navigator.clipboard.writeText([
          'You are a helpful assistant. Help me understand the error cause. Here is the error:',
          stripAnsiEscapes(error),
          'And this is the code diff:',
          diff
        ].join('\n\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}>
      {copied ? 'Copied!' : 'Copy prompt to fix with AI'}
    </button>
  );
};

export const TestScreenshotErrorView: React.FC<{
  errorPrefix?: string,
  diff: ImageDiff,
  errorSuffix?: string,
}> = ({ errorPrefix, diff, errorSuffix }) => {
  const prefixHtml = React.useMemo(() => ansiErrorToHtml(errorPrefix), [errorPrefix]);
  const suffixHtml = React.useMemo(() => ansiErrorToHtml(errorSuffix), [errorSuffix]);
  return <div data-testid='test-screenshot-error-view' className='test-error-view'>
    <div dangerouslySetInnerHTML={{ __html: prefixHtml || '' }} className='test-error-text' style={{ marginBottom: 20 }}></div>
    <ImageDiffView key='image-diff' diff={diff} hideDetails={true}></ImageDiffView>
    <div data-testid='error-suffix' dangerouslySetInnerHTML={{ __html: suffixHtml || '' }} className='test-error-text'></div>
  </div>;
};

function ansiErrorToHtml(text?: string): string {
  const defaultColors = {
    bg: 'var(--color-canvas-subtle)',
    fg: 'var(--color-fg-default)',
  };
  return ansi2html(text || '', defaultColors);
}
