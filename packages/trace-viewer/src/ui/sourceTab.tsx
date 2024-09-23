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

import { SplitView } from '@web/components/splitView';
import * as React from 'react';
import { useAsyncMemo } from '@web/uiUtils';
import './sourceTab.css';
import { StackTraceView } from './stackTrace';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import type { SourceHighlight } from '@web/components/codeMirrorWrapper';
import type { SourceLocation, SourceModel } from './modelUtil';
import type { StackFrame } from '@protocol/channels';
import { CopyToClipboard } from './copyToClipboard';
import { ToolbarButton } from '@web/components/toolbarButton';
import { Toolbar } from '@web/components/toolbar';

export const SourceTab: React.FunctionComponent<{
  stack: StackFrame[] | undefined,
  stackFrameLocation: 'bottom' | 'right',
  sources: Map<string, SourceModel>,
  rootDir?: string,
  fallbackLocation?: SourceLocation,
  onOpenExternally?: (location: SourceLocation) => void,
}> = ({ stack, sources, rootDir, fallbackLocation, stackFrameLocation, onOpenExternally }) => {
  const [lastStack, setLastStack] = React.useState<StackFrame[] | undefined>();
  const [selectedFrame, setSelectedFrame] = React.useState<number>(0);

  React.useEffect(() => {
    if (lastStack !== stack) {
      setLastStack(stack);
      setSelectedFrame(0);
    }
  }, [stack, lastStack, setLastStack, setSelectedFrame]);

  const { source, highlight, targetLine, fileName, location } = useAsyncMemo<{ source: SourceModel, targetLine?: number, fileName?: string, highlight: SourceHighlight[], location?: SourceLocation }>(async () => {
    const actionLocation = stack?.[selectedFrame];
    const shouldUseFallback = !actionLocation?.file;
    if (shouldUseFallback && !fallbackLocation)
      return { source: { file: '', errors: [], content: undefined }, targetLine: 0, highlight: [] };

    const file = shouldUseFallback ? fallbackLocation!.file : actionLocation.file;
    let source = sources.get(file);
    // Fallback location can fall outside the sources model.
    if (!source) {
      source = { errors: fallbackLocation?.source?.errors || [], content: fallbackLocation?.source?.content };
      sources.set(file, source);
    }

    const location = shouldUseFallback ? fallbackLocation! : actionLocation;
    const targetLine = shouldUseFallback ? fallbackLocation?.line || source.errors[0]?.line || 0 : actionLocation.line;
    const fileName = rootDir && file.startsWith(rootDir) ? file.substring(rootDir.length + 1) : file;
    const highlight: SourceHighlight[] = source.errors.map(e => ({ type: 'error', line: e.line, message: e.message }));
    highlight.push({ line: targetLine, type: 'running' });

    // After the source update, but before the test run, don't trust the cache.
    if (fallbackLocation?.source?.content !== undefined) {
      source.content = fallbackLocation.source.content;
    } else if (source.content === undefined || shouldUseFallback) {
      const sha1 = await calculateSha1(file);
      try {
        let response = await fetch(`sha1/src@${sha1}.txt`);
        if (response.status === 404)
          response = await fetch(`file?path=${encodeURIComponent(file)}`);
        if (response.status >= 400)
          source.content = `<Unable to read "${file}">`;
        else
          source.content = await response.text();
      } catch {
        source.content = `<Unable to read "${file}">`;
      }
    }
    return { source, highlight, targetLine, fileName, location };
  }, [stack, selectedFrame, rootDir, fallbackLocation], { source: { errors: [], content: 'Loading\u2026' }, highlight: [] });

  const openExternally = React.useCallback(() => {
    if (!location)
      return;
    if (onOpenExternally) {
      onOpenExternally(location);
    } else {
      // This should open an external protocol handler instead of actually navigating away.
      window.location.href = `vscode://file//${location.file}:${location.line}`;
    }
  }, [onOpenExternally, location]);

  const showStackFrames = (stack?.length ?? 0) > 1;
  const shortFileName = getFileName(fileName);

  return <SplitView
    sidebarSize={200}
    orientation={stackFrameLocation === 'bottom' ? 'vertical' : 'horizontal'}
    sidebarHidden={!showStackFrames}
    main={<div className='vbox' data-testid='source-code'>
      { fileName && <Toolbar>
        <div className='source-tab-file-name' title={fileName}>
          <div>{shortFileName}</div>
        </div>
        <CopyToClipboard description='Copy filename' value={shortFileName}/>
        {location && <ToolbarButton icon='link-external' title='Open in VS Code' onClick={openExternally}></ToolbarButton>}
      </Toolbar> }
      <CodeMirrorWrapper text={source.content || ''} language='javascript' highlight={highlight} revealLine={targetLine} readOnly={true} lineNumbers={true} />
    </div>}
    sidebar={<StackTraceView stack={stack} selectedFrame={selectedFrame} setSelectedFrame={setSelectedFrame} />}
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
