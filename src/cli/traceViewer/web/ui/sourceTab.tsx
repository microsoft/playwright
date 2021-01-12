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

import { ActionEntry } from '../../traceModel';
import * as React from 'react';
import { useAsyncMemo } from './helpers';
import './sourceTab.css';
import '../../../../third_party/highlightjs/highlightjs/tomorrow.css';
import * as highlightjs from '../../../../third_party/highlightjs/highlightjs';

export const SourceTab: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
}> = ({ actionEntry }) => {
  const location = React.useMemo<{ fileName?: string, lineNumber?: number, value?: string }>(() => {
    if (!actionEntry)
      return { value: '' };
    const { action } = actionEntry;
    const frames = action.stack!.split('\n').slice(1);
    const frame = frames.filter(frame => !frame.includes('playwright/build/') && !frame.includes('playwright/src/'))[0];
    if (!frame)
      return { value: action.stack! };
    const match = frame.match(/at [^(]+\(([^:]+):(\d+):\d+\)/) || frame.match(/at ([^:^(]+):(\d+):\d+/);
    if (!match)
      return { value: action.stack! };
    const fileName = match[1];
    const lineNumber = parseInt(match[2], 10);
    return { fileName, lineNumber };
  }, [actionEntry]);

  const content = useAsyncMemo<string[]>(async () => {
    const value = location.fileName ? await window.readFile(location.fileName) : location.value;
    const result = [];
    let continuation: any;
    for (const line of (value || '').split('\n')) {
      const highlighted = highlightjs.highlight('javascript', line, true, continuation);
      continuation = highlighted.top;
      result.push(highlighted.value);
    }
    return result;
  }, [location.fileName, location.value], []);

  const targetLineRef = React.createRef<HTMLDivElement>();
  React.useLayoutEffect(() => {
    if (targetLineRef.current)
      targetLineRef.current.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [content, location.lineNumber, targetLineRef]);

  return <div className='source-tab'>{
    content.map((markup, index) => {
      const isTargetLine = (index + 1) === location.lineNumber;
      return <div
        key={index}
        className={isTargetLine ? 'source-line-highlight' : ''}
        ref={isTargetLine ? targetLineRef : null}
      >
        <div className='source-line-number'>{index + 1}</div>
        <div className='source-code' dangerouslySetInnerHTML={{ __html: markup }}></div>
      </div>;
    })
  }
  </div>;
};
