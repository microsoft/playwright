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
import { copy } from '@web/uiUtils';
import * as React from 'react';
import './sourceTab.css';

export const InspectorTab: React.FunctionComponent<{
  sdkLanguage: Language,
  setIsInspecting: (isInspecting: boolean) => void,
  highlightedLocator: string,
  setHighlightedLocator: (locator: string) => void,
}> = ({ sdkLanguage, setIsInspecting, highlightedLocator, setHighlightedLocator }) => {
  return <div className='vbox'>
    <CodeMirrorWrapper text={highlightedLocator} language={sdkLanguage} focusOnChange={true} wrapLines={true} onChange={text => {
      // Updating text needs to go first - react can squeeze a render between the state updates.
      setHighlightedLocator(text);
      setIsInspecting(false);
    }}></CodeMirrorWrapper>
    <div style={{ position: 'absolute', right: '0', top: '0' }}>
      <ToolbarButton icon='files' title='Copy locator' onClick={() => {
        copy(highlightedLocator);
      }}></ToolbarButton>
    </div>
  </div>;
};
