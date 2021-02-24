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

import { ActionEntry } from '../../../server/trace/viewer/traceModel';
import * as React from 'react';
import { useAsyncMemo } from './helpers';
import './sourceTab.css';
import '../../../third_party/highlightjs/highlightjs/tomorrow.css';
import * as highlightjs from '../../../third_party/highlightjs/highlightjs';
import { StackFrame } from '../../../common/types';

type StackInfo = string | {
  frames: StackFrame[];
  fileContent: Map<string, string>;
};

export const SourceTab: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
}> = ({ actionEntry }) => {
  const [lastAction, setLastAction] = React.useState<ActionEntry | undefined>();
  const [selectedFrame, setSelectedFrame] = React.useState<number>(0);
  const [needReveal, setNeedReveal] = React.useState<boolean>(false);

  if (lastAction !== actionEntry) {
    setLastAction(actionEntry);
    setSelectedFrame(0);
    setNeedReveal(true);
  }

  const stackInfo = React.useMemo<StackInfo>(() => {
    if (!actionEntry)
      return '';
    const { action } = actionEntry;
    if (!action.stack)
      return '';
    const frames = action.stack;
    return {
      frames,
      fileContent: new Map(),
    };
  }, [actionEntry]);

  const content = useAsyncMemo<string[]>(async () => {
    let value: string;
    if (typeof stackInfo === 'string') {
      value = stackInfo;
    } else {
      const filePath = stackInfo.frames[selectedFrame].file;
      if (!stackInfo.fileContent.has(filePath))
        stackInfo.fileContent.set(filePath, await fetch(`/file?${filePath}`).then(response => response.text()).catch(e => `<Unable to read "${filePath}">`));
      value = stackInfo.fileContent.get(filePath)!;
    }
    const result = [];
    let continuation: any;
    for (const line of (value || '').split('\n')) {
      const highlighted = highlightjs.highlight('javascript', line, true, continuation);
      continuation = highlighted.top;
      result.push(highlighted.value);
    }
    return result;
  }, [stackInfo, selectedFrame], []);

  const targetLine = typeof stackInfo === 'string' ? -1 : stackInfo.frames[selectedFrame].line;

  const targetLineRef = React.createRef<HTMLDivElement>();
  React.useLayoutEffect(() => {
    if (needReveal && targetLineRef.current) {
      targetLineRef.current.scrollIntoView({ block: 'center', inline: 'nearest' });
      setNeedReveal(false);
    }
  }, [needReveal, targetLineRef]);

  return <div className='source-tab'>
    <div className='source-content'>{
      content.map((markup, index) => {
        const isTargetLine = (index + 1) === targetLine;
        return <div
          key={index}
          className={isTargetLine ? 'source-line-highlight' : ''}
          ref={isTargetLine ? targetLineRef : null}
        >
          <div className='source-line-number'>{index + 1}</div>
          <div className='source-code' dangerouslySetInnerHTML={{ __html: markup }}></div>
        </div>;
      })
    }</div>
    {typeof stackInfo !== 'string' && <div className='source-stack'>{
      stackInfo.frames.map((frame, index) => {
        return <div
          key={index}
          className={'source-stack-frame' + (selectedFrame === index ? ' selected' : '')}
          onClick={() => {
            setSelectedFrame(index);
            setNeedReveal(true);
          }}
        >
          <span className='source-stack-frame-function'>
            {frame.function || '(anonymous)'}
          </span>
          <span className='source-stack-frame-location'>
            {frame.file}
          </span>
          <span className='source-stack-frame-line'>
            {':' + frame.line}
          </span>
        </div>;
      })
    }</div>}
  </div>;
};
