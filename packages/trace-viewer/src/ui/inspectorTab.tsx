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

import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import type { Language, SourceHighlight } from '@web/components/codeMirrorWrapper';
import { ToolbarButton } from '@web/components/toolbarButton';
import { copy } from '@web/uiUtils';
import * as React from 'react';
import type { HighlightedElement } from './snapshotTab';
import './sourceTab.css';
import { parseAriaSnapshot } from '@isomorphic/ariaSnapshot';
import yaml from 'yaml';

export const InspectorTab: React.FunctionComponent<{
  sdkLanguage: Language,
  setIsInspecting: (isInspecting: boolean) => void,
  highlightedElement: HighlightedElement,
  setHighlightedElement: (element: HighlightedElement) => void,
}> = ({ sdkLanguage, setIsInspecting, highlightedElement, setHighlightedElement }) => {
  const [ariaSnapshotErrors, setAriaSnapshotErrors] = React.useState<SourceHighlight[]>();
  const onAriaEditorChange = React.useCallback((ariaSnapshot: string) => {
    const { errors } = parseAriaSnapshot(yaml, ariaSnapshot, { prettyErrors: false });
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
    setHighlightedElement({ ...highlightedElement, ariaSnapshot, lastEdited: 'ariaSnapshot' });
    setIsInspecting(false);
  }, [highlightedElement, setHighlightedElement, setIsInspecting]);

  return <div style={{ flex: 'auto', backgroundColor: 'var(--vscode-sideBar-background)', padding: '0 10px 10px 10px', overflow: 'auto' }}>
    <div className='hbox' style={{ lineHeight: '28px', color: 'var(--vscode-editorCodeLens-foreground)' }}>
      <div style={{ flex: 'auto'  }}>Locator</div>
      <ToolbarButton icon='files' title='Copy locator' onClick={() => {
        copy(highlightedElement.locator || '');
      }}></ToolbarButton>
    </div>
    <div style={{ height: 50 }}>
      <CodeMirrorWrapper text={highlightedElement.locator || ''} language={sdkLanguage} isFocused={true} wrapLines={true} onChange={text => {
        // Updating text needs to go first - react can squeeze a render between the state updates.
        setHighlightedElement({ ...highlightedElement, locator: text, lastEdited: 'locator' });
        setIsInspecting(false);
      }} />
    </div>

    <div className='hbox' style={{ lineHeight: '28px', color: 'var(--vscode-editorCodeLens-foreground)' }}>
      <div style={{ flex: 'auto'  }}>Aria snapshot</div>
      <ToolbarButton icon='files' title='Copy snapshot' onClick={() => {
        copy(highlightedElement.ariaSnapshot || '');
      }}></ToolbarButton>
    </div>
    <div style={{ height: 150 }}>
      <CodeMirrorWrapper
        text={highlightedElement.ariaSnapshot || ''}
        language='yaml'
        wrapLines={false}
        highlight={ariaSnapshotErrors}
        onChange={onAriaEditorChange} />
    </div>
  </div>;
};
