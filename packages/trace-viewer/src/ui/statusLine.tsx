/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '@web/third_party/vscode/codicon.css';
import '@web/common.css';
import './statusLine.css';
import React from 'react';
import { clsx } from '@web/uiUtils';
import { testStatusIcon } from './testUtils';

interface StatusLineProps {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  isRunning: boolean;
}

export const StatusLine: React.FC<StatusLineProps> = ({ passed, failed, skipped, total, isRunning }) => {
  const count = passed + failed + skipped;
  return (
    <div data-testid='status-line' className='status-line' title={`${passed} passed, ${failed} failed, ${skipped} skipped`}>
      <span className='status-line-count'>
        <i className={clsx('codicon', isRunning ? testStatusIcon('running') : testStatusIcon('none'))} />
        <span data-testid='test-count'>{count}/{total}</span>
      </span>
      <span className='status-passed'>
        <i className={clsx('codicon', testStatusIcon('passed'))} />{passed || 0}
      </span>
      <span className='status-failed'>
        <i className={clsx('codicon', testStatusIcon('failed'))} />{failed || 0}
      </span>
      <span className='status-skipped'>
        <i className={clsx('codicon', testStatusIcon('skipped'))} />{skipped || 0}
      </span>
    </div>
  );
};
