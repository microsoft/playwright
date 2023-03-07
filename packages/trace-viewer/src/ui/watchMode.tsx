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
import { Workbench } from './workbench';
import '@web/common.css';
import React from 'react';
import { ListView } from '@web/components/listView';
import { TeleReporterReceiver } from '../../../playwright-test/src/isomorphic/teleReceiver';
import type { FullConfig, Suite, TestCase, TestResult, TestStep } from '../../../playwright-test/types/testReporter';
import { SplitView } from '@web/components/splitView';
import { MultiTraceModel } from './modelUtil';
import './watchMode.css';
import { ToolbarButton } from '@web/components/toolbarButton';
import { Toolbar } from '@web/components/toolbar';
import { toggleTheme } from '@web/theme';
import type { ContextEntry } from '../entries';
import type * as trace from '@trace/trace';

let updateRootSuite: (rootSuite: Suite, progress: Progress) => void = () => {};
let updateStepsProgress: () => void = () => {};
let runWatchedTests = () => {};

export const WatchModeView: React.FC<{}> = ({
}) => {
  const [rootSuite, setRootSuite] = React.useState<{ value: Suite | undefined }>({ value: undefined });
  const [progress, setProgress] = React.useState<Progress>({ total: 0, passed: 0, failed: 0 });
  updateRootSuite = (rootSuite: Suite, { passed, failed }: Progress) => {
    setRootSuite({ value: rootSuite });
    progress.passed = passed;
    progress.failed = failed;
    setProgress({ ...progress });
  };
  const [selectedTreeItemId, setSelectedTreeItemId] = React.useState<string | undefined>();
  const [isRunningTest, setIsRunningTest] = React.useState<boolean>(false);
  const [filterText, setFilterText] = React.useState<string>('');
  const [projectNames, setProjectNames] = React.useState<string[]>([]);
  const [expandedItems, setExpandedItems] = React.useState<Map<string, boolean>>(new Map());

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    resetCollectingRootSuite();
  }, []);

  React.useEffect(() => {
    if (projectNames.length === 0 && rootSuite.value?.suites.length)
      setProjectNames([rootSuite.value?.suites[0].title]);
  }, [projectNames,  rootSuite]);

  const { filteredItems, treeItemMap, visibleTestIds } = React.useMemo(() => {
    const treeItems = createTree(rootSuite.value, projectNames);
    const filteredItems = filterTree(treeItems, filterText);

    const treeItemMap = new Map<string, TreeItem>();
    const visibleTestIds = new Set<string>();
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'test')
        visibleTestIds.add(treeItem.id);
      treeItem.children?.forEach(visit);
      treeItemMap.set(treeItem.id, treeItem);
    };
    filteredItems.forEach(visit);
    return { treeItemMap, visibleTestIds, filteredItems };
  }, [filterText, rootSuite, projectNames]);


  const { listItems } = React.useMemo(() => {
    const listItems = flattenTree(filteredItems, expandedItems, !!filterText.trim());
    return { listItems };
  }, [filteredItems, filterText, expandedItems]);

  const { selectedTreeItem, selectedTestItem } = React.useMemo(() => {
    const selectedTreeItem = selectedTreeItemId ? treeItemMap.get(selectedTreeItemId) : undefined;
    let selectedTestItem: TestItem | undefined;
    if (selectedTreeItem?.kind === 'test')
      selectedTestItem = selectedTreeItem;
    else if (selectedTreeItem?.kind === 'case' && selectedTreeItem.children?.length === 1)
      selectedTestItem = selectedTreeItem.children[0]! as TestItem;
    sendMessageNoReply('watch', { fileName: fileName(selectedTestItem) });
    return { selectedTreeItem, selectedTestItem };
  }, [selectedTreeItemId, treeItemMap]);

  const runTreeItem = (treeItem: TreeItem) => {
    expandedItems.set(treeItem.id, true);
    setSelectedTreeItemId(treeItem.id);
    runTests(collectTestIds(treeItem));
  };

  runWatchedTests = () => {
    runTests(collectTestIds(selectedTreeItem));
  };

  const runTests = (testIds: string[]) => {
    setProgress({ total: testIds.length, passed: 0, failed: 0 });
    setIsRunningTest(true);
    sendMessage('run', { testIds }).then(() => {
      setIsRunningTest(false);
    });
  };

  return <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true}>
    <TraceView testItem={selectedTestItem} isRunningTest={isRunningTest}></TraceView>
    <div className='vbox watch-mode-sidebar'>
      <Toolbar>
        <h3 className='title'>Test explorer</h3>
        <ToolbarButton icon='play' title='Run' onClick={() => runTests([...visibleTestIds])} disabled={isRunningTest}></ToolbarButton>
        <ToolbarButton icon='debug-stop' title='Stop' onClick={() => sendMessageNoReply('stop')} disabled={!isRunningTest}></ToolbarButton>
        <ToolbarButton icon='refresh' title='Reload' onClick={resetCollectingRootSuite} disabled={isRunningTest}></ToolbarButton>
        <div className='spacer'></div>
        <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
      </Toolbar>
      <Toolbar>
        <input ref={inputRef} type='search' placeholder='Filter (e.g. text, @tag)' spellCheck={false} value={filterText}
          onChange={e => {
            setFilterText(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter')
              runTests([...visibleTestIds]);
          }}></input>
      </Toolbar>
      <ListView
        items={listItems}
        itemKey={(treeItem: TreeItem) => treeItem.id }
        itemRender={(treeItem: TreeItem) => {
          return <div className='hbox watch-mode-list-item'>
            <div className='watch-mode-list-item-title'>{treeItem.title}</div>
            <ToolbarButton icon='play' title='Run' onClick={() => runTreeItem(treeItem)} disabled={isRunningTest}></ToolbarButton>
          </div>;
        }}
        itemIcon={(treeItem: TreeItem) => {
          if (treeItem.kind === 'case' && treeItem.children?.length === 1)
            treeItem = treeItem.children[0];
          if (treeItem.kind === 'test') {
            const ok = treeItem.test.outcome() === 'expected';
            const failed = treeItem.test.results.length && treeItem.test.outcome() !== 'expected';
            const running = treeItem.test.results.some(r => r.duration === -1);
            if (running)
              return 'codicon-loading';
            if (ok)
              return 'codicon-check';
            if (failed)
              return 'codicon-error';
          } else {
            return treeItem.expanded ? 'codicon-chevron-down' : 'codicon-chevron-right';
          }
        }}
        itemIndent={(treeItem: TreeItem) => treeItem.kind === 'file' ? 0 : treeItem.kind === 'case' ? 1 : 2}
        selectedItem={selectedTreeItem}
        onAccepted={runTreeItem}
        onLeftArrow={(treeItem: TreeItem) => {
          if (treeItem.children && treeItem.expanded) {
            expandedItems.set(treeItem.id, false);
            setExpandedItems(new Map(expandedItems));
          } else {
            setSelectedTreeItemId(treeItem.parent?.id);
          }
        }}
        onRightArrow={(treeItem: TreeItem) => {
          if (treeItem.children) {
            expandedItems.set(treeItem.id, true);
            setExpandedItems(new Map(expandedItems));
          }
          setRootSuite({ ...rootSuite });
        }}
        onSelected={(treeItem: TreeItem) => {
          setSelectedTreeItemId(treeItem.id);
        }}
        onIconClicked={(treeItem: TreeItem) => {
          if (treeItem.kind === 'test')
            return;
          if (treeItem.expanded)
            expandedItems.set(treeItem.id, false);
          else
            expandedItems.set(treeItem.id, true);
          setExpandedItems(new Map(expandedItems));
        }}
        showNoItemsMessage={true}></ListView>
      {(rootSuite.value?.suites.length || 0) > 1 && <div style={{ flex: 'none', borderTop: '1px solid var(--vscode-panel-border)' }}>
        <Toolbar>
          <h3 className='title'>Projects</h3>
        </Toolbar>
        <ListView
          items={rootSuite.value!.suites}
          onSelected={(suite: Suite) => {
            const copy = [...projectNames];
            if (copy.includes(suite.title))
              copy.splice(copy.indexOf(suite.title), 1);
            else
              copy.push(suite.title);
            setProjectNames(copy);
          }}
          itemRender={(suite: Suite) => {
            return <label style={{ display: 'flex', pointerEvents: 'none' }}>
              <input type='checkbox' checked={projectNames.includes(suite.title)} />
              {suite.title}
            </label>;
          }}
        />
      </div>}
      {isRunningTest && <div className='status-line'>
        Running: {progress.total} tests | {progress.passed} passed | {progress.failed} failed
      </div>}
      {!isRunningTest && <div className='status-line'>
        Total: {visibleTestIds.size} tests
      </div>}
    </div>
  </SplitView>;
};

