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
import * as highlightjs from '../../third_party/highlightjs/highlightjs';
import '../../third_party/highlightjs/highlightjs/tomorrow.css';

export type SourceHighlight = {
  line: number;
  type: 'running' | 'paused' | 'error';
};

export interface SourceProps {
  text: string;
  language: string;
  // 1-based
  highlight?: SourceHighlight[];
  revealLine?: number;
}

export const Source: React.FC<SourceProps> = ({ text, language, highlight = [], revealLine }) => {
  const lines = React.useMemo<string[]>(() => {
    const result = [];
    let continuation: any;
    for (const line of text.split('\n')) {
      const highlighted = highlightjs.highlight(language, line, true, continuation);
      continuation = highlighted.top;
      result.push(highlighted.value);
    }
    return result;
  }, [text, language]);

  const revealedLineRef = React.createRef<HTMLDivElement>();
  React.useLayoutEffect(() => {
    if (typeof revealLine === 'number' && revealedLineRef.current)
      revealedLineRef.current.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [revealedLineRef, revealLine]);

  return (
    <div className="source">
      {lines.map((markup, index) => {
        const lineNumber = index + 1;
        const lineHighlight = highlight.find((h) => h.line === lineNumber);
        const lineClass = lineHighlight
          ? `source-line source-line-${lineHighlight.type}`
          : 'source-line';
        return (
          <div
            key={lineNumber}
            className={lineClass}
            ref={revealLine === lineNumber ? revealedLineRef : null}
          >
            <div className="source-line-number">{lineNumber}</div>
            <div className="source-code" dangerouslySetInnerHTML={{ __html: markup }}></div>
          </div>
        );
      })}
    </div>
  );
};
