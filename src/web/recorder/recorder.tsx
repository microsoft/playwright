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
    playwrightSetSelector: (selector: string, focus?: boolean) => void;
    dispatch(data: any): Promise<void>;
  }
}

export interface RecorderProps {
  sources: Source[],
  paused: boolean,
  log: Map<string, CallLog>,
  mode: Mode,
  initialSelector?: string,
}

export const Recorder: React.FC<RecorderProps> = ({
  sources,
  paused,
  log,
  mode,
  initialSelector,
}) => {
  const [selector, setSelector] = React.useState(initialSelector || '');
  const [focusSelectorInput, setFocusSelectorInput] = React.useState(false);
  window.playwrightSetSelector = (selector: string, focus?: boolean) => {
    setSelector(selector);
    setFocusSelectorInput(!!focus);
  };

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

  const selectorInputRef = React.createRef<HTMLInputElement>();
  React.useLayoutEffect(() => {
    if (focusSelectorInput && selectorInputRef.current) {
      selectorInputRef.current.select();
      selectorInputRef.current.focus();
      setFocusSelectorInput(false);
    }
  }, [focusSelectorInput, selectorInputRef]);

  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon='record' title='Record' toggled={mode == 'recording'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'recording' ? 'none' : 'recording' }});
      }}>Record</ToolbarButton>
      <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'resume' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause' disabled={paused} onClick={() => {
        window.dispatch({ event: 'pause' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'step' });
      }}></ToolbarButton>
      <div style={{flex: 'auto'}}></div>
      <div>Target:</div>
      <select className='recorder-chooser' hidden={!sources.length} value={file} onChange={event => {
          setFile(event.target.selectedOptions[0].value);
        }}>{
          sources.map(s => {
            const title = s.file.replace(/.*[/\\]([^/\\]+)/, '$1');
            return <option key={s.file} value={s.file}>{title}</option>;
          })
        }
      </select>
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
        window.dispatch({ event: 'clear' });
      }}></ToolbarButton>
    </Toolbar>
    <SplitView sidebarSize={200} sidebarHidden={mode === 'recording'}>
      <SourceView text={source.text} language={source.language} highlight={source.highlight} revealLine={source.revealLine}></SourceView>
      <div className='vbox'>
        <Toolbar>
          <ToolbarButton icon='microscope' title='Explore' toggled={mode == 'inspecting'} onClick={() => {
            window.dispatch({ event: 'setMode', params: { mode: mode === 'inspecting' ? 'none' : 'inspecting' }}).catch(() => { });
          }}>Explore</ToolbarButton>
          <input ref={selectorInputRef} className='selector-input' placeholder='Playwright Selector' value={selector} disabled={mode !== 'none'} onChange={event => {
            setSelector(event.target.value);
            window.dispatch({ event: 'selectorUpdated', params: { selector: event.target.value } });
          }} />
        </Toolbar>
        <CallLogView log={Array.from(log.values())}/>
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
