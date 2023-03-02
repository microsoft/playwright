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

import '@web/third_party/vscode/codicon.css';
import { loadSingleTraceFile, Workbench } from './workbench';
import '@web/common.css';
import React from 'react';
import { ListView } from '@web/components/listView';
import { TeleReporterReceiver } from '../../../playwright-test/src/isomorphic/teleReceiver';
import type { FullConfig, Suite, TestCase, TestStep } from '../../../playwright-test/types/testReporter';
import { SplitView } from '@web/components/splitView';
import type { MultiTraceModel } from './modelUtil';
import './watchMode.css';
import { ToolbarButton } from '@web/components/toolbarButton';

let rootSuite: Suite | undefined;

let updateList: () => void = () => {};
let updateProgress: () => void = () => {};

type Entry = { test?: TestCase, fileSuite: Suite };

export const WatchModeView: React.FC<{}> = ({
}) => {
  const [updateCounter, setUpdateCounter] = React.useState(0);
  updateList = () => setUpdateCounter(updateCounter + 1);
  const [selectedFileSuite, setSelectedFileSuite] = React.useState<Suite | undefined>();
  const [selectedTest, setSelectedTest] = React.useState<TestCase | undefined>();
  const [isRunningTest, setIsRunningTest] = React.useState<boolean>(false);
  const [expandedFiles] = React.useState(new Map<Suite, boolean | undefined>());
  const [filterText, setFilterText] = React.useState<string>('');

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const selectedOrDefaultFileSuite = selectedFileSuite || rootSuite?.suites?.[0]?.suites?.[0];
  const tests: TestCase[] = [];
  const fileSuites: Suite[] = [];

  for (const projectSuite of rootSuite?.suites || []) {
    for (const fileSuite of projectSuite.suites) {
      if (fileSuite === selectedOrDefaultFileSuite)
        tests.push(...fileSuite.allTests());
      fileSuites.push(fileSuite);
    }
  }

  const explicitlyOrAutoExpandedFiles = new Set<Suite>();
  const entries = new Map<TestCase | Suite, Entry>();
  const trimmedFilterText = filterText.trim();
  const filterTokens = trimmedFilterText.toLowerCase().split(' ');
  for (const fileSuite of fileSuites) {
    const hasMatch = !trimmedFilterText || fileSuite.allTests().some(test => {
      const fullTitle = test.titlePath().join(' ').toLowerCase();
      return !filterTokens.some(token => !fullTitle.includes(token));
    });
    if (hasMatch)
      entries.set(fileSuite, { fileSuite });
    const expandState = expandedFiles.get(fileSuite);
    const autoExpandMatches = entries.size < 100 && (trimmedFilterText && hasMatch && expandState !== false);
    if (expandState === true || autoExpandMatches) {
      explicitlyOrAutoExpandedFiles.add(fileSuite);
      for (const test of fileSuite.allTests()) {
        const fullTitle = test.titlePath().join(' ').toLowerCase();
        if (!filterTokens.some(token => !fullTitle.includes(token)))
          entries.set(test, { test, fileSuite });
      }
    }
  }

  const visibleTestIds = new Set<string>();
  for (const { test } of entries.values()) {
    if (test)
      visibleTestIds.add(test.id);
  }

  const runEntry = (entry: Entry) => {
    expandedFiles.set(entry.fileSuite, true);
    setSelectedTest(entry.test);
    setIsRunningTest(true);
    runTests(entry.test ? entry.test.location.file + ':' + entry.test.location.line : entry.fileSuite.title, undefined).then(() => {
      setIsRunningTest(false);
    });
  };

  const selectedEntry = selectedTest ? entries.get(selectedTest) : selectedOrDefaultFileSuite ? entries.get(selectedOrDefaultFileSuite) : undefined;
  return <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true}>
    <TraceView test={selectedTest} isRunningTest={isRunningTest}></TraceView>
    <div className='vbox watch-mode-sidebar'>
      <div style={{ flex: 'none', display: 'flex', padding: 4 }}>
        <input ref={inputRef} type='search' placeholder='Filter tests' spellCheck={false} value={filterText}
          onChange={e => {
            setFilterText(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              setIsRunningTest(true);
              runTests(undefined, [...visibleTestIds]).then(() => {
                setIsRunningTest(false);
              });
            }
          }}></input>
      </div>
      <ListView
        items={[...entries.values()]}
        itemKey={(entry: Entry) => entry.test ? entry.test!.id : entry.fileSuite.title }
        itemRender={(entry: Entry) => {
          return <div className='hbox watch-mode-list-item'>
            <div className='watch-mode-list-item-title'>{entry.test ? entry.test!.titlePath().slice(3).join(' › ') : entry.fileSuite.title}</div>
            <ToolbarButton icon='play' title='Run' onClick={() => runEntry(entry)} disabled={isRunningTest}></ToolbarButton>
          </div>;
        }}
        itemIcon={(entry: Entry) => {
          if (entry.test) {
            if (entry.test.results.length && entry.test.results[0].duration)
              return entry.test.ok() ? 'codicon-check' : 'codicon-error';
            if (entry.test.results.length)
              return 'codicon-loading';
          } else {
            if (explicitlyOrAutoExpandedFiles.has(entry.fileSuite))
              return 'codicon-chevron-down';
            return 'codicon-chevron-right';
          }
        }}
        itemIndent={(entry: Entry) => entry.test ? 1 : 0}
        selectedItem={selectedEntry}
        onAccepted={runEntry}
        onLeftArrow={(entry: Entry) => {
          expandedFiles.set(entry.fileSuite, false);
          setSelectedTest(undefined);
          setSelectedFileSuite(entry.fileSuite);
          updateList();
        }}
        onRightArrow={(entry: Entry) => {
          expandedFiles.set(entry.fileSuite, true);
          updateList();
        }}
        onSelected={(entry: Entry) => {
          if (entry.test) {
            setSelectedFileSuite(undefined);
            setSelectedTest(entry.test!);
          } else {
            setSelectedTest(undefined);
            setSelectedFileSuite(entry.fileSuite);
          }
        }}
        onIconClicked={(entry: Entry) => {
          if (explicitlyOrAutoExpandedFiles.has(entry.fileSuite))
            expandedFiles.set(entry.fileSuite, false);
          else
            expandedFiles.set(entry.fileSuite, true);
          updateList();
        }}
        showNoItemsMessage={true}></ListView>
    </div>
  </SplitView>;
};

