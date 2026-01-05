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
import { kThemeOptions, type Theme, useThemeSetting } from '@web/theme';
import { copy, useSetting } from '@web/uiUtils';
import yaml from 'yaml';
import { parseAriaSnapshot } from '@isomorphic/ariaSnapshot';
import { Dialog } from '@web/shared/dialog';

import type { RecorderBackend, RecorderFrontend } from './recorderTypes';

export const Recorder: React.FC = ({}) => {
  const [sources, setSources] = React.useState<Source[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [log, setLog] = React.useState(new Map<string, CallLog>());
  const [mode, setMode] = React.useState<Mode>('none');
  const [selectedFileId, setSelectedFileId] = React.useState<string | undefined>();
  const [selectedTab, setSelectedTab] = useSetting<string>('recorderPropertiesTab', 'log');
  const [ariaSnapshot, setAriaSnapshot] = React.useState<string | undefined>();
  const [ariaSnapshotErrors, setAriaSnapshotErrors] = React.useState<SourceHighlight[]>();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [theme, setTheme] = useThemeSetting();
  const [autoExpect, setAutoExpect] = useSetting<boolean>('autoExpect', false);
  const settingsButtonRef = React.useRef<HTMLButtonElement>(null);
  const backend = React.useMemo(createRecorderBackend, []);
  const [locator, setLocator] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const source = React.useMemo(() => {
    const source = sources.find(s => s.id === selectedFileId);
    return source ?? emptySource();
  }, [sources, selectedFileId]);

  React.useLayoutEffect(() => {
    const dispatcher: RecorderFrontend = {
      modeChanged: ({ mode }) => setMode(mode),
      sourcesUpdated: ({ sources }) => {
        setSources(sources);
        window.playwrightSourcesEchoForTest = sources;
      },
      pageNavigated: ({ url }) => {
        document.title = url
          ? `Playwright Inspector - ${url}`
          : `Playwright Inspector`;
      },
      pauseStateChanged: ({ paused }) => setPaused(paused),
      callLogsUpdated: ({ callLogs }) => {
        setLog(log => {
          const newLog = new Map<string, CallLog>(log);
          for (const callLog of callLogs) {
            callLog.reveal = !log.has(callLog.id);
            newLog.set(callLog.id, callLog);
          }
          return newLog;
        });
      },
      sourceRevealRequested: ({ sourceId }) => setSelectedFileId(sourceId),
      elementPicked: ({ elementInfo, userGesture }) => {
        const language = source.language;
        setLocator(asLocator(language, elementInfo.selector));
        setAriaSnapshot(elementInfo.ariaSnapshot);
        setAriaSnapshotErrors([]);
        if (userGesture && selectedTab !== 'locator' && selectedTab !== 'aria')
          setSelectedTab('locator');

        if (mode === 'inspecting' && selectedTab === 'aria') {
          // Keep exploring aria.
        } else {
          backend.setMode({ mode: mode === 'inspecting' ? 'standby' : 'recording' }).catch(() => { });
        }
      },
    };
    window.dispatch = (data: { method: string; params?: any }) => {
      (dispatcher as any)[data.method].call(dispatcher, data.params);
    };
  }, [backend, mode, selectedTab, setSelectedTab, source]);

  React.useEffect(() => {
    backend.setAutoExpect({ autoExpect });
  }, [autoExpect, backend]);

  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef]);

  React.useLayoutEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'F8':
          event.preventDefault();
          if (paused)
            backend.resume();
          else
            backend.pause();
          break;
        case 'F10':
          event.preventDefault();
          if (paused)
            backend.step();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [paused, backend]);

  const onEditorChange = React.useCallback((selector: string) => {
    if (mode === 'none' || mode === 'inspecting')
      backend.setMode({ mode: 'standby' });
    setLocator(selector);
    backend.highlightRequested({ selector });
  }, [mode, backend]);

  const onAriaEditorChange = React.useCallback((ariaSnapshot: string) => {
    if (mode === 'none' || mode === 'inspecting')
      backend.setMode({ mode: 'standby' });
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
      backend.highlightRequested({ ariaTemplate: fragment });
  }, [mode, backend]);

  const isRecording = mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility';

  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon={isRecording ? 'stop-circle' : 'circle-large-filled'} title={isRecording ? 'Stop Recording' : 'Start Recording'} toggled={isRecording} onClick={() => {
        backend.setMode({ mode: mode === 'none' || mode === 'standby' || mode === 'inspecting' ? 'recording' : 'standby' });
      }}>Record</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='inspect' title='Pick locator' toggled={mode === 'inspecting' || mode === 'recording-inspecting'} onClick={() => {
        const newMode: Mode = {
          'inspecting': 'standby',
          'none': 'inspecting',
          'standby': 'inspecting',
          'recording': 'recording-inspecting',
          'recording-inspecting': 'recording',
          'assertingText': 'recording-inspecting',
          'assertingVisibility': 'recording-inspecting',
          'assertingValue': 'recording-inspecting',
          'assertingSnapshot': 'recording-inspecting',
        }[mode] as Mode;
        backend.setMode({ mode: newMode }).catch(() => { });
      }}></ToolbarButton>
      <ToolbarButton icon='eye' title='Assert visibility' toggled={mode === 'assertingVisibility'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        backend.setMode({ mode: mode === 'assertingVisibility' ? 'recording' : 'assertingVisibility' });
      }}></ToolbarButton>
      <ToolbarButton icon='whole-word' title='Assert text' toggled={mode === 'assertingText'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        backend.setMode({ mode: mode === 'assertingText' ? 'recording' : 'assertingText' });
      }}></ToolbarButton>
      <ToolbarButton icon='symbol-constant' title='Assert value' toggled={mode === 'assertingValue'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        backend.setMode({ mode: mode === 'assertingValue' ? 'recording' : 'assertingValue' });
      }}></ToolbarButton>
      <ToolbarButton icon='gist' title='Assert snapshot' toggled={mode === 'assertingSnapshot'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        backend.setMode({ mode: mode === 'assertingSnapshot' ? 'recording' : 'assertingSnapshot' });
      }}></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume (F8)' ariaLabel='Resume' disabled={!paused} onClick={() => {
        backend.resume();
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause (F8)' ariaLabel='Pause' disabled={paused} onClick={() => {
        backend.pause();
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over (F10)' ariaLabel='Step over' disabled={!paused} onClick={() => {
        backend.step();
      }}></ToolbarButton>
      <div style={{ flex: 'auto' }}></div>
      <div>Target:</div>
      <SourceChooser fileId={source.id} sources={sources} setFileId={fileId => {
        setSelectedFileId(fileId);
        backend.fileChanged({ fileId });
      }} />
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
        backend.clear();
      }}></ToolbarButton>
      <ToolbarButton
        ref={settingsButtonRef}
        icon='settings-gear'
        title='Settings'
        onClick={() => setSettingsOpen(current => !current)}
      />
      <Dialog
        style={{ padding: '4px 8px' }}
        open={settingsOpen}
        verticalOffset={8}
        requestClose={() => setSettingsOpen(false)}
        anchor={settingsButtonRef}
        dataTestId='settings-dialog'
      >
        <div key='dark-mode-setting' className='setting setting-theme'>
          <label htmlFor='dark-mode-setting'>Theme:</label>
          <select id='dark-mode-setting' value={theme} onChange={e => setTheme(e.target.value as Theme)}>
            {kThemeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div key='auto-expect-setting' className='setting' title='Automatically generate assertions while recording'>
          <input type='checkbox' id='auto-expect-setting' checked={autoExpect} onChange={() => {
            backend.setAutoExpect({ autoExpect: !autoExpect });
            setAutoExpect(!autoExpect);
          }} />
          <label htmlFor='auto-expect-setting'>Generate assertions</label>
        </div>
      </Dialog>
    </Toolbar>
    <SplitView
      sidebarSize={200}
      main={<CodeMirrorWrapper text={source.text} highlighter={source.language} highlight={source.highlight} revealLine={source.revealLine} readOnly={true} lineNumbers={true} />}
      sidebar={<TabbedPane
        rightToolbar={selectedTab === 'locator' || selectedTab === 'aria' ? [<ToolbarButton key={1} icon='files' title='Copy' onClick={() => copy((selectedTab === 'locator' ? locator : ariaSnapshot) || '')} />] : []}
        tabs={[
          {
            id: 'locator',
            title: 'Locator',
            render: () => <CodeMirrorWrapper text={locator} placeholder='Type locator to inspect' highlighter={source.language} focusOnChange={true} onChange={onEditorChange} wrapLines={true} />
          },
          {
            id: 'log',
            title: 'Log',
            render: () => <CallLogView language={source.language} log={Array.from(log.values())} />
          },
          {
            id: 'aria',
            title: 'Aria',
            render: () => <CodeMirrorWrapper text={ariaSnapshot || ''} placeholder='Type aria template to match' highlighter={'yaml'} onChange={onAriaEditorChange} highlight={ariaSnapshotErrors} wrapLines={true} />
          },
        ]}
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
      />}
    />
  </div>;
};

function createRecorderBackend(): RecorderBackend {
  return new Proxy({} as RecorderBackend, {
    get: (_target, prop: string | symbol) => {
      if (typeof prop !== 'string')
        return undefined;
      return (params?: any) => {
        return window.sendCommand({ method: prop, params });
      };
    },
  });
}
