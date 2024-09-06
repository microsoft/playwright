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
import type { Language } from '@web/components/codeMirrorWrapper';
import { ToolbarButton } from '@web/components/toolbarButton';
import { copy, useSetting } from '@web/uiUtils';
import * as React from 'react';
import './sourceTab.css';

export const InspectorTab: React.FunctionComponent<{
  sdkLanguage: Language,
  setIsInspecting: (isInspecting: boolean) => void,
  highlightedLocator: string,
  setHighlightedLocator: (locator: string) => void,
}> = ({ sdkLanguage, setIsInspecting, highlightedLocator, setHighlightedLocator }) => {
  const [showScreenshot] = useSetting('screenshot-instead-of-snapshot', false);

  return <div className='vbox' style={{ backgroundColor: 'var(--vscode-sideBar-background)' }}>
    <div style={{ margin: '10px 0px 10px 10px', color: 'var(--vscode-editorCodeLens-foreground)', flex: 'none' }}>Locator</div>
    <div style={{ margin: '0 10px 10px', flex: 'auto' }}>
      <CodeMirrorWrapper text={showScreenshot ? '/* disable "show screenshot" setting to pick locator */' : highlightedLocator} language={sdkLanguage} focusOnChange={true} isFocused={true} wrapLines={true} onChange={text => {
        // Updating text needs to go first - react can squeeze a render between the state updates.
        setHighlightedLocator(text);
        setIsInspecting(false);
      }}></CodeMirrorWrapper>
    </div>
    <div style={{ position: 'absolute', right: 5, top: 5 }}>
      <ToolbarButton icon='files' title='Copy locator' onClick={() => {
        copy(highlightedLocator);
      }}></ToolbarButton>
    </div>
  </div>;
};
