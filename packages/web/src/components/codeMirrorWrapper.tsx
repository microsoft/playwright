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

import './codeMirrorWrapper.css';
import * as React from 'react';
import type { CodeMirror } from './codeMirrorModule';
import { ansi2html } from '../ansi2html';
import { useMeasure, kWebLinkRe } from '../uiUtils';

export type SourceHighlight = {
  line: number;
  type: 'running' | 'paused' | 'error';
  message?: string;
};

export type Language = 'javascript' | 'python' | 'java' | 'csharp' | 'jsonl' | 'html' | 'css' | 'markdown';

export interface SourceProps {
  text: string;
  language?: Language;
  mimeType?: string;
  linkify?: boolean;
  readOnly?: boolean;
  // 1-based
  highlight?: SourceHighlight[];
  revealLine?: number;
  lineNumbers?: boolean;
  isFocused?: boolean;
  focusOnChange?: boolean;
  wrapLines?: boolean;
  onChange?: (text: string) => void;
}

export const CodeMirrorWrapper: React.FC<SourceProps> = ({
  text,
  language,
  mimeType,
  linkify,
  readOnly,
  highlight,
  revealLine,
  lineNumbers,
  isFocused,
  focusOnChange,
  wrapLines,
  onChange,
}) => {
  const [measure, codemirrorElement] = useMeasure<HTMLDivElement>();
  const [modulePromise] = React.useState<Promise<CodeMirror>>(import('./codeMirrorModule').then(m => m.default));
  const codemirrorRef = React.useRef<{ cm: CodeMirror.Editor, highlight?: SourceHighlight[], widgets?: CodeMirror.LineWidget[] } | null>(null);
  const [codemirror, setCodemirror] = React.useState<CodeMirror.Editor>();

  React.useEffect(() => {
    (async () => {
      // Always load the module first.
      const CodeMirror = await modulePromise;
      defineCustomMode(CodeMirror);

      const element = codemirrorElement.current;
      if (!element)
        return;

      const mode = languageToMode(language) || mimeTypeToMode(mimeType) || (linkify ? 'text/linkified' : '');

      if (codemirrorRef.current
        && mode === codemirrorRef.current.cm.getOption('mode')
        && !!readOnly === codemirrorRef.current.cm.getOption('readOnly')
        && lineNumbers === codemirrorRef.current.cm.getOption('lineNumbers')
        && wrapLines === codemirrorRef.current.cm.getOption('lineWrapping')) {
        // No need to re-create codemirror.
        return;
      }

      // Either configuration is different or we don't have a codemirror yet.
      codemirrorRef.current?.cm?.getWrapperElement().remove();
      const cm = CodeMirror(element, {
        value: '',
        mode,
        readOnly: !!readOnly,
        lineNumbers,
        lineWrapping: wrapLines,
      });
      codemirrorRef.current = { cm };
      if (isFocused)
        cm.focus();
      setCodemirror(cm);
      return cm;
    })();
  }, [modulePromise, codemirror, codemirrorElement, language, mimeType, linkify, lineNumbers, wrapLines, readOnly, isFocused]);

  React.useEffect(() => {
    if (codemirrorRef.current)
      codemirrorRef.current.cm.setSize(measure.width, measure.height);
  }, [measure]);

  React.useLayoutEffect(() => {
    if (!codemirror)
      return;

    let valueChanged = false;
    if (codemirror.getValue() !== text) {
      codemirror.setValue(text);
      valueChanged = true;
      if (focusOnChange) {
        codemirror.execCommand('selectAll');
        codemirror.focus();
      }
    }

    if (valueChanged || JSON.stringify(highlight) !== JSON.stringify(codemirrorRef.current!.highlight)) {
      // Line highlight.
      for (const h of codemirrorRef.current!.highlight || [])
        codemirror.removeLineClass(h.line - 1, 'wrap');
      for (const h of highlight || [])
        codemirror.addLineClass(h.line - 1, 'wrap', `source-line-${h.type}`);

      // Error widgets.
      for (const w of codemirrorRef.current!.widgets || [])
        codemirror.removeLineWidget(w);
      const widgets: CodeMirror.LineWidget[] = [];
      for (const h of highlight || []) {
        if (h.type !== 'error')
          continue;

        const line = codemirrorRef.current?.cm.getLine(h.line - 1);
        if (line) {
          const underlineWidgetElement = document.createElement('div');
          underlineWidgetElement.className = 'source-line-error-underline';
          underlineWidgetElement.innerHTML = '&nbsp;'.repeat(line.length || 1);
          widgets.push(codemirror.addLineWidget(h.line, underlineWidgetElement, { above: true, coverGutter: false }));
        }

        const errorWidgetElement = document.createElement('div');
        errorWidgetElement.innerHTML = ansi2html(h.message || '');
        errorWidgetElement.className = 'source-line-error-widget';
        widgets.push(codemirror.addLineWidget(h.line, errorWidgetElement, { above: true, coverGutter: false }));
      }
      codemirrorRef.current!.highlight = highlight;
      codemirrorRef.current!.widgets = widgets;
    }

    // Line-less locations have line = 0, but they mean to reveal the file.
    if (typeof revealLine === 'number' && codemirrorRef.current!.cm.lineCount() >= revealLine)
      codemirror.scrollIntoView({ line: Math.max(0, revealLine - 1), ch: 0 }, 50);

    let changeListener: () => void | undefined;
    if (onChange) {
      changeListener = () => onChange(codemirror.getValue());
      codemirror.on('change', changeListener);
    }

    return () => {
      if (changeListener)
        codemirror.off('change', changeListener);
    };
  }, [codemirror, text, highlight, revealLine, focusOnChange, onChange]);

  return <div className='cm-wrapper' ref={codemirrorElement} onClick={onCodeMirrorClick}></div>;
};

function onCodeMirrorClick(event: React.MouseEvent) {
  if (!(event.target instanceof HTMLElement))
    return;
  let url: string | undefined;
  if (event.target.classList.contains('cm-linkified')) {
    // 'text/linkified' custom mode
    url = event.target.textContent!;
  } else if (event.target.classList.contains('cm-link') && event.target.nextElementSibling?.classList.contains('cm-url')) {
    // 'markdown' mode
    url = event.target.nextElementSibling.textContent!.slice(1, -1);
  }
  if (url) {
    event.preventDefault();
    event.stopPropagation();
    window.open(url, '_blank');
  }
}

let customModeDefined = false;
function defineCustomMode(cm: CodeMirror) {
  if (customModeDefined)
    return;
  customModeDefined = true;
  (cm as any).defineSimpleMode('text/linkified', {
    start: [
      { regex: kWebLinkRe, token: 'linkified' },
    ],
  });
}

function mimeTypeToMode(mimeType: string | undefined): string | undefined {
  if (!mimeType)
    return;
  if (mimeType.includes('javascript') || mimeType.includes('json'))
    return 'javascript';
  if (mimeType.includes('python'))
    return 'python';
  if (mimeType.includes('csharp'))
    return 'text/x-csharp';
  if (mimeType.includes('java'))
    return 'text/x-java';
  if (mimeType.includes('markdown'))
    return 'markdown';
  if (mimeType.includes('html') || mimeType.includes('svg'))
    return 'htmlmixed';
  if (mimeType.includes('css'))
    return 'css';
}

function languageToMode(language: Language | undefined): string | undefined {
  if (!language)
    return;
  return {
    javascript: 'javascript',
    jsonl: 'javascript',
    python: 'python',
    csharp: 'text/x-csharp',
    java: 'text/x-java',
    markdown: 'markdown',
    html: 'htmlmixed',
    css: 'css',
  }[language];
}
