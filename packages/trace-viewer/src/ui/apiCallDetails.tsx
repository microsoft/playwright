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

import * as React from 'react';
import './apiCallDetails.css';
import type { ActionTraceEvent } from '@trace/trace';
import type { ActionTraceEventInContext, TraceModel } from '@isomorphic/trace/traceModel';
import { CodeMirrorWrapper, lineHeight } from '@web/components/codeMirrorWrapper';
import { bytesToString, msToString } from '@isomorphic/formatUtils';
import { clsx } from '@web/uiUtils';
import { resolveApiCallData, collectApiCallActions, shouldShowApiCallDetailsUi, type ApiCallData } from './apiCallUtils';

type RequestTab = 'query' | 'headers' | 'body';
type ResponseTab = 'response' | 'headers';

function statusLabel(status?: number, statusText?: string): string {
  if (status === undefined)
    return '';
  return statusText ? `${status} (${statusText})` : String(status);
}

function statusClass(status?: number): string {
  if (status === undefined)
    return '';
  if (status < 300 || status === 304)
    return 'api-call-details-meta';
  if (status < 400)
    return 'api-call-details-meta';
  return 'api-call-details-meta api-call-details-meta-error';
}

function formatJson(value: unknown): string {
  if (value === undefined || value === null)
    return '';
  if (typeof value === 'string')
    return value;
  return JSON.stringify(value, null, 2);
}

function hasEntries(record?: Record<string, unknown>): boolean {
  return !!record && Object.keys(record).length > 0;
}

const KeyValueTable: React.FC<{ data?: Record<string, unknown> | Record<string, string> }> = ({ data }) => {
  if (!hasEntries(data))
    return <div className='api-call-details-empty'>No data</div>;
  return <table className='api-call-details-table'>
    <tbody>
      {Object.entries(data!).map(([name, value]) => (
        <tr key={name}>
          <td>{name}</td>
          <td>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
        </tr>
      ))}
    </tbody>
  </table>;
};

const JsonPanel: React.FC<{ value: unknown, compact?: boolean }> = ({ value, compact }) => {
  const text = formatJson(value);
  if (!text)
    return <div className='api-call-details-empty'>No data</div>;
  const lineCount = text.split('\n').length;
  const height = Math.min(Math.max(compact ? 5 : 8, lineCount), compact ? 16 : 24) * lineHeight;
  return <div style={{ height }}>
    <CodeMirrorWrapper text={text} mimeType='application/json' readOnly lineNumbers wrapLines={false} />
  </div>;
};

export const ApiCallDetailsPanel: React.FC<{
  data: ApiCallData,
  compact?: boolean,
}> = ({ data, compact }) => {
  const requestTabs = ([
    { id: 'query' as RequestTab, label: 'Query', visible: hasEntries(data.request?.query) },
    { id: 'headers' as RequestTab, label: 'Headers', visible: hasEntries(data.request?.headers) },
    { id: 'body' as RequestTab, label: 'Body', visible: data.request?.body !== undefined },
  ] as const).filter(tab => tab.visible);
  const responseTabs = ([
    { id: 'response' as ResponseTab, label: 'Response', visible: data.response?.body !== undefined },
    { id: 'headers' as ResponseTab, label: 'Headers', visible: hasEntries(data.response?.headers) },
  ] as const).filter(tab => tab.visible);

  const [requestTab, setRequestTab] = React.useState<RequestTab>(requestTabs[0]?.id ?? 'body');
  const [responseTab, setResponseTab] = React.useState<ResponseTab>(responseTabs[0]?.id ?? 'response');

  React.useEffect(() => {
    if (!requestTabs.some(tab => tab.id === requestTab))
      setRequestTab(requestTabs[0]?.id ?? 'body');
  }, [data, requestTab, requestTabs]);

  React.useEffect(() => {
    if (!responseTabs.some(tab => tab.id === responseTab))
      setResponseTab(responseTabs[0]?.id ?? 'response');
  }, [data, responseTab, responseTabs]);

  return <div className={clsx('api-call-details', compact && 'compact')}>
    <div className='api-call-details-header'>
      <span className={clsx('api-call-details-method', data.method)}>{data.method}</span>
      <span className='api-call-details-url' title={data.url}>{data.url}</span>
      <div className='api-call-details-meta'>
        {data.status !== undefined && <span className={statusClass(data.status)}>Status: {statusLabel(data.status, data.statusText)}</span>}
        {data.duration !== undefined && <span>Duration: {msToString(data.duration)}</span>}
        {data.size !== undefined && <span>Size: {bytesToString(data.size)}</span>}
      </div>
    </div>
    <div className='api-call-details-columns'>
      <div className='api-call-details-column'>
        <div className='api-call-details-tabs' role='tablist' aria-label='Request details'>
          {(requestTabs.length ? requestTabs : [{ id: 'body' as RequestTab, label: 'Body', visible: true }]).map(tab => (
            <button
              key={tab.id}
              type='button'
              role='tab'
              className={clsx('api-call-details-tab', requestTab === tab.id && 'selected')}
              aria-selected={requestTab === tab.id}
              onClick={() => setRequestTab(tab.id)}
            >{tab.label}</button>
          ))}
        </div>
        <div className='api-call-details-body'>
          {requestTab === 'query' && <KeyValueTable data={data.request?.query} />}
          {requestTab === 'headers' && <KeyValueTable data={data.request?.headers} />}
          {requestTab === 'body' && <JsonPanel value={data.request?.body} compact={compact} />}
        </div>
      </div>
      <div className='api-call-details-column'>
        <div className='api-call-details-tabs' role='tablist' aria-label='Response details'>
          {(responseTabs.length ? responseTabs : [{ id: 'response' as ResponseTab, label: 'Response', visible: true }]).map(tab => (
            <button
              key={tab.id}
              type='button'
              role='tab'
              className={clsx('api-call-details-tab', responseTab === tab.id && 'selected')}
              aria-selected={responseTab === tab.id}
              onClick={() => setResponseTab(tab.id)}
            >{tab.label}</button>
          ))}
        </div>
        <div className='api-call-details-body'>
          {responseTab === 'response' && <JsonPanel value={data.response?.body} compact={compact} />}
          {responseTab === 'headers' && <KeyValueTable data={data.response?.headers} />}
        </div>
      </div>
    </div>
  </div>;
};

