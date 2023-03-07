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
import type { XtermDataSource } from '@web/components/xtermWrapper';
import { XtermWrapper } from '@web/components/xtermWrapper';

let updateRootSuite: (rootSuite: Suite, progress: Progress) => void = () => {};
let updateStepsProgress: () => void = () => {};
let runWatchedTests = () => {};
let runVisibleTests = () => {};

const xtermDataSource: XtermDataSource = {
  pending: [],
  clear: () => {},
  write: data => xtermDataSource.pending.push(data),
  resize: (cols: number, rows: number) => sendMessageNoReply('resizeTerminal', { cols, rows }),
};

export const WatchModeView: React.FC<{}> = ({
}) => {
  const [projectNames, setProjectNames] = React.useState<string[]>([]);
  const [rootSuite, setRootSuite] = React.useState<{ value: Suite | undefined }>({ value: undefined });
  const [isRunningTest, setIsRunningTest] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<Progress>({ total: 0, passed: 0, failed: 0 });
  const [selectedTestItem, setSelectedTestItem] = React.useState<TestItem | undefined>(undefined);
  const [settingsVisible, setSettingsVisible] = React.useState<boolean>(false);

  updateRootSuite = (rootSuite: Suite, { passed, failed }: Progress) => {
    setRootSuite({ value: rootSuite });
    progress.passed = passed;
    progress.failed = failed;
    setProgress({ ...progress });
  };

  const runTests = (testIds: string[]) => {
    setProgress({ total: testIds.length, passed: 0, failed: 0 });
    setIsRunningTest(true);
    sendMessage('run', { testIds }).then(() => {
      setIsRunningTest(false);
    });
  };

  React.useEffect(() => {
    if (projectNames.length === 0 && rootSuite.value?.suites.length)
      setProjectNames([rootSuite.value?.suites[0].title]);
  }, [projectNames, rootSuite]);

  return <div className='vbox'>
    <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true}>
      <TraceView testItem={selectedTestItem}></TraceView>
      <div className='vbox watch-mode-sidebar'>
        <Toolbar>
          <div className='section-title' style={{ cursor: 'pointer' }} onClick={() => setSettingsVisible(false)}>Tests</div>
          <ToolbarButton icon='play' title='Run' onClick={runVisibleTests} disabled={isRunningTest}></ToolbarButton>
          <ToolbarButton icon='debug-stop' title='Stop' onClick={() => sendMessageNoReply('stop')} disabled={!isRunningTest}></ToolbarButton>
          <ToolbarButton icon='refresh' title='Reload' onClick={resetCollectingRootSuite} disabled={isRunningTest}></ToolbarButton>
          <div className='spacer'></div>
          <ToolbarButton icon='gear' title='Toggle color mode' toggled={settingsVisible} onClick={() => { setSettingsVisible(!settingsVisible); }}></ToolbarButton>
        </Toolbar>
        { !settingsVisible && <TestList
          projectNames={projectNames}
          rootSuite={rootSuite}
          isRunningTest={isRunningTest}
          runTests={runTests}
          onTestItemSelected={setSelectedTestItem} />}
        {settingsVisible && <SettingsView projectNames={projectNames} setProjectNames={setProjectNames} onClose={() => setSettingsVisible(false)}></SettingsView>}
      </div>
    </SplitView>
    <div className='status-line'>
        Running: {progress.total} tests | {progress.passed} passed | {progress.failed} failed
    </div>
  </div>;
};

export const TestList: React.FC<{
  projectNames: string[],
  rootSuite: { value: Suite | undefined },
  runTests: (testIds: string[]) => void,
  isRunningTest: boolean,
  onTestItemSelected: (test: TestItem | undefined) => void,
}> = ({ projectNames, rootSuite, runTests, isRunningTest, onTestItemSelected }) => {
  const [filterText, setFilterText] = React.useState<string>('');
  const [selectedTreeItemId, setSelectedTreeItemId] = React.useState<string | undefined>();
  const [expandedItems, setExpandedItems] = React.useState<Map<string, boolean>>(new Map());
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    resetCollectingRootSuite();
  }, []);

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

  runVisibleTests = () => runTests([...visibleTestIds]);

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

  onTestItemSelected(selectedTestItem);

  const runTreeItem = (treeItem: TreeItem) => {
    expandedItems.set(treeItem.id, true);
    setSelectedTreeItemId(treeItem.id);
    runTests(collectTestIds(treeItem));
  };

  runWatchedTests = () => {
    runTests(collectTestIds(selectedTreeItem));
  };

  return <div className='vbox'>
    <Toolbar>
      <input ref={inputRef} type='search' placeholder='Filter (e.g. text, @tag)' spellCheck={false} value={filterText}
        onChange={e => {
          setFilterText(e.target.value);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter')
            runVisibleTests();
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
      noItemsMessage='No tests' />
  </div>;
};

export const SettingsView: React.FC<{
  projectNames: string[],
  setProjectNames: (projectNames: string[]) => void,
  onClose: () => void,
}> = ({ projectNames, setProjectNames, onClose }) => {
  return <div className='vbox'>
    <div className='hbox' style={{ flex: 'none' }}>
      <div className='section-title' style={{ marginTop: 10 }}>Projects</div>
      <div className='spacer'></div>
      <ToolbarButton icon='close' title='Close settings' toggled={false} onClick={onClose}></ToolbarButton>
    </div>
    {projectNames.map(projectName => {
      return <div style={{ display: 'flex', alignItems: 'center', lineHeight: '24px' }}>
        <input id={`project-${projectName}`} type='checkbox' checked={projectNames.includes(projectName)} onClick={() => {
          const copy = [...projectNames];
          if (copy.includes(projectName))
            copy.splice(copy.indexOf(projectName), 1);
          else
            copy.push(projectName);
          setProjectNames(copy);
        }} style={{ margin: '0 5px 0 10px' }} />
        <label htmlFor={`project-${projectName}`}>
          {projectName}
        </label>
      </div>;
    })}
    <div className='section-title'>Appearance</div>
    <div style={{ marginLeft: 3 }}>
      <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}>Toggle color mode</ToolbarButton>
    </div>
  </div>;
};

export const TraceView: React.FC<{
  testItem: TestItem | undefined,
}> = ({ testItem }) => {
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
  }, [testItem, stepsProgress]);

  const xterm = <XtermWrapper source={xtermDataSource}></XtermWrapper>;
  return <Workbench model={model} output={xterm} rightToolbar={[
    <ToolbarButton icon='trash' title='Clear output' onClick={() => xtermDataSource.clear()}></ToolbarButton>,
  ]}/>;
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
  if (message.method === 'fileChanged') {
    runWatchedTests();
  } else if (message.method === 'stdio') {
    if (message.params.buffer) {
      const data = atob(message.params.buffer);
      xtermDataSource.write(data);
    } else {
      xtermDataSource.write(message.params.text);
    }
  } else {
    receiver?.dispatch(message);
  }
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
