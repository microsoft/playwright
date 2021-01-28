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

export interface SourceProps {
  text: string,
  highlightedLine?: number
}

export const Source: React.FC<SourceProps> = ({
  text = '',
  highlightedLine = -1
}) => {
  const lines = React.useMemo<string[]>(() => {
    const result = [];
    let continuation: any;
    for (const line of text.split('\n')) {
      const highlighted = highlightjs.highlight('javascript', line, true, continuation);
      continuation = highlighted.top;
      result.push(highlighted.value);
    }
    return result;
  }, [text]);


  const highlightedLineRef = React.createRef<HTMLDivElement>();
  React.useLayoutEffect(() => {
    if (highlightedLine && highlightedLineRef.current)
      highlightedLineRef.current.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [highlightedLineRef]);

  return <div className='source'>{
      lines.map((markup, index) => {
        const isHighlighted = index === highlightedLine;
        const className = isHighlighted ? 'source-line source-line-highlighted' : 'source-line';
        return <div key={index} className={className} ref={isHighlighted ? highlightedLineRef : null}>
          <div className='source-line-number'>{index + 1}</div>
          <div className='source-code' dangerouslySetInnerHTML={{ __html: markup }}></div>
        </div>;
      })
    }</div>
};
