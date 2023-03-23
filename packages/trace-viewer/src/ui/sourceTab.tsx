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

import type { ActionTraceEvent } from '@trace/trace';
import { SplitView } from '@web/components/splitView';
import * as React from 'react';
import { useAsyncMemo } from '@web/uiUtils';
import './sourceTab.css';
import { StackTraceView } from './stackTrace';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import type { SourceHighlight } from '@web/components/codeMirrorWrapper';
import type { SourceModel } from './modelUtil';
import type { StackFrame } from '@protocol/channels';

export const SourceTab: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
  sources: Map<string, SourceModel>,
  hideStackFrames?: boolean,
  rootDir?: string,
  fallbackLocation?: StackFrame,
}> = ({ action, sources, hideStackFrames, rootDir, fallbackLocation }) => {
  const [lastAction, setLastAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedFrame, setSelectedFrame] = React.useState<number>(0);

  React.useEffect(() => {
    if (lastAction !== action) {
      setLastAction(action);
      setSelectedFrame(0);
    }
  }, [action, lastAction, setLastAction, setSelectedFrame]);

  const { source, highlight, targetLine, fileName } = useAsyncMemo<{ source: SourceModel, targetLine?: number, fileName?: string, highlight: SourceHighlight[] }>(async () => {
    const location = action?.stack?.[selectedFrame] || fallbackLocation;
    if (!location?.file)
      return { source: { errors: [], content: undefined }, targetLine: 0, highlight: [] };

    let source = sources.get(location.file);
    // Fallback location can fall outside the sources model.
    if (!source) {
      source = { errors: [], content: undefined };
      sources.set(location.file, source);
    }

    const targetLine = location.line || 0;
    const fileName = rootDir && location.file.startsWith(rootDir) ? location.file.substring(rootDir.length + 1) : location.file;
    const highlight: SourceHighlight[] = source.errors.map(e => ({ type: 'error', line: e.location.line, message: e.error!.message }));
    highlight.push({ line: targetLine, type: 'running' });

    if (source.content === undefined || fallbackLocation) {
      const sha1 = await calculateSha1(location.file);
      try {
        let response = await fetch(`sha1/src@${sha1}.txt`);
        if (response.status === 404)
          response = await fetch(`file?path=${location.file}`);
        source.content = await response.text();
      } catch {
        source.content = `<Unable to read "${location.file}">`;
      }
    }
    return { source, highlight, targetLine, fileName };
  }, [action, selectedFrame, rootDir, fallbackLocation], { source: { errors: [], content: 'Loading\u2026' }, highlight: [] });

  return <SplitView sidebarSize={200} orientation='horizontal' sidebarHidden={hideStackFrames}>
    <div className='vbox' data-testid='source-code'>
      {fileName && <div className='source-tab-file-name'>{fileName}</div>}
      <CodeMirrorWrapper text={source.content || ''} language='javascript' highlight={highlight} revealLine={targetLine} readOnly={true} lineNumbers={true} />
    </div>
    <StackTraceView action={action} selectedFrame={selectedFrame} setSelectedFrame={setSelectedFrame} />
  </SplitView>;
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
