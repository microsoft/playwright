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

import type { CallLog, Mode, Source } from './recorderTypes';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import { SplitView } from '@web/components/splitView';
import { TabbedPane } from '@web/components/tabbedPane';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import * as React from 'react';
import { CallLogView } from './callLog';
import './recorder.css';
import { asLocator } from '@isomorphic/locatorGenerators';
import { toggleTheme } from '@web/theme';
import { copy } from '@web/uiUtils';

declare global {
  interface Window {
    playwrightSetFileIfNeeded: (file: string) => void;
    playwrightSetSelector: (selector: string, focus?: boolean) => void;
    dispatch(data: any): Promise<void>;
  }
}

export interface RecorderProps {
  sources: Source[],
  paused: boolean,
  log: Map<string, CallLog>,
  mode: Mode,
}

export const Recorder: React.FC<RecorderProps> = ({
  sources,
  paused,
  log,
  mode,
}) => {
  const [fileId, setFileId] = React.useState<string | undefined>();
  const [selectedTab, setSelectedTab] = React.useState<string>('log');

  React.useEffect(() => {
    if (!fileId && sources.length > 0)
      setFileId(sources[0].id);
  }, [fileId, sources]);

  const source: Source = sources.find(s => s.id === fileId) || {
    id: 'default',
    isRecorded: false,
    text: '',
    language: 'javascript',
    label: '',
    highlight: []
  };

  const [locator, setLocator] = React.useState('');
  window.playwrightSetSelector = (selector: string, focus?: boolean) => {
    const language = source.language;
    if (focus)
      setSelectedTab('locator');
    setLocator(asLocator(language, selector));
  };

  window.playwrightSetFileIfNeeded = (value: string) => {
    const newSource = sources.find(s => s.id === value);
    // Do not forcefully switch between two recorded sources, because
    // user did explicitly choose one.
    if (newSource && !newSource.isRecorded || !source.isRecorded)
      setFileId(value);
  };

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef]);


  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'F8':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'resume' });
          else
            window.dispatch({ event: 'pause' });
          break;
        case 'F10':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'step' });
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [paused]);

  const onEditorChange = React.useCallback((selector: string) => {
    if (mode === 'none')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    setLocator(selector);
    window.dispatch({ event: 'selectorUpdated', params: { selector } });
  }, [mode]);

  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon='circle-large-filled' title='Record' toggled={mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'none' || mode === 'standby' || mode === 'inspecting' ? 'recording' : 'standby' } });
      }}>Record</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='inspect' title='Pick locator' toggled={mode === 'inspecting' || mode === 'recording-inspecting'} onClick={() => {
        const newMode = {
          'inspecting': 'standby',
          'none': 'inspecting',
          'standby': 'inspecting',
          'recording': 'recording-inspecting',
          'recording-inspecting': 'recording',
          'assertingText': 'recording-inspecting',
          'assertingVisibility': 'recording-inspecting',
          'assertingValue': 'recording-inspecting',
        }[mode];
        window.dispatch({ event: 'setMode', params: { mode: newMode } }).catch(() => { });
      }}></ToolbarButton>
      <ToolbarButton icon='eye' title='Assert visibility' toggled={mode === 'assertingVisibility'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingVisibility' ? 'recording' : 'assertingVisibility' } });
      }}></ToolbarButton>
      <ToolbarButton icon='whole-word' title='Assert text' toggled={mode === 'assertingText'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingText' ? 'recording' : 'assertingText' } });
      }}></ToolbarButton>
      <ToolbarButton icon='symbol-constant' title='Assert value' toggled={mode === 'assertingValue'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingValue' ? 'recording' : 'assertingValue' } });
      }}></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume (F8)' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'resume' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause (F8)' disabled={paused} onClick={() => {
        window.dispatch({ event: 'pause' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over (F10)' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'step' });
      }}></ToolbarButton>
      <div style={{ flex: 'auto' }}></div>
      <div>Target:</div>
      <select className='recorder-chooser' hidden={!sources.length} value={fileId} onChange={event => {
        setFileId(event.target.selectedOptions[0].value);
        window.dispatch({ event: 'fileChanged', params: { file: event.target.selectedOptions[0].value } });
      }}>{renderSourceOptions(sources)}</select>
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
        window.dispatch({ event: 'clear' });
      }}></ToolbarButton>
      <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
    </Toolbar>
    <SplitView
      sidebarSize={200}
      main={<CodeMirrorWrapper text={source.text} language={source.language} highlight={source.highlight} revealLine={source.revealLine} readOnly={true} lineNumbers={true} />}
      sidebar={<TabbedPane
        rightToolbar={selectedTab === 'locator' ? [<ToolbarButton key={1} icon='files' title='Copy' onClick={() => copy(locator)} />] : []}
        tabs={[
          {
            id: 'locator',
            title: 'Locator',
            render: () => <CodeMirrorWrapper text={locator} language={source.language} readOnly={false} focusOnChange={true} onChange={onEditorChange} wrapLines={true} />
          },
          {
            id: 'log',
            title: 'Log',
            render: () => <CallLogView language={source.language} log={Array.from(log.values())} />
          },
        ]}
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
      />}
    />
  </div>;
};

function renderSourceOptions(sources: Source[]): React.ReactNode {
  const transformTitle = (title: string): string => title.replace(/.*[/\\]([^/\\]+)/, '$1');
  const renderOption = (source: Source): React.ReactNode => (
    <option key={source.id} value={source.id}>{transformTitle(source.label)}</option>
  );

  const hasGroup = sources.some(s => s.group);
  if (hasGroup) {
    const groups = new Set(sources.map(s => s.group));
    return [...groups].filter(Boolean).map(group => (
      <optgroup label={group} key={group}>
        {sources.filter(s => s.group === group).map(source => renderOption(source))}
      </optgroup>
    ));
  }

  return sources.map(source => renderOption(source));
}
