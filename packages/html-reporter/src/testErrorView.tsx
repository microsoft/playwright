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

import ansi2html from 'ansi-to-html';
import * as React from 'react';
import './testErrorView.css';
import type { ImageDiff } from '@web/shared/imageDiffView';
import { ImageDiffView } from '@web/shared/imageDiffView';
import { ErrorDetails } from './types';

export const TestErrorView: React.FC<{
  error: ErrorDetails;
  testId?: string;
}> = ({ error, testId }) => {
  const html = React.useMemo(() => {
    const formattedError = [];
    if (error.shortMessage)
      formattedError.push('Error: ' + error.shortMessage);
    if (error.locator)
      formattedError.push(`Locator: ${error.locator}`);
    if (error.expected)
      formattedError.push(`Expected: ${error.expected}`);
    if (error.actual)
      formattedError.push(`Received: ${error.actual}`);
    // if (error.diff)
    if (error.log) {
      formattedError.push('Call log:');
      formattedError.push(...(error.log?.map(line => '  - ' + line) || []));
    }
    if (error.snippet)
      formattedError.push('', error.snippet);
    return ansiErrorToHtml(formattedError.join('\n'));
  }, [error]);

  return <div className='test-error-view test-error-text' data-testId={testId} dangerouslySetInnerHTML={{ __html: html || '' }}></div>;
};

export const TestScreenshotErrorView: React.FC<{
  error: ErrorDetails,
  diff: ImageDiff,
}> = ({ error, diff }) => {
  const prefixHtml = React.useMemo(() => ansiErrorToHtml(error.shortMessage), [error]);
  const suffixHtml = React.useMemo(() => {
    const errorSuffix = ['Call log:',
      ...(error.log?.map(line => '  - ' + line) || []),
      '',
      error.snippet,
      '',
      error.callStack,
    ].join('\n');
    return ansiErrorToHtml(errorSuffix)
  }, [error]);
  return <div data-testid='test-screenshot-error-view' className='test-error-view'>
    <div dangerouslySetInnerHTML={{ __html: prefixHtml || '' }} className='test-error-text' style={{ marginBottom: 20 }}></div>
    <ImageDiffView key='image-diff' diff={diff} hideDetails={true}></ImageDiffView>
    <div data-testid='error-suffix' dangerouslySetInnerHTML={{ __html: suffixHtml || '' }} className='test-error-text'></div>
  </div>;
};

function ansiErrorToHtml(text?: string): string {
  const config: any = {
    bg: 'var(--color-canvas-subtle)',
    fg: 'var(--color-fg-default)',
  };
  config.colors = ansiColors;
  return new ansi2html(config).toHtml(escapeHTML(text || ''));
}

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

export function formatCallLog(log: string[] | undefined): string {
  if (!log || !log.some(l => !!l))
    return '';
  return `
Call log:
  ${'- ' + (log || []).join('\n  - ')}
`;
}

