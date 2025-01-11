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

  return <div className='vbox' style={{ backgroundColor: 'var(--vscode-sideBar-background)' }}>
    <div style={{ margin: '10px 0px 10px 10px', color: 'var(--vscode-editorCodeLens-foreground)', flex: 'none' }}>Locator</div>
    <div style={{ margin: '0 10px 10px', flex: 'auto' }}>
      <CodeMirrorWrapper text={highlightedElement.locator || ''} language={sdkLanguage} isFocused={true} wrapLines={true} onChange={text => {
        // Updating text needs to go first - react can squeeze a render between the state updates.
        setHighlightedElement({ ...highlightedElement, locator: text, lastEdited: 'locator' });
        setIsInspecting(false);
      }} />
    </div>
    <div style={{ margin: '10px 0px 10px 10px', color: 'var(--vscode-editorCodeLens-foreground)', flex: 'none' }}>Aria</div>
    <div style={{ margin: '0 10px 10px', flex: 'auto' }}>
      <CodeMirrorWrapper
        text={highlightedElement.ariaSnapshot || ''}
        wrapLines={false}
        highlight={ariaSnapshotErrors}
        onChange={onAriaEditorChange} />
    </div>
    <div style={{ position: 'absolute', right: 5, top: 5 }}>
      <ToolbarButton icon='files' title='Copy locator' onClick={() => {
        copy(highlightedElement.locator || '');
      }}></ToolbarButton>
    </div>
  </div>;
};
