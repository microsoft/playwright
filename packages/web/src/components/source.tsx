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

import * as React from 'react';
import './codeMirrorWrapper.css';
import type { Language } from './codeMirrorWrapper';
import { CodeMirrorWrapper } from './codeMirrorWrapper';

export type SourceHighlight = {
  line: number;
  type: 'running' | 'paused' | 'error';
};

export interface SourceProps {
  text: string;
  language: Language;
  // 1-based
  highlight?: SourceHighlight[];
  revealLine?: number;
}

export const Source: React.FC<SourceProps> = ({
  text,
  language,
  highlight = [],
  revealLine
}) => {
  return <CodeMirrorWrapper text={text} language={language} readOnly={true} highlight={highlight} revealLine={revealLine} lineNumbers={true}></CodeMirrorWrapper>;
};
