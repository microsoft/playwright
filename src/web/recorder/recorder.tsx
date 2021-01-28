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

export interface RecorderProps {
  text: string
}

export const Recorder: React.FC<RecorderProps> = ({
  text
}) => {
  return <div className="recorder">
    <Toolbar>
      <ToolbarButton icon="clone" title="Copy" onClick={() => {}}></ToolbarButton>
      <ToolbarButton icon="trashcan" title="Erase" onClick={() => {}}></ToolbarButton>
      <div style={{flex: "auto"}}></div>
      <ToolbarButton icon="close" title="Close" onClick={() => {}}></ToolbarButton>
    </Toolbar>
    <Source text={text}></Source>
  </div>;
};
