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

import type { CallLog, ElementInfo, Mode, Source } from './recorderTypes';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import type { SourceHighlight } from '@web/components/codeMirrorWrapper';
import { SplitView } from '@web/components/splitView';
import { TabbedPane } from '@web/components/tabbedPane';
import { Toolbar } from '@web/components/toolbar';
import { emptySource, SourceChooser } from '@web/components/sourceChooser';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import * as React from 'react';
import { CallLogView } from './callLog';
import './recorder.css';
import { asLocator } from '@isomorphic/locatorGenerators';
import { toggleTheme } from '@web/theme';
import { copy, useSetting } from '@web/uiUtils';
import yaml from 'yaml';
import { parseAriaSnapshot } from '@isomorphic/ariaSnapshot';

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
  const [selectedFileId, setSelectedFileId] = React.useState<string | undefined>();
  const [selectedTab, setSelectedTab] = useSetting<string>('recorderPropertiesTab', 'log');
  const [ariaSnapshot, setAriaSnapshot] = React.useState<string | undefined>();
  const [ariaSnapshotErrors, setAriaSnapshotErrors] = React.useState<SourceHighlight[]>();

  React.useEffect(() => {
    if (!sources.length)
      return;
    const selectedSource = sources.find(s => s.id === selectedFileId);
    const newestSource = sources.sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!selectedSource || newestSource.isRecorded !== selectedSource.isRecorded) {
      // Debugger kicked in, or recording resumed. Switch selection to the newest source.
      setSelectedFileId(newestSource.id);
    }
  }, [sources, selectedFileId]);

  const source = React.useMemo(() => {
    const source = sources.find(s => s.id === selectedFileId);
    if (source)
      return source;
    const primarySource = sources.find(s => s.isPrimary);
    if (primarySource)
      return primarySource;
    return emptySource();
  }, [sources, selectedFileId]);

  const [locator, setLocator] = React.useState('');
  window.playwrightElementPicked = (elementInfo: ElementInfo, userGesture?: boolean) => {
    const language = source.language;
    setLocator(asLocator(language, elementInfo.selector));
    setAriaSnapshot(elementInfo.ariaSnapshot);
    setAriaSnapshotErrors([]);
    if (userGesture && selectedTab !== 'locator' && selectedTab !== 'aria')
      setSelectedTab('locator');

    if (mode === 'inspecting' && selectedTab === 'aria') {
      // Keep exploring aria.
    } else {
      window.dispatch({ event: 'setMode', params: { mode: mode === 'inspecting' ? 'standby' : 'recording' } }).catch(() => { });
    }
  };

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef]);


  React.useLayoutEffect(() => {
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
    if (mode === 'none' || mode === 'inspecting')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    setLocator(selector);
    window.dispatch({ event: 'highlightRequested', params: { selector } });
  }, [mode]);

  const onAriaEditorChange = React.useCallback((ariaSnapshot: string) => {
    if (mode === 'none' || mode === 'inspecting')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    const { fragment, errors } = parseAriaSnapshot(yaml, ariaSnapshot, { prettyErrors: false });
    const highlights = errors.map(error => {
      const highlight: SourceHighlight = {
        message: error.message,
        line: error.range[1].line,
        column: error.range[1].col,
        type: 'subtle-error',
      };
      return highlight;
    });
    setAriaSnapshotErrors(highlights);
    setAriaSnapshot(ariaSnapshot);
    if (!errors.length)
      window.dispatch({ event: 'highlightRequested', params: { ariaTemplate: fragment } });
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
          'assertingSnapshot': 'recording-inspecting',
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
      <ToolbarButton icon='gist' title='Assert snapshot' toggled={mode === 'assertingSnapshot'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingSnapshot' ? 'recording' : 'assertingSnapshot' } });
      }}></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume (F8)' ariaLabel='Resume' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'resume' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause (F8)' ariaLabel='Pause' disabled={paused} onClick={() => {
        window.dispatch({ event: 'pause' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over (F10)' ariaLabel='Step over' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'step' });
      }}></ToolbarButton>
      <div style={{ flex: 'auto' }}></div>
      <div>Target:</div>
      <SourceChooser fileId={source.id} sources={sources} setFileId={fileId => {
        setSelectedFileId(fileId);
        window.dispatch({ event: 'fileChanged', params: { fileId } });
      }} />
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
        window.dispatch({ event: 'clear' });
      }}></ToolbarButton>
      <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
    </Toolbar>
    <SplitView
      sidebarSize={200}
      main={<CodeMirrorWrapper text={source.text} language={source.language} highlight={source.highlight} revealLine={source.revealLine} readOnly={true} lineNumbers={true} />}
      sidebar={<TabbedPane
        rightToolbar={selectedTab === 'locator' || selectedTab === 'aria' ? [<ToolbarButton key={1} icon='files' title='Copy' onClick={() => copy((selectedTab === 'locator' ? locator : ariaSnapshot) || '')} />] : []}
        tabs={[
          {
            id: 'locator',
            title: 'Locator',
            render: () => <CodeMirrorWrapper text={locator} placeholder='Type locator to inspect' language={source.language} focusOnChange={true} onChange={onEditorChange} wrapLines={true} />
          },
          {
            id: 'log',
            title: 'Log',
            render: () => <CallLogView language={source.language} log={Array.from(log.values())} />
          },
          {
            id: 'aria',
            title: 'Aria',
            render: () => <CodeMirrorWrapper text={ariaSnapshot || ''} placeholder='Type aria template to match' language={'yaml'} onChange={onAriaEditorChange} highlight={ariaSnapshotErrors} wrapLines={true} />
          },
        ]}
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
      />}
    />
  </div>;
};
