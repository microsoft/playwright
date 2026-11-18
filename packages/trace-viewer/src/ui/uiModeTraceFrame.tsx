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

import { artifactsFolderName } from '@testIsomorphic/folders';
import React from 'react';
import type { ContextEntry } from '@isomorphic/trace/entries';
import { TraceModel } from '@isomorphic/trace/traceModel';
import type { UIModeTraceEvent, UIModeTraceParams } from './uiModeTraceProtocol';
import { Workbench } from './workbench';

// The trace viewer side of the UI mode frame.
export const UIModeTraceFrame: React.FC<{
  params: UIModeTraceParams,
  sendEvent: (event: UIModeTraceEvent) => void,
}> = ({ params, sendEvent }) => {
  const [model, setModel] = React.useState<{ model: TraceModel, isLive: boolean } | undefined>(undefined);
  const [counter, setCounter] = React.useState(0);

  // Only load the trace again when the test result is different.
  const { result, testId, outputDir, pathSeparator } = params;
  const errorsRef = React.useRef<string[]>([]);
  errorsRef.current = result?.errors ?? [];
  const hasResult = !!result;
  const { startTime, duration, workerIndex, tracePath } = result ?? {};

  React.useEffect(() => {
    if (!hasResult) {
      setModel(undefined);
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    // Test finished.
    if (duration! >= 0 && tracePath) {
      loadSingleTraceFile(tracePath, startTime!, signal).then(model => setModel({ model, isLive: false })).catch(e => {
        if (!signal.aborted)
          throw e;
      });
      return () => abortController.abort();
    }

    if (!outputDir) {
      setModel(undefined);
      return;
    }

    const traceLocation = [
      outputDir,
      artifactsFolderName(workerIndex!),
      'traces',
      `${testId}.json`
    ].join(pathSeparator);
    // Start polling running test.
    const pollTimer = setTimeout(async () => {
      try {
        const model = await loadSingleTraceFile(traceLocation, Date.now(), signal);
        setModel({ model, isLive: true });
      } catch {
        if (signal.aborted)
          return;
        const model = new TraceModel('', []);
        model.errorDescriptors.push(...errorsRef.current.map(message => ({ message })));
        setModel({ model, isLive: false });
      }
      setCounter(counter + 1);
    }, 500);
    return () => {
      clearTimeout(pollTimer);
      abortController.abort();
    };
  }, [hasResult, startTime, duration, workerIndex, tracePath, testId, outputDir, pathSeparator, setModel, counter, setCounter]);

  // A live trace gives a new model on each poll. Only send the values that are different.
  const hasModel = !!model;
  const hasDomSnapshots = !!model?.model.hasDomSnapshots;
  const hasAriaSnapshots = !!model?.model.hasAriaSnapshots;
  React.useEffect(() => {
    sendEvent({ method: 'traceInfo', info: hasModel ? { hasDomSnapshots, hasAriaSnapshots } : undefined });
  }, [hasModel, hasDomSnapshots, hasAriaSnapshots, sendEvent]);

  const onOpenExternally = React.useCallback(({ file, line, column }: { file: string, line: number, column: number }) => {
    sendEvent({ method: 'openExternally', location: { file, line, column } });
  }, [sendEvent]);

  return <Workbench
    model={model?.model}
    key='workbench'
    showSourcesFirst={true}
    rootDir={params.rootDir}
    fallbackLocation={params.testFile}
    isLive={model?.isLive}
    status={params.status}
    defaultAnnotations={params.annotations}
    onOpenExternally={onOpenExternally}
    revealSource={params.revealSource}
  />;
};

async function loadSingleTraceFile(absolutePath: string, timestamp: number, signal: AbortSignal): Promise<TraceModel> {
  const traceUri = `file?path=${encodeURIComponent(absolutePath)}&timestamp=${timestamp}`;
  const params = new URLSearchParams();
  params.set('trace', traceUri);
  const response = await fetch(`contexts?${params.toString()}`, { signal });
  const contextEntries = await response.json() as ContextEntry[];
  return new TraceModel(traceUri, contextEntries);
}
