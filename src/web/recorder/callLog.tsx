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

import './callLog.css';
import * as React from 'react';
import type { CallLog } from '../../server/supplements/recorder/recorderTypes';
import { msToString } from '../uiUtils';

export interface CallLogProps {
  log: CallLog[],
}

export const CallLogView: React.FC<CallLogProps> = ({
  log,
}) => {
  const messagesEndRef = React.createRef<HTMLDivElement>();
  const [expandOverrides, setExpandOverrides] = React.useState<Map<string, boolean>>(new Map());
  React.useLayoutEffect(() => {
    if (log.find(callLog => callLog.reveal))
      messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef]);
  return <div className='call-log' style={{flex: 'auto'}}>
    {log.map(callLog => {
      const expandOverride = expandOverrides.get(callLog.id);
      const isExpanded = typeof expandOverride === 'boolean' ? expandOverride : callLog.status !== 'done';
      return <div className={`call-log-call ${callLog.status}`} key={callLog.id}>
        <div className='call-log-call-header'>
          <span className={`codicon codicon-chevron-${isExpanded ? 'down' : 'right'}`} style={{ cursor: 'pointer' }}onClick={() => {
            const newOverrides = new Map(expandOverrides);
            newOverrides.set(callLog.id, !isExpanded);
            setExpandOverrides(newOverrides);
          }}></span>
          { callLog.title }
          { callLog.params.url ? <span className='call-log-details'>(<span className='call-log-url' title={callLog.params.url}>{callLog.params.url}</span>)</span> : undefined }
          { callLog.params.selector ? <span className='call-log-details'>(<span className='call-log-selector' title={callLog.params.selector}>{callLog.params.selector}</span>)</span> : undefined }
          <span className={'codicon ' + iconClass(callLog)}></span>
          { typeof callLog.duration === 'number' ? <span className='call-log-time'>— {msToString(callLog.duration)}</span> : undefined}
        </div>
        { (isExpanded ? callLog.messages : []).map((message, i) => {
          return <div className='call-log-message' key={i}>
            { message.trim() }
          </div>;
        })}
        { !!callLog.error && <div className='call-log-message error' hidden={!isExpanded}>{ callLog.error.error?.message }</div> }
      </div>
    })}
    <div ref={messagesEndRef}></div>
  </div>;
};

function iconClass(callLog: CallLog): string {
  switch (callLog.status) {
    case 'done': return 'codicon-check';
    case 'in-progress': return 'codicon-clock';
    case 'paused': return 'codicon-debug-pause';
    case 'error': return 'codicon-error';
  }
}
