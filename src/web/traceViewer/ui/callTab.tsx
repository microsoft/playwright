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
import './callTab.css';
import { ActionTraceEvent } from '../../../server/trace/common/traceEvents';

export const CallTab: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
}> = ({ action }) => {
  if (!action)
    return null;
  const logs = action.metadata.log;
  const error = action.metadata.error?.error?.message;
  const params = { ...action.metadata.params };
  delete params.info;
  const paramKeys = Object.keys(params);
  return <div className='call-tab'>
      <div className='call-error' key='error' hidden={!error}>
        <div className='codicon codicon-issues'/>
        {error}
      </div>
      <div className='call-line'>{action.metadata.apiName}</div>
      { !!paramKeys.length && <div className='call-section'>Parameters</div> }
      {
        !!paramKeys.length && paramKeys.map(name =>
          <div className='call-line'>{name}: <span className={typeof params[name]}>{renderValue(params[name])}</span></div>
        )
      }
      { !!action.metadata.result && <div className='call-section'>Return value</div> }
      {
        !!action.metadata.result && Object.keys(action.metadata.result).map(name =>
          <div className='call-line'>{name}: <span className={typeof action.metadata.result[name]}>{renderValue(action.metadata.result[name])}</span></div>
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

function renderValue(value: any) {
  const type = typeof value;
  if (type !== 'object')
    return String(value);
  if (value.guid)
    return '<handle>';
}
