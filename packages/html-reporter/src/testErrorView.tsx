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
import type { TestResult } from './types';
import { fixTestPrompt } from '@web/components/prompts';
import { useHTMLReport } from './reportContext';
import type { MetadataWithCommitInfo } from '@playwright/isomorphic/types';

export const TestErrorView: React.FC<{
  error: string;
  testId?: string;
  result?: TestResult
}> = ({ error, testId, result }) => {
  return (
    <CodeSnippet code={error} testId={testId}>
      <div style={{ float: 'right', margin: 10 }}>
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

const PromptButton: React.FC<{
  error: string;
  result?: TestResult;
}> = ({ error, result }) => {
  const report = useHTMLReport();
  const commitInfo = report?.metadata as MetadataWithCommitInfo | undefined;
  const prompt = React.useMemo(() => fixTestPrompt(
      error,
      commitInfo?.gitDiff,
      result?.attachments.find(a => a.name === 'pageSnapshot')?.body
  ), [commitInfo, result, error]);

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
    {copied ? 'Copied' : 'Copy as Prompt'}
  </button>;
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
