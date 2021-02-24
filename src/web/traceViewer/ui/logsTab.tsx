/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ActionEntry } from '../../../server/trace/viewer/traceModel';
import * as React from 'react';
import './logsTab.css';

export const LogsTab: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
}> = ({ actionEntry }) => {
  let logs: string[] = [];
  if (actionEntry) {
    logs = actionEntry.action.logs || [];
    if (actionEntry.action.error)
      logs = [actionEntry.action.error, ...logs];
  }
  return <div className='logs-tab'>{
    logs.map((logLine, index) => {
      return <div key={index} className='log-line'>
        {logLine}
      </div>;
    })
  }</div>;
};
