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
import type { TreeItem } from '@testIsomorphic/testTree';
import '@web/common.css';
import '@web/third_party/vscode/codicon.css';
import type * as reporterTypes from 'playwright/types/testReporter';
import React from 'react';
import type { ContextEntry } from '@isomorphic/trace/entries';
import type { SourceLocation } from '@isomorphic/trace/traceModel';
import { TraceModel } from '@isomorphic/trace/traceModel';
import { Workbench } from './workbench';

export const TraceView: React.FC<{
  item: { treeItem?: TreeItem, testFile?: SourceLocation, testCase?: reporterTypes.TestCase },
  rootDir?: string,
  onOpenExternally?: (location: SourceLocation) => void,
  revealSource?: boolean,
  pathSeparator: string,
}> = ({ item, rootDir, onOpenExternally, revealSource, pathSeparator }) => {
  const [model, setModel] = React.useState<{ model: TraceModel, isLive: boolean } | undefined>(undefined);
  const [counter, setCounter] = React.useState(0);
  const pollTimer = React.useRef<NodeJS.Timeout | null>(null);

  const { outputDir } = React.useMemo(() => {
    const outputDir = item.testCase ? outputDirForTestCase(item.testCase) : undefined;
    return { outputDir };
  }, [item]);

  React.useEffect(() => {
    if (pollTimer.current)
      clearTimeout(pollTimer.current);

    const result = item.testCase?.results[0];
    if (!result || item.treeItem?.status === 'scheduled') {
      setModel(undefined);
      return;
    }

    // Test finished.
    const attachment = result && result.duration >= 0 && result.attachments.find(a => a.name === 'trace');
    if (attachment && attachment.path) {
      loadSingleTraceFile(attachment.path, result.startTime.getTime()).then(model => setModel({ model, isLive: false }));
      return;
    }

    if (!outputDir) {
      setModel(undefined);
      return;
    }

    const traceLocation = [
      outputDir,
      artifactsFolderName(result.workerIndex),
      'traces',
      `${item.testCase?.id}.json`
    ].join(pathSeparator);
    // Start polling running test.
    pollTimer.current = setTimeout(async () => {
      try {
        const model = await loadSingleTraceFile(traceLocation, Date.now());
        setModel({ model, isLive: true });
      } catch {
        const model = new TraceModel('', []);
        model.errorDescriptors.push(...result.errors.flatMap(error => !!error.message ? [{ message: error.message }] : []));
        setModel({ model, isLive: false });
      } finally {
        setCounter(counter + 1);
      }
    }, 500);
    return () => {
      if (pollTimer.current)
        clearTimeout(pollTimer.current);
    };
  }, [outputDir, item, setModel, counter, setCounter, pathSeparator]);

  return <Workbench
    model={model?.model}
    key='workbench'
    showSourcesFirst={true}
    rootDir={rootDir}
    fallbackLocation={item.testFile}
    isLive={model?.isLive}
    status={item.treeItem?.status}
    annotations={item.testCase?.annotations ?? []}
    onOpenExternally={onOpenExternally}
    revealSource={revealSource}
  />;
};

const outputDirForTestCase = (testCase: reporterTypes.TestCase): string | undefined => {
  for (let suite: reporterTypes.Suite | undefined = testCase.parent; suite; suite = suite.parent) {
    if (suite.project())
      return suite.project()?.outputDir;
  }
  return undefined;
};

async function loadSingleTraceFile(absolutePath: string, timestamp: number): Promise<TraceModel> {
  const traceUri = `file?path=${encodeURIComponent(absolutePath)}&timestamp=${timestamp}`;
  const params = new URLSearchParams();
  params.set('trace', traceUri);
  const response = await fetch(`contexts?${params.toString()}`);
  const contextEntries = await response.json() as ContextEntry[];
  return new TraceModel(traceUri, contextEntries);
}
