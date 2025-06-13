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

import type { ActionTraceEventInContext } from './modelUtil';
import * as React from 'react';
import { ListView } from '@web/components/listView';
import { PlaceholderPanel } from './placeholderPanel';
import { msToString } from '@web/uiUtils';
import './logTab.css';

const LogList = ListView<{ message: string, time: string }>;

export const LogTab: React.FunctionComponent<{
  action: ActionTraceEventInContext | undefined,
  isLive: boolean | undefined,
}> = ({ action, isLive }) => {
  const entries = React.useMemo(() => {
    if (!action || !action.log.length)
      return [];
    const log = action.log;
    const wallTimeOffset = action.context.wallTime - action.context.startTime;
    const entries: { message: string, time: string }[] = [];
    for (let i = 0; i < log.length; ++i) {
      let time = '';
      if (log[i].time !== -1) {
        const timeStart = log[i]?.time;
        if (i + 1 < log.length)
          time = msToString(log[i + 1].time - timeStart);
        else if (action.endTime > 0)
          time = msToString(action.endTime - timeStart);
        else if (isLive)
          time = msToString(Date.now() - wallTimeOffset - timeStart);
        else
          time = '-';
      }
      entries.push({
        message: log[i].message,
        time,
      });
    }
    return entries;
  }, [action, isLive]);
  if (!entries.length)
    return <PlaceholderPanel text='No log entries' />;

  return <LogList
    name='log'
    ariaLabel='Log entries'
    items={entries}
    render={entry => <div className='log-list-item'>
      <span className='log-list-duration'>{entry.time}</span>
      {entry.message}
    </div>}
    notSelectable={true}
  />;
};
