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

import type { CallMetadata } from '@playwright-core/protocol/callMetadata';
import type { SerializedValue } from '@playwright-core/protocol/channels';
import type { ActionTraceEvent } from '@playwright-core/server/trace/common/traceEvents';
import { msToString } from '@web/uiUtils';
import * as React from 'react';
import './callTab.css';

export const CallTab: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
}> = ({ action }) => {
  if (!action)
    return null;
  const logs = action.metadata.log;
  const error = action.metadata.error?.error?.message;
  const params = { ...action.metadata.params };
  // Strip down the waitForEventInfo data, we never need it.
  delete params.info;
  const paramKeys = Object.keys(params);
  const wallTime = new Date(action.metadata.wallTime).toLocaleString();
  const duration = action.metadata.endTime ? msToString(action.metadata.endTime - action.metadata.startTime) : 'Timed Out';
  return <div className='call-tab'>
    <div className='call-error' key='error' hidden={!error}>
      <div className='codicon codicon-issues'/>
      {error}
    </div>
    <div className='call-line'>{action.metadata.apiName}</div>
    {<>
      <div className='call-section'>Time</div>
      {action.metadata.wallTime && <div className='call-line'>wall time: <span className='datetime' title={wallTime}>{wallTime}</span></div>}
      <div className='call-line'>duration: <span className='datetime' title={duration}>{duration}</span></div>
    </>}
    { !!paramKeys.length && <div className='call-section'>Parameters</div> }
    {
      !!paramKeys.length && paramKeys.map((name, index) => renderLine(action.metadata, name, params[name], 'param-' + index))
    }
    { !!action.metadata.result && <div className='call-section'>Return value</div> }
    {
      !!action.metadata.result && Object.keys(action.metadata.result).map((name, index) =>
        renderLine(action.metadata, name, action.metadata.result[name], 'result-' + index)
      )
    }
    <div className='call-section'>Log</div>
    {
      logs.map((logLine, index) => {
        return <div key={index} className='call-line'>
          {logLine}
        </div>;
      })
    }
  </div>;
};

function renderLine(metadata: CallMetadata, name: string, value: any, key: string) {
  const { title, type } = toString(metadata, name, value);
  let text = title.replace(/\n/g, '↵');
  if (type === 'string')
    text = `"${text}"`;
  return <div key={key} className='call-line'>{name}: <span className={type} title={title}>{text}</span></div>;
}

function toString(metadata: CallMetadata, name: string, value: any): { title: string, type: string } {
  if (metadata.method.includes('eval')) {
    if (name === 'arg')
      value = parseSerializedValue(value.value, new Array(10).fill({ handle: '<handle>' }));
    if (name === 'value')
      value = parseSerializedValue(value, new Array(10).fill({ handle: '<handle>' }));
  }
  const type = typeof value;
  if (type !== 'object' || value === null)
    return { title: String(value), type };
  if (value.guid)
    return { title: '<handle>', type: 'handle' };
  return { title: JSON.stringify(value), type: 'object' };
}

function parseSerializedValue(value: SerializedValue, handles: any[] | undefined): any {
  if (value.n !== undefined)
    return value.n;
  if (value.s !== undefined)
    return value.s;
  if (value.b !== undefined)
    return value.b;
  if (value.v !== undefined) {
    if (value.v === 'undefined')
      return undefined;
    if (value.v === 'null')
      return null;
    if (value.v === 'NaN')
      return NaN;
    if (value.v === 'Infinity')
      return Infinity;
    if (value.v === '-Infinity')
      return -Infinity;
    if (value.v === '-0')
      return -0;
  }
  if (value.d !== undefined)
    return new Date(value.d);
  if (value.r !== undefined)
    return new RegExp(value.r.p, value.r.f);
  if (value.a !== undefined)
    return value.a.map((a: any) => parseSerializedValue(a, handles));
  if (value.o !== undefined) {
    const result: any = {};
    for (const { k, v } of value.o)
      result[k] = parseSerializedValue(v, handles);
    return result;
  }
  if (value.h !== undefined) {
    if (handles === undefined)
      return '<object>';
    return handles[value.h];
  }
  return '<object>';
}
