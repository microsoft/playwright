/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { msToString } from '@web/uiUtils';
import * as React from 'react';
import type { MultiTraceModel } from './modelUtil';
import './callTab.css';

export const MetadataView: React.FunctionComponent<{
  model?: MultiTraceModel,
}> = ({ model }) => {
  if (!model)
    return <></>;

  const wallTime = model.wallTime !== undefined ? new Date(model.wallTime).toLocaleString(undefined, { timeZoneName: 'short' }) : undefined;

  return <div className='vbox' style={{ flexShrink: 0 }}>
    <div className='call-section' style={{ paddingTop: 2 }}>Time</div>
    {!!wallTime && <div className='call-line'>start time:<span className='call-value datetime' title={wallTime}>{wallTime}</span></div>}
    <div className='call-line'>duration:<span className='call-value number' title={msToString(model.endTime - model.startTime)}>{msToString(model.endTime - model.startTime)}</span></div>
    <div className='call-section'>Browser</div>
    <div className='call-line'>engine:<span className='call-value string' title={model.browserName}>{model.browserName}</span></div>
    {model.channel && <div className='call-line'>channel:<span className='call-value string' title={model.channel}>{model.channel}</span></div>}
    {model.platform && <div className='call-line'>platform:<span className='call-value string' title={model.platform}>{model.platform}</span></div>}
    {model.options.userAgent && <div className='call-line'>user agent:<span className='call-value datetime' title={model.options.userAgent}>{model.options.userAgent}</span></div>}
    {model.options.baseURL && (
      <>
        <div className='call-section' style={{ paddingTop: 2 }}>Config</div>
        <div className='call-line'>baseURL:<a className='call-value string' href={model.options.baseURL} title={model.options.baseURL} target='_blank' rel='noopener noreferrer'>{model.options.baseURL}</a></div>
      </>
    )}
    <div className='call-section'>Viewport</div>
    {model.options.viewport && <div className='call-line'>width:<span className='call-value number' title={String(!!model.options.viewport?.width)}>{model.options.viewport.width}</span></div>}
    {model.options.viewport && <div className='call-line'>height:<span className='call-value number' title={String(!!model.options.viewport?.height)}>{model.options.viewport.height}</span></div>}
    <div className='call-line'>is mobile:<span className='call-value boolean' title={String(!!model.options.isMobile)}>{String(!!model.options.isMobile)}</span></div>
    {model.options.deviceScaleFactor && <div className='call-line'>device scale:<span className='call-value number' title={String(model.options.deviceScaleFactor)}>{String(model.options.deviceScaleFactor)}</span></div>}
    <div className='call-section'>Counts</div>
    <div className='call-line'>pages:<span className='call-value number'>{model.pages.length}</span></div>
    <div className='call-line'>actions:<span className='call-value number'>{model.actions.length}</span></div>
    <div className='call-line'>events:<span className='call-value number'>{model.events.length}</span></div>
  </div>;
};
