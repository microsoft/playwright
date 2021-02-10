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
import type { Mode, PauseDetails, Source } from '../../server/supplements/recorder/recorderTypes';

declare global {
  interface Window {
    playwrightSetMode: (mode: Mode) => void;
    playwrightSetPaused: (details: PauseDetails | null) => void;
    playwrightSetSource: (source: Source) => void;
    dispatch(data: any): Promise<void>;
    playwrightSourceEchoForTest?: (text: string) => Promise<void>;
  }
}

export interface RecorderProps {
}

export const Recorder: React.FC<RecorderProps> = ({
}) => {
  const [source, setSource] = React.useState<Source>({ language: 'javascript', text: '' });
  const [paused, setPaused] = React.useState<PauseDetails | null>(null);
  const [mode, setMode] = React.useState<Mode>('none');

  window.playwrightSetMode = setMode;
  window.playwrightSetSource = setSource;
  window.playwrightSetPaused = setPaused;
  if (window.playwrightSourceEchoForTest)
    window.playwrightSourceEchoForTest(source.text).catch(e => {});

  return <div className="recorder">
    <Toolbar>
      <ToolbarButton icon="record" title="Record" toggled={mode == 'recording'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'recording' ? 'none' : 'recording' }}).catch(() => { });
      }}></ToolbarButton>
      <ToolbarButton icon="question" title="Inspect" toggled={mode == 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'inspecting' ? 'none' : 'inspecting' }}).catch(() => { });
      }}></ToolbarButton>
      <ToolbarButton icon="files" title="Copy" disabled={!source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon="debug-continue" title="Resume" disabled={!paused} onClick={() => {
        window.dispatch({ event: 'resume' }).catch(() => {});
      }}></ToolbarButton>
      <ToolbarButton icon="debug-pause" title="Pause" disabled={!!paused} onClick={() => {
        window.dispatch({ event: 'pause' }).catch(() => {});
      }}></ToolbarButton>
      <ToolbarButton icon="debug-step-over" title="Step over" disabled={!paused} onClick={() => {
        window.dispatch({ event: 'step' }).catch(() => {});
      }}></ToolbarButton>
      <div style={{flex: "auto"}}></div>
      <ToolbarButton icon="clear-all" title="Clear" disabled={!source.text} onClick={() => {
        window.dispatch({ event: 'clear' }).catch(() => {});
      }}></ToolbarButton>
    </Toolbar>
    <SourceView text={source.text} language={source.language} highlightedLine={source.highlightedLine} paused={!!paused}></SourceView>
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
