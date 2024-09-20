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
import type * as modelUtil from './modelUtil';
import { ListView } from '@web/components/listView';
import type { Boundaries } from '../geometry';
import { clsx, msToString } from '@web/uiUtils';
import { ansi2html } from '@web/ansi2html';
import { PlaceholderPanel } from './placeholderPanel';

export type ConsoleEntry = {
  browserMessage?: {
    body: JSX.Element[];
    location: string;
  },
  browserError?: channels.SerializedError;
  nodeMessage?: {
    html: string;
  },
  isError: boolean;
  isWarning: boolean;
  timestamp: number;
};

type ConsoleTabModel = {
  entries: ConsoleEntry[],
};

const ConsoleListView = ListView<ConsoleEntry>;


export function useConsoleTabModel(model: modelUtil.MultiTraceModel | undefined, selectedTime: Boundaries | undefined): ConsoleTabModel {
  const { entries } = React.useMemo(() => {
    if (!model)
      return { entries: [] };
    const entries: ConsoleEntry[] = [];
    for (const event of model.events) {
      if (event.type === 'console') {
        const body = event.args && event.args.length ? format(event.args) : formatAnsi(event.text);
        const url = event.location.url;
        const filename = url ? url.substring(url.lastIndexOf('/') + 1) : '<anonymous>';
        const location = `${filename}:${event.location.lineNumber}`;

        entries.push({
          browserMessage: {
            body,
            location,
          },
          isError: event.messageType === 'error',
          isWarning: event.messageType === 'warning',
          timestamp: event.time,
        });
      }
      if (event.type === 'event' && event.method === 'pageError') {
        entries.push({
          browserError: event.params.error,
          isError: true,
          isWarning: false,
          timestamp: event.time,
        });
      }
    }
    for (const event of model.stdio) {
      let html = '';
      if (event.text)
        html = ansi2html(event.text.trim()) || '';
      if (event.base64)
        html = ansi2html(atob(event.base64).trim()) || '';

      entries.push({
        nodeMessage: { html },
        isError: event.type === 'stderr',
        isWarning: false,
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

  return { entries: filteredEntries };
}

export const ConsoleTab: React.FunctionComponent<{
  boundaries: Boundaries,
  consoleModel: ConsoleTabModel,
  selectedTime: Boundaries | undefined,
  onEntryHovered: (entry: ConsoleEntry | undefined) => void,
  onAccepted: (entry: ConsoleEntry) => void,
}> = ({ consoleModel, boundaries, onEntryHovered, onAccepted }) => {
  if (!consoleModel.entries.length)
    return <PlaceholderPanel text='No console entries' />;

  return <div className='console-tab'>
    <ConsoleListView
      name='console'
      onAccepted={onAccepted}
      onHighlighted={onEntryHovered}
      items={consoleModel.entries}
      isError={entry => entry.isError}
      isWarning={entry => entry.isWarning}
      render={entry => {
        const timestamp = msToString(entry.timestamp - boundaries.minimum);
        const timestampElement = <span className='console-time'>{timestamp}</span>;
        const errorSuffix = entry.isError ? 'status-error' : entry.isWarning ? 'status-warning' : 'status-none';
        const statusElement = entry.browserMessage || entry.browserError ? <span className={clsx('codicon', 'codicon-browser', errorSuffix)} title='Browser message'></span> : <span className={clsx('codicon', 'codicon-file', errorSuffix)} title='Runner message'></span>;
        let locationText: string | undefined;
        let messageBody: JSX.Element[] | string | undefined;
        let messageInnerHTML: string | undefined;
        let messageStack: JSX.Element[] | string | undefined;

        const { browserMessage, browserError, nodeMessage } = entry;
        if (browserMessage) {
          locationText = browserMessage.location;
          messageBody = browserMessage.body;
        }

        if (browserError) {
          const { error: errorObject, value } = browserError;
          if (errorObject) {
            messageBody = errorObject.message;
            messageStack = errorObject.stack;
          } else {
            messageBody = String(value);
          }
        }

        if (nodeMessage)
          messageInnerHTML = nodeMessage.html;

        return <div className='console-line'>
          {timestampElement}
          {statusElement}
          {locationText && <span className='console-location'>{locationText}</span>}
          {messageBody && <span className='console-line-message'>{messageBody}</span>}
          {messageInnerHTML && <span className='console-line-message' dangerouslySetInnerHTML={{ __html: messageInnerHTML }}></span>}
          {messageStack && <div className='console-stack'>{messageStack}</div>}
        </div>;
      }}
    />
  </div>;
};

function format(args: { preview: string, value: any }[]): JSX.Element[] {
  if (args.length === 1)
    return formatAnsi(args[0].preview);

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

function formatAnsi(text: string): JSX.Element[] {
  // eslint-disable-next-line react/jsx-key
  return [<span dangerouslySetInnerHTML={{ __html: ansi2html(text.trim()) }}></span>];
}

function parseCSSStyle(cssFormat: string): Record<string, string | number> {
  try {
    const styleObject: Record<string, string | number> = {};
    const cssProperties = cssFormat.split(';');
    for (const token of cssProperties) {
      const property = token.trim();
      if (!property)
        continue;
      let [key, value] = property.split(':');
      key = key.trim();
      value = value.trim();
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
