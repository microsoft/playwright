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

import type * as channels from '@protocol/channels';
import type { ActionTraceEvent } from '@trace/trace';
import * as React from 'react';
import './consoleTab.css';
import * as modelUtil from './modelUtil';

export const ConsoleTab: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
}> = ({ action }) => {
  const entries = React.useMemo(() => {
    if (!action)
      return [];
    const entries: { message?: channels.ConsoleMessageInitializer, error?: channels.SerializedError }[] = [];
    const context = modelUtil.context(action);
    for (const event of modelUtil.eventsForAction(action)) {
      if (event.metadata.method !== 'console' && event.metadata.method !== 'pageError')
        continue;
      if (event.metadata.method === 'console') {
        const { guid } = event.metadata.params.message;
        entries.push({ message: context.objects[guid] });
      }
      if (event.metadata.method === 'pageError')
        entries.push({ error: event.metadata.params.error });
    }
    return entries;
  }, [action]);

  return <div className='console-tab'>{
    entries.map((entry, index) => {
      const { message, error } = entry;
      if (message) {
        const url = message.location.url;
        const filename = url ? url.substring(url.lastIndexOf('/') + 1) : '<anonymous>';
        return <div className={'console-line ' + message.type} key={index}>
          <span className='console-location'>{filename}:{message.location.lineNumber}</span>
          <span className={'codicon codicon-' + iconClass(message)}></span>
          <span className='console-line-message'>{message.text}</span>
        </div>;
      }
      if (error) {
        const { error: errorObject, value } = error;
        if (errorObject) {
          return <div className='console-line error' key={index}>
            <span className={'codicon codicon-error'}></span>
            <span className='console-line-message'>{errorObject.message}</span>
            <div className='console-stack'>{errorObject.stack}</div>
          </div>;
        } else {
          return <div className='console-line error' key={index}>
            <span className={'codicon codicon-error'}></span>
            <span className='console-line-message'>{String(value)}</span>
          </div>;
        }
      }
      return null;
    })
  }</div>;
};

function iconClass(message: channels.ConsoleMessageInitializer): string {
  switch (message.type) {
    case 'error': return 'error';
    case 'warning': return 'warning';
  }
  return 'blank';
}
