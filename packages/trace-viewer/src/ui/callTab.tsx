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

import type { SerializedValue } from '@protocol/channels';
import type { ActionTraceEvent } from '@trace/trace';
import { clsx, msToString } from '@web/uiUtils';
import * as React from 'react';
import './callTab.css';
import { CopyToClipboard } from './copyToClipboard';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';
import { PlaceholderPanel } from './placeholderPanel';
import type { ActionTraceEventInContext } from './modelUtil';

export const CallTab: React.FunctionComponent<{
  action: ActionTraceEventInContext | undefined,
  sdkLanguage: Language | undefined,
}> = ({ action, sdkLanguage }) => {
  if (!action)
    return <PlaceholderPanel text='No action selected' />;
  const params = { ...action.params };
  // Strip down the waitForEventInfo data, we never need it.
  delete params.info;
  const paramKeys = Object.keys(params);
  const timeMillis = action.startTime + (action.context.wallTime - action.context.startTime);
  const wallTime = new Date(timeMillis).toLocaleString();
  const duration = action.endTime ? msToString(action.endTime - action.startTime) : 'Timed Out';

  return <div className='call-tab'>
    <div className='call-line'>{action.apiName}</div>
    {<>
      <div className='call-section'>Time</div>
      {wallTime && <div className='call-line'>wall time:<span className='call-value datetime' title={wallTime}>{wallTime}</span></div>}
      <div className='call-line'>duration:<span className='call-value datetime' title={duration}>{duration}</span></div>
    </>}
    { !!paramKeys.length && <div className='call-section'>Parameters</div> }
    {
      !!paramKeys.length && paramKeys.map((name, index) => renderProperty(propertyToString(action, name, params[name], sdkLanguage), 'param-' + index))
    }
    { !!action.result && <div className='call-section'>Return value</div> }
    {
      !!action.result && Object.keys(action.result).map((name, index) =>
        renderProperty(propertyToString(action, name, action.result[name], sdkLanguage), 'result-' + index)
      )
    }
  </div>;
};

type Property = {
  name: string;
  type: 'string' | 'number' | 'object' | 'locator' | 'handle' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'function';
  text: string;
};

function renderProperty(property: Property, key: string) {
  let text = property.text.replace(/\n/g, '↵');
  if (property.type === 'string')
    text = `"${text}"`;
  return (
    <div key={key} className='call-line'>
      {property.name}:<span className={clsx('call-value', property.type)} title={property.text}>{text}</span>
      { ['string', 'number', 'object', 'locator'].includes(property.type) &&
        <CopyToClipboard value={property.text} />
      }
    </div>
  );
}

function propertyToString(event: ActionTraceEvent, name: string, value: any, sdkLanguage: Language | undefined): Property {
  const isEval = event.method.includes('eval') || event.method === 'waitForFunction';
  if (name === 'files')
    return { text: '<files>', type: 'string', name };
  if (name === 'eventInit' || name === 'expectedValue' || (name === 'arg' && isEval))
    value = parseSerializedValue(value.value, new Array(10).fill({ handle: '<handle>' }));
  if ((name === 'value' && isEval) || (name === 'received' && event.method === 'expect'))
    value = parseSerializedValue(value, new Array(10).fill({ handle: '<handle>' }));
  if (name === 'selector')
    return { text: asLocator(sdkLanguage || 'javascript', event.params.selector), type: 'locator', name: 'locator' };
  const type = typeof value;
  if (type !== 'object' || value === null)
    return { text: String(value), type, name };
  if (value.guid)
    return { text: '<handle>', type: 'handle', name };
  return { text: JSON.stringify(value).slice(0, 1000), type: 'object', name };
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