export const TraceView: React.FC<{
  testItem: TestItem | undefined,
  isRunningTest: boolean,
}> = ({ testItem, isRunningTest }) => {
  const [model, setModel] = React.useState<MultiTraceModel | undefined>();
  const [stepsProgress, setStepsProgress] = React.useState(0);
  updateStepsProgress = () => setStepsProgress(stepsProgress + 1);

  React.useEffect(() => {
    (async () => {
      if (!testItem) {
        setModel(undefined);
        return;
      }

      const result = testItem.test?.results?.[0];
      if (result) {
        const attachment = result.attachments.find(a => a.name === 'trace');
        if (attachment && attachment.path)
          loadSingleTraceFile(attachment.path).then(setModel);
        else
          setModel(stepsToModel(result));
      } else {
        setModel(undefined);
      }
    })();
  }, [testItem, isRunningTest, stepsProgress]);

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

  return <Workbench model={model} />;
};

declare global {
  interface Window {
    binding(data: any): Promise<void>;
  }
}

let receiver: TeleReporterReceiver | undefined;

const resetCollectingRootSuite = () => {
  let rootSuite: Suite;
  const progress: Progress = {
    total: 0,
    passed: 0,
    failed: 0,
  };
  receiver = new TeleReporterReceiver({
    onBegin: (config: FullConfig, suite: Suite) => {
      if (!rootSuite)
        rootSuite = suite;
      progress.passed = 0;
      progress.failed = 0;
      updateRootSuite(rootSuite, progress);
    },

    onTestBegin: () => {
      updateRootSuite(rootSuite, progress);
    },

    onTestEnd: (test: TestCase) => {
      if (test.outcome() === 'unexpected')
        ++progress.failed;
      else
        ++progress.passed;
      updateRootSuite(rootSuite, progress);
    },

    onStepBegin: () => {
      updateStepsProgress();
    },

    onStepEnd: () => {
      updateStepsProgress();
    },
  });
  sendMessageNoReply('list');
};

