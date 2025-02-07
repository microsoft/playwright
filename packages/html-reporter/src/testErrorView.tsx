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
import * as icons from './icons';
import type { ImageDiff } from '@web/shared/imageDiffView';
import { ImageDiffView } from '@web/shared/imageDiffView';
import { GitCommitInfoContext } from './reportView';
import { TestResult } from './types';
import { CopyToClipboard } from './copyToClipboard';

export const TestErrorView: React.FC<{ error: string; testId?: string; result?: TestResult }> = ({ error, testId, result }) => {
  return (
    <CodeSnippet code={error} testId={testId}>
      <div style={{ float: 'right', padding: '5px' }}>
        <PromptButton error={error} result={result} />
      </div>
    </CodeSnippet>
  );
};

export const CodeSnippet = ({ code, children, testId }: React.PropsWithChildren<{ code: string; testId?: string; }>) => {
  const html = React.useMemo(() => ansiErrorToHtml(code), [code]);
  return (
    <div className='test-error-container test-error-text' data-testid={testId}>
      {children}
      <div className='test-error-view' dangerouslySetInnerHTML={{ __html: html || '' }}></div>
    </div>
  );
};

const ansiRegex = new RegExp('([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))', 'g');
function stripAnsiEscapes(str: string): string {
  return str.replace(ansiRegex, '');
}

const PromptButton: React.FC<{
  error: string;
  result?: TestResult;
}> = ({ error, result }) => {
  const gitCommitInfo = React.useContext(GitCommitInfoContext);
  const prompt = React.useMemo(() => {
    const promptParts = [
      'This test failed, suggest how to fix it. Please be correct, concise and keep Playwright best practices in mind.',
      'Here is the error:',
      '\n',
      stripAnsiEscapes(error),
      '\n',
    ];

    const pageSnapshot = result?.attachments.find(a => a.name === 'pageSnapshot')?.body;
    if (pageSnapshot)
      promptParts.push(
        'This is how the page looked at the end of the test:',
        pageSnapshot,
        '\n'
      );

    const diff = gitCommitInfo?.['pull.diff'] ?? gitCommitInfo?.['revision.diff'];
    if (diff)
      promptParts.push(
        'And this is the code diff:',
        diff,
        '\n'
      );

    return promptParts.join('\n');
  }, [gitCommitInfo, result])

  return <CopyToClipboard value={prompt} icon={<icons.copilot />} title="Copy prompt to clipboard" />;
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
