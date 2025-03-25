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
import type { ContextEntry } from '../types/entries';
import type { MultiTraceModelOrLoadError, SourceLocation } from './modelUtil';
import { MultiTraceModel } from './modelUtil';
import { Workbench } from './workbench';

export const TraceView: React.FC<{
  item: { treeItem?: TreeItem, testFile?: SourceLocation, testCase?: reporterTypes.TestCase },
  rootDir?: string,
  onOpenExternally?: (location: SourceLocation) => void,
  revealSource?: boolean,
  pathSeparator: string,
}> = ({ item, rootDir, onOpenExternally, revealSource, pathSeparator }) => {
  const [trace, setTrace] = React.useState<MultiTraceModelOrLoadError | undefined>();
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
    if (!result) {
      setTrace(undefined);
      return;
    }

    // Test finished.
    const attachment = result && result.duration >= 0 && result.attachments.find(a => a.name === 'trace');
    if (attachment && attachment.path) {
      loadSingleTraceFile(attachment.path).then(model => setTrace({ type: 'model', model, isLive: false }));
      return;
    }

    if (!outputDir) {
      setTrace(undefined);
      return;
    }

    const traceLocation = [
      outputDir,
      artifactsFolderName(result!.workerIndex),
      'traces',
      `${item.testCase?.id}.json`
    ].join(pathSeparator);
    // Start polling running test.
    pollTimer.current = setTimeout(async () => {
      try {
        const model = await loadSingleTraceFile(traceLocation);
        setTrace({ type: 'model', model, isLive: true });
      } catch (e) {
        if (result.status !== 'failed') {
          setTrace(undefined);
          return;
        }

        // Test failed. We don't know what happened to the trace
        const treeErrors = () => {
          if (!item.treeItem || item.treeItem.kind !== 'case' || !item.treeItem.test)
            return [];
          const test = item.treeItem.test;
          return test.results.flatMap(result => result.errors).flatMap(error => {
            if (!error.message)
              return [];
            return [error.message];
          });
        };

        setTrace({
          type: 'error',
          errors: treeErrors(),
          isLive: false
        });

      } finally {
        setCounter(counter + 1);
      }
    }, 500);
    return () => {
      if (pollTimer.current)
        clearTimeout(pollTimer.current);
    };
  }, [outputDir, item, setTrace, counter, setCounter, pathSeparator]);

  return <Workbench
    key='workbench'
    trace={trace}
    showSourcesFirst={true}
    rootDir={rootDir}
    fallbackLocation={item.testFile}
    status={item.treeItem?.status}
    annotations={item.testCase?.annotations || []}
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

async function loadSingleTraceFile(url: string): Promise<MultiTraceModel> {
  const params = new URLSearchParams();
  params.set('trace', url);
  params.set('limit', '1');
  const response = await fetch(`contexts?${params.toString()}`);
  const contextEntries = await response.json() as ContextEntry[] | { error: string };
  if ('error' in contextEntries)
    throw new Error(contextEntries.error);
  return new MultiTraceModel(contextEntries);
}
