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

import './recorder.css';
import * as React from 'react';
import { Toolbar } from '../components/toolbar';
import { ToolbarButton } from '../components/toolbarButton';
import { Source as SourceView } from '../components/source';
import type { CallLog, Mode, Source } from '../../server/supplements/recorder/recorderTypes';
import { SplitView } from '../components/splitView';

declare global {
  interface Window {
    playwrightSetMode: (mode: Mode) => void;
    playwrightSetPaused: (paused: boolean) => void;
    playwrightSetSources: (sources: Source[]) => void;
    playwrightUpdateLogs: (callLogs: CallLog[]) => void;
    dispatch(data: any): Promise<void>;
    playwrightSourcesEchoForTest: Source[];
  }
}

export interface RecorderProps {
}

export const Recorder: React.FC<RecorderProps> = ({
}) => {
  const [sources, setSources] = React.useState<Source[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [log, setLog] = React.useState(new Map<number, CallLog>());
  const [mode, setMode] = React.useState<Mode>('none');

  window.playwrightSetMode = setMode;
  window.playwrightSetSources = setSources;
  window.playwrightSetPaused = setPaused;
  window.playwrightUpdateLogs = callLogs => {
    const newLog = new Map<number, CallLog>(log);
    for (const callLog of callLogs)
      newLog.set(callLog.id, callLog);
    setLog(newLog);
  };

  window.playwrightSourcesEchoForTest = sources;
  const source = sources.find(source => {
    let s = sources.find(s => s.revealLine);
    if (!s)
      s = sources.find(s => s.file === source.file);
    if (!s)
      s = sources[0];
    return s;
  }) || {
    file: 'untitled',
    text: '',
    language: 'javascript',
    highlight: []
  };

  const messagesEndRef = React.createRef<HTMLDivElement>();
  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef]);
  
  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon='record' title='Record' toggled={mode == 'recording'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'recording' ? 'none' : 'recording' }}).catch(() => { });
      }}></ToolbarButton>
      <ToolbarButton icon='question' title='Inspect' toggled={mode == 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'inspecting' ? 'none' : 'inspecting' }}).catch(() => { });
      }}></ToolbarButton>
      <ToolbarButton icon='files' title='Copy' disabled={!source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume' disabled={!paused} onClick={() => {
        setPaused(false);
        window.dispatch({ event: 'resume' }).catch(() => {});
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause' disabled={paused} onClick={() => {
        window.dispatch({ event: 'pause' }).catch(() => {});
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over' disabled={!paused} onClick={() => {
        setPaused(false);
        window.dispatch({ event: 'step' }).catch(() => {});
      }}></ToolbarButton>
      <div style={{flex: 'auto'}}></div>
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source.text} onClick={() => {
        window.dispatch({ event: 'clear' }).catch(() => {});
      }}></ToolbarButton>
    </Toolbar>
    <SplitView sidebarSize={200}>
      <SourceView text={source.text} language={source.language} highlight={source.highlight} revealLine={source.revealLine}></SourceView>
      <div className='vbox'>
        <div className='recorder-log-header' style={{flex: 'none'}}>Log</div>
        <div className='recorder-log' style={{flex: 'auto'}}>
          {[...log.values()].map(callLog => {
            return <div className={`recorder-log-call ${callLog.status}`} key={callLog.id}>
              <div className='recorder-log-call-header'>
                <span className={'codicon ' + iconClass(callLog)}></span>{ callLog.title }
              </div>
              { callLog.messages.map((message, i) => {
                return <div className='recorder-log-message' key={i}>
                  { message.trim() }
                </div>;
              })}
              { callLog.error ? <div className='recorder-log-message error'>
                { callLog.error }
              </div> : undefined }
            </div>
          })}
          <div ref={messagesEndRef}></div>
        </div>
      </div>
    </SplitView>
  </div>;
};

function copy(text: string) {
  const textArea = document.createElement('textarea');
  textArea.style.position = 'absolute';
  textArea.style.zIndex = '-1000';
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}

function iconClass(callLog: CallLog): string {
  switch (callLog.status) {
    case 'done': return 'codicon-check';
    case 'in-progress': return 'codicon-clock';
    case 'paused': return 'codicon-debug-pause';
    case 'error': return 'codicon-error';
  }
}