/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {SplitView} from '@web/components/splitView';
import * as React from 'react';
import {useAsyncMemo} from '@web/uiUtils';
import './sourceTab.css';
import {StackTraceView} from './stackTrace';
import type {SourceHighlight} from '@web/components/codeMirrorWrapper';
import {CodeMirrorWrapper} from '@web/components/codeMirrorWrapper';
import type {SourceLocation, SourceModel} from './modelUtil';
import type {StackFrame} from '@protocol/channels';
import {CopyToClipboard} from './copyToClipboard';
import {ToolbarButton} from '@web/components/toolbarButton';
import {Toolbar} from '@web/components/toolbar';
import {TraceModelContext} from './traceModelContext';

type IdeId = 'vscode' | 'cursor' | 'webstorm' | 'visualstudio' | 'notepadpp';

const BASE_IDE_OPTIONS = [
  { id: 'vscode', label: 'VS Code', platforms: ['win32', 'mac', 'linux'] },
  { id: 'cursor', label: 'Cursor', platforms: ['win32', 'mac', 'linux'] },
  { id: 'webstorm', label: 'WebStorm', platforms: ['win32', 'mac', 'linux'] },
  { id: 'visualstudio', label: 'Visual Studio', platforms: ['win32'] },
  { id: 'notepadpp', label: 'Notepad++', platforms: ['win32'] },
];

function detectPlatform(): 'win32' | 'mac' | 'linux' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win'))
    return 'win32';
  if (ua.includes('mac'))
    return 'mac';
  return 'linux';
}

async function getAvailableIDEs(): Promise<typeof BASE_IDE_OPTIONS> {
  const platform = detectPlatform();
  const candidates = BASE_IDE_OPTIONS.filter(opt => opt.platforms.includes(platform));
  const verified: typeof BASE_IDE_OPTIONS = [];
  for (const opt of candidates) {
    try {
      const res = await fetch(`trace/open-in-ide?ide=${opt.id}&check=1`);
      if (res.ok)
        verified.push(opt);
    } catch {
      // ignore missing backend support
    }
  }
  return verified.length ? verified : candidates;
}

const LS_IDE_KEY = 'pw.ui.ide.selection';

function loadIde(): IdeId {
  const saved = window.localStorage.getItem(LS_IDE_KEY) as IdeId | null;
  return saved && BASE_IDE_OPTIONS.some(o => o.id === saved) ? saved : 'vscode';
}

function saveIde(id: IdeId) {
  window.localStorage.setItem(LS_IDE_KEY, id);
}

function useSources(stack: StackFrame[] | undefined, selectedFrame: number, sources: Map<string, SourceModel>, rootDir?: string, fallbackLocation?: SourceLocation) {
  const model = React.useContext(TraceModelContext);
  return useAsyncMemo<{ source: SourceModel, targetLine?: number, fileName?: string, highlight: SourceHighlight[], location?: SourceLocation }>(async () => {
    const actionLocation = stack?.[selectedFrame];
    const location = actionLocation?.file ? actionLocation : fallbackLocation;
    if (!location)
      return { source: { file: '', errors: [], content: undefined }, targetLine: 0, highlight: [] };

    const file = location.file;
    let source = sources.get(file);
    if (!source) {
      source = { errors: fallbackLocation?.source?.errors || [], content: fallbackLocation?.source?.content };
      sources.set(file, source);
    }

    const targetLine = location?.line || source.errors[0]?.line || 0;
    const fileName = rootDir && file.startsWith(rootDir) ? file.substring(rootDir.length + 1) : file;
    const highlight: SourceHighlight[] = source.errors.map(e => ({ type: 'error', line: e.line, message: e.message }));
    highlight.push({ line: targetLine, type: 'running' });

    if (fallbackLocation?.source?.content !== undefined) {
      source.content = fallbackLocation.source.content;
    } else if (source.content === undefined || (location === fallbackLocation)) {
      const sha1 = await calculateSha1(file);
      try {
        let response = model ? await fetch(model.createRelativeUrl(`sha1/src@${sha1}.txt`)) : undefined;
        if (!response || response.status === 404)
          response = await fetch(`file?path=${encodeURIComponent(file)}`);
        if (response.status >= 400)
          source.content = `<Unable to read "${file}">`;
        else
          source.content = await response.text();
      } catch {
        source.content = `<Unable to read "${file}">`;
      }
    }
    return { model, source, highlight, targetLine, fileName, location };
  }, [stack, selectedFrame, rootDir, fallbackLocation], { source: { errors: [], content: 'Loading\u2026' }, highlight: [] });
}