(window as any).dispatch = (message: any) => {
  if (message.method === 'fileChanged')
    runWatchedTests();
  else
    receiver?.dispatch(message);
};

const sendMessage = async (method: string, params: any) => {
  await (window as any).sendMessage({ method, params });
};

const sendMessageNoReply = (method: string, params?: any) => {
  sendMessage(method, params).catch((e: Error) => {
    // eslint-disable-next-line no-console
    console.error(e);
  });
};

const fileName = (treeItem?: TreeItem): string | undefined => {
  if (!treeItem)
    return;
  if (treeItem.kind === 'file')
    return treeItem.file;
  return fileName(treeItem.parent || undefined);
};

const collectTestIds = (treeItem?: TreeItem): string[] => {
  if (!treeItem)
    return [];
  const testIds: string[] = [];
  const visit = (treeItem: TreeItem) => {
    if (treeItem.kind === 'test')
      testIds.push(treeItem.id);
    treeItem.children?.forEach(visit);
  };
  visit(treeItem);
  return testIds;
};

type Progress = {
  total: number;
  passed: number;
  failed: number;
};

type TreeItemBase = {
  kind: 'file' | 'case' | 'test',
  id: string;
  title: string;
  parent: TreeItem | null;
  children?: TreeItem[];
  expanded?: boolean;
};

type FileItem = TreeItemBase & {
  kind: 'file',
  file: string;
};

type TestCaseItem = TreeItemBase & {
  kind: 'case',
};

type TestItem = TreeItemBase & {
  kind: 'test',
  test: TestCase;
};

type TreeItem = FileItem | TestCaseItem | TestItem;

