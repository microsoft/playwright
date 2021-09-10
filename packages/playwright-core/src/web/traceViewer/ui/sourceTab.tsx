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

import * as React from 'react';
import { useAsyncMemo } from './helpers';
import './sourceTab.css';
import '../../../third_party/highlightjs/highlightjs/tomorrow.css';
import { Source as SourceView } from '../../components/source';
import { StackTraceView } from './stackTrace';
import { SplitView } from '../../components/splitView';
import { ActionTraceEvent } from '../../../server/trace/common/traceEvents';
import { StackFrame } from '../../../protocol/channels';

type StackInfo = string | {
  frames: StackFrame[];
  fileContent: Map<string, string>;
};

export const SourceTab: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
}> = ({ action }) => {
  const [lastAction, setLastAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedFrame, setSelectedFrame] = React.useState<number>(0);
  const [needReveal, setNeedReveal] = React.useState<boolean>(false);

  if (lastAction !== action) {
    setLastAction(action);
    setSelectedFrame(0);
    setNeedReveal(true);
  }

  const stackInfo = React.useMemo<StackInfo>(() => {
    if (!action)
      return '';
    const { metadata } = action;
    if (!metadata.stack)
      return '';
    const frames = metadata.stack;
    return {
      frames,
      fileContent: new Map(),
    };
  }, [action]);

  const content = useAsyncMemo<string>(async () => {
    let value: string;
    if (typeof stackInfo === 'string') {
      value = stackInfo;
    } else {
      const filePath = stackInfo.frames[selectedFrame].file;
      if (!stackInfo.fileContent.has(filePath))
        stackInfo.fileContent.set(filePath, await fetch(`/file?${filePath}`).then(response => response.text()).catch(e => `<Unable to read "${filePath}">`));
      value = stackInfo.fileContent.get(filePath)!;
    }
    return value;
  }, [stackInfo, selectedFrame], '');

  const targetLine = typeof stackInfo === 'string' ? 0 : stackInfo.frames[selectedFrame]?.line || 0;

  const targetLineRef = React.createRef<HTMLDivElement>();
  React.useLayoutEffect(() => {
    if (needReveal && targetLineRef.current) {
      targetLineRef.current.scrollIntoView({ block: 'center', inline: 'nearest' });
      setNeedReveal(false);
    }
  }, [needReveal, targetLineRef]);

  return <SplitView sidebarSize={100} orientation='vertical'>
    <SourceView text={content} language='javascript' highlight={[{ line: targetLine, type: 'running' }]} revealLine={targetLine}></SourceView>
    <StackTraceView action={action} selectedFrame={selectedFrame} setSelectedFrame={setSelectedFrame}></StackTraceView>
  </SplitView>;
};