export const SourceTab: React.FunctionComponent<{
  stack?: StackFrame[],
  stackFrameLocation: 'bottom' | 'right',
  sources: Map<string, SourceModel>,
  rootDir?: string,
  fallbackLocation?: SourceLocation,
  onOpenExternally?: (location: SourceLocation) => void,
}> = ({ stack, sources, rootDir, fallbackLocation, stackFrameLocation, onOpenExternally }) => {
  const [lastStack, setLastStack] = React.useState<StackFrame[] | undefined>();
  const [selectedFrame, setSelectedFrame] = React.useState<number>(0);
  const [selectedIde, setSelectedIde] = React.useState<IdeId>(() => loadIde());
  const [availableIDEs, setAvailableIDEs] = React.useState<typeof BASE_IDE_OPTIONS>([]);

  React.useEffect(() => { getAvailableIDEs().then(setAvailableIDEs); }, []);

  React.useEffect(() => {
    if (lastStack !== stack) {
      setLastStack(stack);
      setSelectedFrame(0);
    }
  }, [stack, lastStack, setLastStack, setSelectedFrame]);

  const { source, highlight, targetLine, fileName, location } = useSources(stack, selectedFrame, sources, rootDir, fallbackLocation);

  const openExternally = React.useCallback(async () => {
    if (!location)
      return;
    const { file, line } = location;
    if (selectedIde === 'vscode' || selectedIde === 'cursor') {
      const proto = selectedIde === 'cursor' ? 'cursor' : 'vscode';
      window.location.href = `${proto}://file//${file}:${line ?? 0}`;
      return;
    }
    await fetch(`trace/open-in-ide?ide=${selectedIde}&file=${encodeURIComponent(file)}&line=${line ?? 0}`);
  }, [location, selectedIde]);

  const showStackFrames = (stack?.length ?? 0) > 1;
  const shortFileName = getFileName(fileName);

  return <SplitView
    sidebarSize={200}
    orientation={stackFrameLocation === 'bottom' ? 'vertical' : 'horizontal'}
    sidebarHidden={!showStackFrames}
    main={<div className='vbox' data-testid='source-code'>
      {fileName && <Toolbar>
        <select
          className='ide-dropdown'
          value={selectedIde}
          onChange={e => { const id = e.target.value as IdeId; setSelectedIde(id); saveIde(id); }}
          title='Choose IDE to open file'
          data-testid='ide-selector'>
          {availableIDEs.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
        <div className='source-tab-file-name' title={fileName}>
          <div>{shortFileName}</div>
        </div>
        <CopyToClipboard description='Copy filename' value={shortFileName}/>
        {location && <ToolbarButton icon='link-external' title={`Open in ${availableIDEs.find(i => i.id === selectedIde)?.label ?? ''}`} onClick={openExternally}></ToolbarButton>}
      </Toolbar>}
      <CodeMirrorWrapper text={source.content || ''} highlighter='javascript' highlight={highlight} revealLine={targetLine} readOnly={true} lineNumbers={true} dataTestId='source-code-mirror'/>
    </div>}
    sidebar={<StackTraceView stack={stack} selectedFrame={selectedFrame} setSelectedFrame={setSelectedFrame}/>}
  />;
};

export async function calculateSha1(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-1', buffer);
  const hexCodes = [];
  const view = new DataView(hash);
  for (let i = 0; i < view.byteLength; i += 1) {
    const byte = view.getUint8(i).toString(16).padStart(2, '0');
    hexCodes.push(byte);
  }
  return hexCodes.join('');
}

function getFileName(fullPath?: string): string {
  if (!fullPath)
    return '';
  const pathSep = fullPath?.includes('/') ? '/' : '\\';
  return fullPath?.split(pathSep).pop() ?? '';
}
