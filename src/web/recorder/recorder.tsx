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

import './recorder.css';
import * as React from 'react';
import { Toolbar } from '../components/toolbar';
import { ToolbarButton } from '../components/toolbarButton';
import { Source } from '../components/source';

declare global {
  interface Window {
    playwrightClear(): Promise<void>
    playwrightSetSource: (params: { text: string, language: string }) => void
  }
}

export interface RecorderProps {
}

export const Recorder: React.FC<RecorderProps> = ({
}) => {
  const [source, setSource] = React.useState({ language: 'javascript', text: '' });
  window.playwrightSetSource = setSource;

  return <div className="recorder">
    <Toolbar>
      <ToolbarButton icon="clone" title="Copy" onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon="trashcan" title="Clear" onClick={() => {
        window.playwrightClear().catch(e => console.error(e));
      }}></ToolbarButton>
      <div style={{flex: "auto"}}></div>
    </Toolbar>
    <Source text={source.text} language={source.language}></Source>
  </div>;
};

function copy(text: string) {
  const textArea = document.createElement('textarea');
  textArea.style.position = 'absolute';
  textArea.style.zIndex = '-1000';
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}
