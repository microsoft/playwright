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
import * as React from 'react';
import './consoleTab.css';
import * as modelUtil from './modelUtil';
import { ListView } from '@web/components/listView';
import { ansi2htmlMarkup } from '@web/components/errorMessage';
import type { Boundaries } from '../geometry';
import { msToString } from '@web/uiUtils';
import type * as trace from '@trace/trace';

type ConsoleEntry = {
  message?: trace.ConsoleMessageTraceEvent['initializer'];
  error?: channels.SerializedError;
  nodeMessage?: {
    text?: string;
    base64?: string;
    isError: boolean;
  },
  timestamp: number;
};

const ConsoleListView = ListView<ConsoleEntry>;

export const ConsoleTab: React.FunctionComponent<{
  model: modelUtil.MultiTraceModel | undefined,
  boundaries: Boundaries,
  selectedTime: Boundaries | undefined,
}> = ({ model, boundaries, selectedTime }) => {
  const { entries } = React.useMemo(() => {
    if (!model)
      return { entries: [] };
    const entries: ConsoleEntry[] = [];
    for (const event of model.events) {
      if (event.method !== 'console' && event.method !== 'pageError')
        continue;
      if (event.method === 'console') {
        const { guid } = event.params.message;
        entries.push({
          message: modelUtil.context(event).initializers[guid],
          timestamp: event.time,
        });
      }
      if (event.method === 'pageError') {
        entries.push({
          error: event.params.error,
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
      });
    }
    entries.sort((a, b) => a.timestamp - b.timestamp);
    return { entries };
  }, [model]);

  const filteredEntries = React.useMemo(() => {
    if (!selectedTime)
      return entries;
    return entries.filter(entry => entry.timestamp >= selectedTime.minimum && entry.timestamp <= selectedTime.maximum);
  }, [entries, selectedTime]);

  return <div className='console-tab'>
    <ConsoleListView
      items={filteredEntries}
      isError={entry => !!entry.error || entry.message?.type === 'error' || entry.nodeMessage?.isError || false}
      isWarning={entry => entry.message?.type === 'warning'}
      render={entry => {
        const { message, error, nodeMessage } = entry;
        const timestamp = msToString(entry.timestamp - boundaries.minimum);
        if (message) {
          const text = message.args ? format(message.args) : message.text;
          const url = message.location.url;
          const filename = url ? url.substring(url.lastIndexOf('/') + 1) : '<anonymous>';
          return <div className='console-line'>
            <span className='console-time'>{timestamp}</span>
            <span className='console-location'>{filename}:{message.location.lineNumber}</span>
            <span className={'codicon codicon-' + iconClass(message)}></span>
            <span className='console-line-message'>{text}</span>
          </div>;
        }
        if (error) {
          const { error: errorObject, value } = error;
          if (errorObject) {
            return <div className='console-line'>
              <span className='console-time'>{timestamp}</span>
              <span className={'codicon codicon-error'}></span>
              <span className='console-line-message'>{errorObject.message}</span>
              <div className='console-stack'>{errorObject.stack}</div>
            </div>;
          }
          return <div className='console-line'>
            <span className='console-time'>{timestamp}</span>
            <span className={'codicon codicon-error'}></span>
            <span className='console-line-message'>{String(value)}</span>
          </div>;
        }
        if (nodeMessage?.text) {
          return <div className='console-line'>
            <span className='console-time'>{timestamp}</span>
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
      }}
    />
  </div>;
};

function iconClass(message: trace.ConsoleMessageTraceEvent['initializer']): string {
  switch (message.type) {
    case 'error': return 'error';
    case 'warning': return 'warning';
  }
  return 'blank';
}

function stdioClass(isError: boolean): string {
  return isError ? 'error' : 'blank';
}

function format(args: { preview: string, value: any }[]): JSX.Element[] {
  if (args.length === 1)
    return [<span>{args[0].preview}</span>];
  const hasMessageFormat = typeof args[0].value === 'string' && args[0].value.includes('%');
  const messageFormat = hasMessageFormat ? args[0].value as string : '';
  const tail = hasMessageFormat ? args.slice(1) : args;
  let argIndex = 0;

  const regex = /%([%sdifoOc])/g;
  let match;
  const formatted: JSX.Element[] = [];
  let tokens: JSX.Element[] = [];
  formatted.push(<span>{tokens}</span>);
  let formatIndex = 0;
  while ((match = regex.exec(messageFormat)) !== null) {
    const text = messageFormat.substring(formatIndex, match.index);
    tokens.push(<span>{text}</span>);
    formatIndex = match.index + 2;
    const specifier = match[0][1];
    if (specifier === '%') {
      tokens.push(<span>%</span>);
    } else if (specifier === 's' || specifier === 'o' || specifier === 'O' || specifier === 'd' || specifier === 'i' || specifier === 'f') {
      const value = tail[argIndex++];
      const styleObject: any = {};
      if (typeof value?.value !== 'string')
        styleObject['color'] = 'var(--vscode-debugTokenExpression-number)';
      tokens.push(<span style={styleObject}>{value?.preview || ''}</span>);
    } else if (specifier === 'c') {
      tokens = [];
      const format = tail[argIndex++];
      const styleObject = format ? parseCSSStyle(format.preview) : {};
      formatted.push(<span style={styleObject}>{tokens}</span>);
    }
  }
  if (formatIndex < messageFormat.length)
    tokens.push(<span>{messageFormat.substring(formatIndex)}</span>);
  for (; argIndex < tail.length; argIndex++) {
    const value = tail[argIndex];
    const styleObject: any = {};
    if (tokens.length)
      tokens.push(<span> </span>);
    if (typeof value?.value !== 'string')
      styleObject['color'] = 'var(--vscode-debugTokenExpression-number)';
    tokens.push(<span style={styleObject}>{value?.preview || ''}</span>);
  }
  return formatted;
}

function parseCSSStyle(cssFormat: string): Record<string, string | number> {
  try {
    const styleObject: Record<string, string | number> = {};
    const cssText = cssFormat.replace(/;$/, '').replace(/: /g, ':').replace(/; /g, ';');
    const cssProperties = cssText.split(';');
    for (const property of cssProperties) {
      const [key, value] = property.split(':');
      if (!supportProperty(key))
        continue;
      // cssProperties are background-color, JSDom ones are backgroundColor
      const cssKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
      styleObject[cssKey] = value;
    }
    return styleObject;
  } catch (e) {
    return {};
  }
}

function supportProperty(cssKey: string): boolean {
  const prefixes = ['background', 'border', 'color', 'font', 'line', 'margin', 'padding', 'text'];
  return prefixes.some(p => cssKey.startsWith(p));
}
