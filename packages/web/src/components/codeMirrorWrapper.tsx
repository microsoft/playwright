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

import './source.css';
import * as React from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike';
import 'codemirror/lib/codemirror.css';

export type SourceHighlight = {
  line: number;
  type: 'running' | 'paused' | 'error';
};

export type Language = 'javascript' | 'python' | 'java' | 'csharp';

export interface SourceProps {
  text: string;
  language: Language;
  readOnly: boolean;
  // 1-based
  highlight?: SourceHighlight[];
  revealLine?: number;
  lineNumbers?: boolean;
  focusOnChange?: boolean;
  wrapLines?: boolean;
  onChange?: (text: string) => void;
}

export const CodeMirrorWrapper: React.FC<SourceProps> = ({
  text,
  language,
  readOnly,
  highlight = [],
  revealLine,
  lineNumbers,
  focusOnChange,
  wrapLines,
  onChange,
}) => {
  const codemirrorElement = React.createRef<HTMLDivElement>();
  const [codemirror, setCodemirror] = React.useState<CodeMirror.Editor>();

  React.useEffect(() => {
    let mode;
    if (language === 'javascript')
      mode = 'javascript';
    if (language === 'python')
      mode = 'python';
    if (language === 'java')
      mode = 'text/x-java';
    if (language === 'csharp')
      mode = 'text/x-csharp';

    if (codemirror && codemirror.getOption('mode') === mode && codemirror.isReadOnly() === readOnly)
      return;

    if (!codemirrorElement.current)
      return;
    if (codemirror)
      codemirror.getWrapperElement().remove();

    const cm = CodeMirror(codemirrorElement.current, {
      value: '',
      mode,
      readOnly,
      lineNumbers,
      lineWrapping: wrapLines,
    });
    if (onChange)
      cm.on('change', () => onChange(cm.getValue()));
    setCodemirror(cm);
    updateEditor(cm, text, highlight, revealLine, focusOnChange);
  }, [codemirror, codemirrorElement, text, language, highlight, revealLine, focusOnChange, lineNumbers, wrapLines, readOnly, onChange]);

  if (codemirror)
    updateEditor(codemirror, text, highlight, revealLine, focusOnChange);

  return <div className='cm-wrapper' ref={codemirrorElement}></div>;
};

function updateEditor(cm: CodeMirror.Editor, text: string, highlight: SourceHighlight[], revealLine?: number, focusOnChange?: boolean) {
  if (cm.getValue() !== text) {
    cm.setValue(text);
    if (focusOnChange) {
      cm.execCommand('selectAll');
      cm.focus();
    }
  }
  for (let i = 0; i < cm.lineCount(); ++i)
    cm.removeLineClass(i, 'wrap');
  for (const h of highlight)
    cm.addLineClass(h.line - 1, 'wrap', `source-line-${h.type}`);
  if (revealLine)
    cm.scrollIntoView({ line: revealLine - 1, ch: 0 }, 50);
}
