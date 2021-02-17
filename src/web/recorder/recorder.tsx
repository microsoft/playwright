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
import { CallLogView } from './callLog';

declare global {
  interface Window {
    playwrightSetFile: (file: string) => void;
  }
}

export interface RecorderProps {
  sources: Source[],
  paused: boolean,
  log: Map<number, CallLog>,
  mode: Mode
}

export const Recorder: React.FC<RecorderProps> = ({
  sources,
  paused,
  log,
  mode
}) => {
  const [f, setFile] = React.useState<string | undefined>();
  window.playwrightSetFile = setFile;
  const file = f || sources[0]?.file;

  const source = sources.find(s => s.file === file) || {
    text: '',
    language: 'javascript',
    file: '',
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
      }}>Record</ToolbarButton>
      <ToolbarButton icon='question' title='Explore' toggled={mode == 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'inspecting' ? 'none' : 'inspecting' }}).catch(() => { });
      }}>Explore</ToolbarButton>
      <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'resume' }).catch(() => {});
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause' disabled={paused} onClick={() => {
        window.dispatch({ event: 'pause' }).catch(() => {});
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'step' }).catch(() => {});
      }}></ToolbarButton>
      <select className='recorder-chooser' hidden={!sources.length} value={file} onChange={event => {
          setFile(event.target.selectedOptions[0].value);
        }}>{
          sources.map(s => {
            const title = s.file.replace(/.*[/\\]([^/\\]+)/, '$1');
            return <option key={s.file} value={s.file}>{title}</option>;
          })
        }
      </select>
      <div style={{flex: 'auto'}}></div>
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
        window.dispatch({ event: 'clear' }).catch(() => {});
      }}></ToolbarButton>
    </Toolbar>
    <SplitView sidebarSize={200}>
      <SourceView text={source.text} language={source.language} highlight={source.highlight} revealLine={source.revealLine}></SourceView>
      <CallLogView log={[...log.values()]}/>
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
