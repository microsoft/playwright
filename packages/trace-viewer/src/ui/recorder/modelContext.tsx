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

import { sha1 } from '@web/uiUtils';
import * as React from 'react';
import type { ContextEntry } from '../../types/entries';
import { MultiTraceModel } from '../modelUtil';

export const ModelContext = React.createContext<MultiTraceModel | undefined>(undefined);

export const ModelProvider: React.FunctionComponent<React.PropsWithChildren<{
  trace: string,
}>> = ({ trace, children }) => {
  const [model, setModel] = React.useState<{ model: MultiTraceModel, sha1: string } | undefined>();
  const [counter, setCounter] = React.useState(0);
  const pollTimer = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (pollTimer.current)
      clearTimeout(pollTimer.current);

    // Start polling running test.
    pollTimer.current = setTimeout(async () => {
      try {
        const result = await loadSingleTraceFile(trace);
        if (result.sha1 !== model?.sha1)
          setModel(result);
      } catch {
        setModel(undefined);
      } finally {
        setCounter(counter + 1);
      }
    }, 500);
    return () => {
      if (pollTimer.current)
        clearTimeout(pollTimer.current);
    };
  }, [counter, model, trace]);

  return <ModelContext.Provider value={model?.model}>
    {children}
  </ModelContext.Provider>;
};

async function loadSingleTraceFile(url: string): Promise<{ model: MultiTraceModel, sha1: string }> {
  const params = new URLSearchParams();
  params.set('trace', url);
  const response = await fetch(`contexts?${params.toString()}`);
  const contextEntries = await response.json() as ContextEntry[];

  const tokens: string[] = [];
  for (const entry of contextEntries) {
    entry.actions.forEach(a => tokens.push(a.type + '@' + a.startTime + '-' + a.endTime));
    entry.events.forEach(e => tokens.push(e.type + '@' + e.time));
  }
  return { model: new MultiTraceModel(contextEntries), sha1: await sha1(tokens.join('|')) };
}
