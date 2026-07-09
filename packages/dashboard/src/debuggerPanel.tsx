/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import './debuggerPanel.css';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton } from '@web/components/toolbarButton';
import { SplitView } from '@web/components/splitView';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import { clsx } from '@web/uiUtils';

import type { ApiCall, DebuggerSource } from './dashboardChannel';
import type { DashboardModel } from './dashboardModel';

type DebuggerPanelProps = {
  model: DashboardModel;
};

// Modeled after the recorder's CallLogView + debug toolbar (packages/recorder/src).
export const DebuggerPanel: React.FC<DebuggerPanelProps> = ({ model }) => {
  const { apiCalls, debuggerPaused, debuggerSource } = model.state;
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  // Explicit expand/collapse overrides per call id; when absent, the default is
  // driven by status (running/error expanded, success collapsed).
  const [expandOverrides, setExpandOverrides] = React.useState<Map<string, boolean>>(new Map());

  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [apiCalls]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F8') {
        event.preventDefault();
        if (debuggerPaused)
          model.debuggerResume();
        else
          model.debuggerPause();
      } else if (event.key === 'F10' && debuggerPaused) {
        event.preventDefault();
        model.debuggerStep();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [debuggerPaused, model]);

  return (
    <div className='debugger-panel'>
      <Toolbar>
        <div className='debugger-panel-title'>Actions</div>
        <div style={{ flex: 'auto' }}></div>
        <ToolbarButton icon='debug-continue' title='Resume (F8)' ariaLabel='Resume' disabled={!debuggerPaused} onClick={() => model.debuggerResume()} />
        <ToolbarButton icon='debug-pause' title='Pause (F8)' ariaLabel='Pause' disabled={debuggerPaused} onClick={() => model.debuggerPause()} />
        <ToolbarButton icon='debug-step-over' title='Step over (F10)' ariaLabel='Step over' disabled={!debuggerPaused} onClick={() => model.debuggerStep()} />
      </Toolbar>
      <SplitView
        orientation='vertical'
        sidebarSize={200}
        minSidebarSize={100}
        settingName='dashboardDebuggerSource'
        main={<div className='debugger-call-log'>
          {apiCalls.length === 0 && <div className='debugger-empty'>No actions yet</div>}
          {apiCalls.map(call => {
            const override = expandOverrides.get(call.id);
            const isExpanded = typeof override === 'boolean' ? override : call.status !== 'success';
            return (
              <div className={clsx('debugger-call', call.status)} key={call.id}>
                <div className='debugger-call-header' onClick={() => {
                  const next = new Map(expandOverrides);
                  next.set(call.id, !isExpanded);
                  setExpandOverrides(next);
                }}>
                  <span className={clsx('codicon', `codicon-chevron-${isExpanded ? 'down' : 'right'}`)}></span>
                  <span className='debugger-call-title'>{call.title}</span>
                  {call.location && <span className='debugger-call-location'>{locationLabel(call.location)}</span>}
                  <span className={clsx('codicon', iconClass(call.status))}></span>
                </div>
                {isExpanded && call.logs.map((message, i) => (
                  <div className='debugger-call-message' key={i}>{message.trim()}</div>
                ))}
                {!!call.error && <div className='debugger-call-message error' hidden={!isExpanded}>{call.error}</div>}
              </div>
            );
          })}
          <div ref={messagesEndRef}></div>
        </div>}
        sidebar={<SourceView source={debuggerSource} />}
      />
    </div>
  );
};

const SourceView: React.FC<{ source: DebuggerSource | null }> = ({ source }) => {
  if (!source) {
    return <div className='debugger-source'>
      <div className='debugger-empty'>No source</div>
    </div>;
  }
  const file = source.file.split(/[\\/]/).pop() ?? source.file;
  return <div className='debugger-source'>
    <div className='debugger-source-header' title={source.file}>{file}</div>
    <CodeMirrorWrapper
      text={source.text}
      highlighter={source.language}
      highlight={source.highlight}
      revealLine={source.revealLine}
      readOnly={true}
      lineNumbers={true}
    />
  </div>;
};

function iconClass(status: ApiCall['status']): string {
  switch (status) {
    case 'running': return 'codicon-loading codicon-modifier-spin';
    case 'success': return 'codicon-check';
    case 'error': return 'codicon-error';
  }
}

function locationLabel(location: NonNullable<ApiCall['location']>): string {
  const file = location.file.split(/[\\/]/).pop() ?? location.file;
  return location.line ? `${file}:${location.line}` : file;
}
