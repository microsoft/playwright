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
  const { apiCalls, debuggerPaused, debuggerPauseRequested, debuggerSource } = model.state;
  const callLogRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  // Follow the log only while the user is already near the bottom, so that
  // live updates do not steal a scrolled-up position.
  const stickToBottomRef = React.useRef(true);
  // Explicit expand/collapse overrides per call id; when absent, the default is
  // driven by status (running/error expanded, success collapsed).
  const [expandOverrides, setExpandOverrides] = React.useState<Map<string, boolean>>(new Map());

  React.useLayoutEffect(() => {
    if (stickToBottomRef.current)
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

  const pausePending = debuggerPauseRequested && !debuggerPaused;
  return (
    <div className={clsx('debugger-panel', debuggerPaused && 'paused', pausePending && 'pause-pending')}>
      <Toolbar>
        <div className='debugger-panel-title'>Actions</div>
        <ToolbarButton className='debugger-run-control' icon='debug-continue' title='Resume (F8)' ariaLabel='Resume' disabled={!debuggerPaused} onClick={() => model.debuggerResume()} />
        <ToolbarButton icon='debug-pause' title='Pause (F8)' ariaLabel='Pause' disabled={debuggerPaused} toggled={pausePending} onClick={() => model.debuggerPause()} />
        <ToolbarButton className='debugger-run-control' icon='debug-step-over' title='Step over (F10)' ariaLabel='Step over' disabled={!debuggerPaused} onClick={() => model.debuggerStep()} />
        {debuggerPaused && <div className='debugger-status'>Paused</div>}
        {pausePending && <div className='debugger-status'>Pausing before the next action…</div>}
        <div style={{ flex: 'auto' }}></div>
      </Toolbar>
      <SplitView
        orientation='horizontal'
        sidebarSize={380}
        minSidebarSize={220}
        settingName='dashboardDebuggerSource'
        sidebarHidden={!debuggerSource}
        main={<div className='debugger-call-log' ref={callLogRef} onScroll={() => {
          const element = callLogRef.current!;
          stickToBottomRef.current = element.scrollTop + element.clientHeight >= element.scrollHeight - 40;
        }}>
          {apiCalls.length === 0 && <div className='debugger-empty'>No actions yet</div>}
          {apiCalls.map(call => {
            const hasDetails = call.logs.length > 0 || !!call.error;
            const override = expandOverrides.get(call.id);
            const isExpanded = hasDetails && (typeof override === 'boolean' ? override : call.status !== 'success');
            return (
              <div className={clsx('debugger-call', call.status)} key={call.id}>
                <div className={clsx('debugger-call-header', hasDetails && 'expandable')} onClick={() => {
                  if (!hasDetails)
                    return;
                  const next = new Map(expandOverrides);
                  next.set(call.id, !isExpanded);
                  setExpandOverrides(next);
                }}>
                  <span className={clsx('codicon', `codicon-chevron-${isExpanded ? 'down' : 'right'}`)} style={{ visibility: hasDetails ? 'visible' : 'hidden' }}></span>
                  <span className='debugger-call-title'>{call.title}</span>
                  {call.location && <span className='debugger-call-location'>{locationLabel(call.location)}</span>}
                  {call.status !== 'success' && <span className={clsx('codicon', iconClass(call.status))}></span>}
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

function iconClass(status: Exclude<ApiCall['status'], 'success'>): string {
  switch (status) {
    case 'running': return 'codicon-loading codicon-modifier-spin';
    case 'error': return 'codicon-error';
  }
}

function locationLabel(location: NonNullable<ApiCall['location']>): string {
  const file = location.file.split(/[\\/]/).pop() ?? location.file;
  return location.line ? `${file}:${location.line}` : file;
}
