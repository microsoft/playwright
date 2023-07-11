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
import { ListView } from '@web/components/listView';
import { ansi2htmlMarkup } from '@web/components/errorMessage';

type ConsoleEntry = {
  message?: channels.ConsoleMessageInitializer;
  error?: channels.SerializedError;
  nodeMessage?: {
    text?: string;
    base64?: string;
    isError: boolean;
  },
  timestamp: number;
  highlight: boolean;
};

const ConsoleListView = ListView<ConsoleEntry>;

export const ConsoleTab: React.FunctionComponent<{
  model: modelUtil.MultiTraceModel | undefined,
  action: ActionTraceEvent | undefined,
}> = ({ model, action }) => {
  const { entries } = React.useMemo(() => {
    if (!model)
      return { entries: [] };
    const entries: ConsoleEntry[] = [];
    const actionEvents = action ? modelUtil.eventsForAction(action) : [];
    for (const event of model.events) {
      if (event.method !== 'console' && event.method !== 'pageError')
        continue;
      if (event.method === 'console') {
        const { guid } = event.params.message;
        entries.push({
          message: modelUtil.context(event).initializers[guid],
          highlight: actionEvents.includes(event),
          timestamp: event.time,
        });
      }
      if (event.method === 'pageError') {
        entries.push({
          error: event.params.error,
          highlight: actionEvents.includes(event),
          timestamp: event.time,
        });
      }
    }
    for (const event of model.stdio) {
      entries.push({
        nodeMessage: {
          text: event.text,
          base64: event.base64,
          isError: event.type === 'stderr',
        },
        timestamp: event.timestamp,
        highlight: false,
      });
    }
    entries.sort((a, b) => a.timestamp - b.timestamp);
    return { entries };
  }, [model, action]);

  return <div className='console-tab'>
    <ConsoleListView
      items={entries}
      isError={entry => !!entry.error || entry.message?.type === 'error' || entry.nodeMessage?.isError || false}
      isWarning={entry => entry.message?.type === 'warning'}
      render={entry => {
        const { message, error, nodeMessage } = entry;
        if (message) {
          const url = message.location.url;
          const filename = url ? url.substring(url.lastIndexOf('/') + 1) : '<anonymous>';
          return <div className='console-line'>
            <span className='console-location'>{filename}:{message.location.lineNumber}</span>
            <span className={'codicon codicon-' + iconClass(message)}></span>
            <span className='console-line-message'>{message.text}</span>
          </div>;
        }
        if (error) {
          const { error: errorObject, value } = error;
          if (errorObject) {
            return <div className='console-line'>
              <span className={'codicon codicon-error'}></span>
              <span className='console-line-message'>{errorObject.message}</span>
              <div className='console-stack'>{errorObject.stack}</div>
            </div>;
          }
          return <div className='console-line'>
            <span className={'codicon codicon-error'}></span>
            <span className='console-line-message'>{String(value)}</span>
          </div>;
        }
        if (nodeMessage?.text) {
          return <div className='console-line'>
            <span className={'codicon codicon-' + stdioClass(nodeMessage.isError)}></span>
            <span className='console-line-message' dangerouslySetInnerHTML={{ __html: ansi2htmlMarkup(nodeMessage.text.trim()) || '' }}></span>
          </div>;
        }
        if (nodeMessage?.base64) {
          return <div className='console-line'>
            <span className={'codicon codicon-' + stdioClass(nodeMessage.isError)}></span>
            <span className='console-line-message' dangerouslySetInnerHTML={{ __html: ansi2htmlMarkup(atob(nodeMessage.base64).trim()) || '' }}></span>
          </div>;
        }
        return null;
      }
      }
      isHighlighted={entry => !!entry.highlight}
    />
  </div>;
};

function iconClass(message: channels.ConsoleMessageInitializer): string {
  switch (message.type) {
    case 'error': return 'error';
    case 'warning': return 'warning';
  }
  return 'blank';
}

function stdioClass(isError: boolean): string {
  return isError ? 'error' : 'blank';
}