export const ProgressView: React.FC<{
  test: TestCase | undefined,
}> = ({
  test,
}) => {
  const [updateCounter, setUpdateCounter] = React.useState(0);
  updateProgress = () => setUpdateCounter(updateCounter + 1);

  const steps: (TestCase | TestStep)[] = [];
  for (const result of test?.results || [])
    steps.push(...result.steps);

  return <ListView
    items={steps}
    itemRender={(step: TestStep) => step.title}
    itemIcon={(step: TestStep) => step.error ? 'codicon-error' : 'codicon-check'}
  ></ListView>;
};

export const TraceView: React.FC<{
  test: TestCase | undefined,
  isRunningTest: boolean,
}> = ({ test, isRunningTest }) => {
  const [model, setModel] = React.useState<MultiTraceModel | undefined>();

  React.useEffect(() => {
    (async () => {
      if (!test) {
        setModel(undefined);
        return;
      }
      for (const result of test.results) {
        const attachment = result.attachments.find(a => a.name === 'trace');
        if (attachment && attachment.path) {
          setModel(await loadSingleTraceFile(attachment.path));
          return;
        }
      }
      setModel(undefined);
    })();
  }, [test, isRunningTest]);

  if (isRunningTest)
    return <ProgressView test={test}></ProgressView>;

  if (!model) {
    return <div className='vbox'>
      <div className='drop-target'>
        <div>Run test to see the trace</div>
        <div style={{ paddingTop: 20 }}>
          <div>Double click a test or hit Enter</div>
        </div>
      </div>
    </div>;
  }

  return <Workbench model={model} view='embedded'></Workbench>;

};

declare global {
  interface Window {
    binding(data: any): Promise<void>;
  }
}

const receiver = new TeleReporterReceiver({
  onBegin: (config: FullConfig, suite: Suite) => {
    if (!rootSuite)
      rootSuite = suite;
    updateList();
  },

  onTestBegin: () => {
    updateList();
  },

  onTestEnd: () => {
    updateList();
  },

  onStepBegin: () => {
    updateProgress();
  },

  onStepEnd: () => {
    updateProgress();
  },
});


(window as any).dispatch = (message: any) => {
  receiver.dispatch(message);
};

async function runTests(location: string | undefined, testIds: string[] | undefined): Promise<void> {
  await (window as any).binding({
    method: 'run',
    params: { location, testIds }
  });
}
