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
import { MultiTraceModel } from './modelUtil';
import './workbenchLoader.css';
import { Workbench } from './workbench';

import type { ContextEntry } from '../types/entries';

export const LiveWorkbenchLoader: React.FC<{ traceJson: string }> = ({ traceJson }) => {
  const [model, setModel] = React.useState<MultiTraceModel | undefined>(undefined);
  const [counter, setCounter] = React.useState(0);
  const pollTimer = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (pollTimer.current)
      clearTimeout(pollTimer.current);

    // Start polling running test.
    pollTimer.current = setTimeout(async () => {
      try {
        const model = await loadSingleTraceFile(traceJson);
        setModel(model);
      } catch {
        const model = new MultiTraceModel([]);
        setModel(model);
      } finally {
        setCounter(counter + 1);
      }
    }, 500);
    return () => {
      if (pollTimer.current)
        clearTimeout(pollTimer.current);
    };
  }, [traceJson, counter]);

  return <Workbench model={model} isLive={true} />;
};

async function loadSingleTraceFile(traceJson: string): Promise<MultiTraceModel> {
  const params = new URLSearchParams();
  params.set('trace', traceJson);
  params.set('limit', '1');
  const response = await fetch(`contexts?${params.toString()}`);
  const contextEntries = await response.json() as ContextEntry[];
  return new MultiTraceModel(contextEntries);
}
