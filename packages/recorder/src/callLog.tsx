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
import type { CallLog } from './recorderTypes';
import { clsx, msToString } from '@web/uiUtils';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';

export type CallLogProps = {
  language: Language;
  log: CallLog[];
};

export const CallLogView: React.FC<CallLogProps> = ({
  language,
  log,
}) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [expandOverrides, setExpandOverrides] = React.useState<Map<string, boolean>>(new Map());
  React.useLayoutEffect(() => {
    if (log.find(callLog => callLog.reveal))
      messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef, log]);
  return <div className='call-log' style={{ flex: 'auto' }}>
    {log.map(callLog => {
      const expandOverride = expandOverrides.get(callLog.id);
      const isExpanded = typeof expandOverride === 'boolean' ? expandOverride : callLog.status !== 'done';
      const locator = callLog.params.selector ? asLocator(language, callLog.params.selector) : null;
      let titlePrefix = callLog.title;
      let titleSuffix = '';
      if (callLog.title.startsWith('expect.to') || callLog.title.startsWith('expect.not.to')) {
        titlePrefix = 'expect(';
        titleSuffix = `).${callLog.title.substring('expect.'.length)}()`;
      } else if (callLog.title.startsWith('locator.')) {
        titlePrefix = '';
        titleSuffix = `.${callLog.title.substring('locator.'.length)}()`;
      } else if (locator || callLog.params.url) {
        titlePrefix = callLog.title + '(';
        titleSuffix = ')';
      }
      return <div className={clsx('call-log-call', callLog.status)} key={callLog.id}>
        <div className='call-log-call-header'>
          <span className={clsx('codicon', `codicon-chevron-${isExpanded ? 'down' : 'right'}`)} style={{ cursor: 'pointer' }}onClick={() => {
            const newOverrides = new Map(expandOverrides);
            newOverrides.set(callLog.id, !isExpanded);
            setExpandOverrides(newOverrides);
          }}></span>
          { titlePrefix }
          { callLog.params.url ? <span className='call-log-details'><span className='call-log-url' title={callLog.params.url}>{callLog.params.url}</span></span> : undefined }
          { locator ? <span className='call-log-details'><span className='call-log-selector' title={`page.${locator}`}>{`page.${locator}`}</span></span> : undefined }
          { titleSuffix }
          <span className={clsx('codicon', iconClass(callLog))}></span>
          { typeof callLog.duration === 'number' ? <span className='call-log-time'>— {msToString(callLog.duration)}</span> : undefined}
        </div>
        { (isExpanded ? callLog.messages : []).map((message, i) => {
          return <div className='call-log-message' key={i}>
            { message.trim() }
          </div>;
        })}
        { !!callLog.error && <div className='call-log-message error' hidden={!isExpanded}>{ callLog.error }</div> }
      </div>;
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