export const ApiCallDetailsLoader: React.FC<{
  action: ActionTraceEvent,
  model: TraceModel | undefined,
  allActions: ActionTraceEventInContext[],
  compact?: boolean,
}> = ({ action, model, allActions, compact }) => {
  const [data, setData] = React.useState<ApiCallData | undefined>();
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    let canceled = false;
    setData(undefined);
    setError(undefined);
    resolveApiCallData(action, model, allActions).then(result => {
      if (canceled)
        return;
      if (result)
        setData(result);
      else
        setError('Unable to load API call details.');
    }).catch(e => {
      if (!canceled)
        setError(String(e.message || e));
    });
    return () => { canceled = true; };
  }, [action, model, allActions]);

  if (error)
    return <div className='api-call-details-empty'>{error}</div>;
  if (!data)
    return <div className='api-call-details-loading'>Loading API details…</div>;
  return <ApiCallDetailsPanel data={data} compact={compact} />;
};

export const ApiCallViewport: React.FC<{
  action: ActionTraceEvent | undefined,
  model: TraceModel | undefined,
  allActions: ActionTraceEventInContext[],
  showAllApiCalls: boolean,
}> = ({ action, model, allActions, showAllApiCalls }) => {
  const apiActions = React.useMemo(() => collectApiCallActions(allActions), [allActions]);

  if (showAllApiCalls) {
    if (!apiActions.length)
      return <div className='api-call-details-viewport'><div className='api-call-details-empty'>No API calls in this trace.</div></div>;
    return <div className='api-call-details-viewport'>
      <div className='api-call-details-viewport-list'>
        {apiActions.map(apiAction => (
          <ApiCallDetailsLoader
            key={apiAction.callId}
            action={apiAction}
            model={model}
            allActions={allActions}
          />
        ))}
      </div>
    </div>;
  }

  if (!action)
    return null;
  return <div className='api-call-details-viewport'>
    <ApiCallDetailsLoader action={action} model={model} allActions={allActions} />
  </div>;
};

function isManuallyExpandedApiCall(
  callId: string | undefined,
  expandedApiCalls: Set<string> | undefined,
  collapsedApiCalls: Set<string> | undefined,
): boolean {
  if (!callId)
    return false;
  if (collapsedApiCalls?.has(callId))
    return false;
  return !!expandedApiCalls?.has(callId);
}

export function shouldShowApiCallViewport(
  autoShowApiDetails: boolean,
  showAllApiCalls: boolean,
  action: ActionTraceEvent | undefined,
  allActions: ActionTraceEventInContext[],
  expandedApiCalls?: Set<string>,
  collapsedApiCalls?: Set<string>,
): boolean {
  if (showAllApiCalls)
    return true;
  if (!action || !shouldShowApiCallDetailsUi(action, allActions))
    return false;
  if (autoShowApiDetails)
    return true;
  return isManuallyExpandedApiCall(action.callId, expandedApiCalls, collapsedApiCalls);
}