function createTree(rootSuite: Suite | undefined, projectNames: string[]): FileItem[] {
  const fileItems = new Map<string, FileItem>();
  for (const projectSuite of rootSuite?.suites || []) {
    if (!projectNames.includes(projectSuite.title))
      continue;
    for (const fileSuite of projectSuite.suites) {
      const file = fileSuite.location!.file;

      let fileItem = fileItems.get(file);
      if (!fileItem) {
        fileItem = {
          kind: 'file',
          id: fileSuite.title,
          title: fileSuite.title,
          file,
          parent: null,
          children: [],
          expanded: false,
        };
        fileItems.set(fileSuite.location!.file, fileItem);
      }

      for (const test of fileSuite.allTests()) {
        const title = test.titlePath().slice(3).join(' › ');
        let testCaseItem = fileItem.children!.find(t => t.title === title);
        if (!testCaseItem) {
          testCaseItem = {
            kind: 'case',
            id: fileItem.id + ' / ' + title,
            title,
            parent: fileItem,
            children: [],
            expanded: false,
          };
          fileItem.children!.push(testCaseItem);
        }
        testCaseItem.children!.push({
          kind: 'test',
          id: test.id,
          title: projectSuite.title,
          parent: testCaseItem,
          test,
        });
      }
    }
  }
  return [...fileItems.values()];
}

function filterTree(fileItems: FileItem[], filterText: string): FileItem[] {
  const trimmedFilterText = filterText.trim();
  const filterTokens = trimmedFilterText.toLowerCase().split(' ');
  const result: FileItem[] = [];
  for (const fileItem of fileItems) {
    if (trimmedFilterText) {
      const filteredCases: TreeItem[] = [];
      for (const testCaseItem of fileItem.children!) {
        const fullTitle = (fileItem.title + ' ' + testCaseItem.title).toLowerCase();
        if (filterTokens.every(token => fullTitle.includes(token)))
          filteredCases.push(testCaseItem);
      }
      fileItem.children = filteredCases;
    }
    if (fileItem.children!.length)
      result.push(fileItem);
  }
  return result;
}

function flattenTree(fileItems: FileItem[], expandedItems: Map<string, boolean | undefined>, hasFilter: boolean): TreeItem[] {
  const result: TreeItem[] = [];
  for (const fileItem of fileItems) {
    result.push(fileItem);
    const expandState = expandedItems.get(fileItem.id);
    const autoExpandMatches = result.length < 100 && (hasFilter && expandState !== false);
    fileItem.expanded = expandState || autoExpandMatches;
    if (fileItem.expanded) {
      for (const testCaseItem of fileItem.children!) {
        result.push(testCaseItem);
        testCaseItem.expanded = !!expandedItems.get(testCaseItem.id);
        if (testCaseItem.expanded && testCaseItem.children!.length > 1)
          result.push(...testCaseItem.children!);
      }
    }
  }
  return result;
}

async function loadSingleTraceFile(url: string): Promise<MultiTraceModel> {
  const params = new URLSearchParams();
  params.set('trace', url);
  const response = await fetch(`contexts?${params.toString()}`);
  const contextEntries = await response.json() as ContextEntry[];
  return new MultiTraceModel(contextEntries);
}

function stepsToModel(result: TestResult): MultiTraceModel {
  let startTime = Number.MAX_VALUE;
  let endTime = Number.MIN_VALUE;
  const actions: trace.ActionTraceEvent[] = [];

  const flatSteps: TestStep[] = [];
  const visit = (step: TestStep) => {
    flatSteps.push(step);
    step.steps.forEach(visit);
  };
  result.steps.forEach(visit);

  for (const step of flatSteps) {
    let callId: string;
    if (step.category === 'pw:api')
      callId = `call@${actions.length}`;
    else if (step.category === 'expect')
      callId = `expect@${actions.length}`;
    else
      continue;
    const action: trace.ActionTraceEvent = {
      type: 'action',
      callId,
      startTime: step.startTime.getTime(),
      endTime: step.startTime.getTime() + step.duration,
      apiName: step.title,
      class: '',
      method: '',
      params: {},
      wallTime: step.startTime.getTime(),
      log: [],
      snapshots: [],
      error: step.error ? { name: 'Error', message: step.error.message || step.error.value || '' } : undefined,
    };
    if (startTime > action.startTime)
      startTime = action.startTime;
    if (endTime < action.endTime)
      endTime = action.endTime;
    actions.push(action);
  }

  const contextEntry: ContextEntry = {
    traceUrl: '',
    startTime,
    endTime,
    browserName: '',
    options: {
      viewport: undefined,
      deviceScaleFactor: undefined,
      isMobile: undefined,
      userAgent: undefined
    },
    pages: [],
    resources: [],
    actions,
    events: [],
    initializers: {},
    hasSource: false
  };

  return new MultiTraceModel([contextEntry]);
}
