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
import { TreeView } from '@web/components/treeView';
import type { TreeState } from '@web/components/treeView';
import { TeleReporterReceiver } from '../../../playwright-test/src/isomorphic/teleReceiver';
import type { FullConfig, Suite, TestCase, TestResult, TestStep, Location } from '../../../playwright-test/types/testReporter';
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
  const [projects, setProjects] = React.useState<Map<string, boolean>>(new Map());
  const [rootSuite, setRootSuite] = React.useState<{ value: Suite | undefined }>({ value: undefined });
  const [isRunningTest, setIsRunningTest] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<Progress>({ total: 0, passed: 0, failed: 0 });
  const [selectedTest, setSelectedTest] = React.useState<TestCase | undefined>(undefined);
  const [settingsVisible, setSettingsVisible] = React.useState<boolean>(false);
  const [isWatchingFiles, setIsWatchingFiles] = React.useState<boolean>(true);

  updateRootSuite = (rootSuite: Suite, { passed, failed }: Progress) => {
    for (const projectName of projects.keys()) {
      if (!rootSuite.suites.find(s => s.title === projectName))
        projects.delete(projectName);
    }
    for (const projectSuite of rootSuite.suites) {
      if (!projects.has(projectSuite.title))
        projects.set(projectSuite.title, false);
    }
    if (![...projects.values()].includes(true))
      projects.set(projects.entries().next().value[0], true);

    progress.passed = passed;
    progress.failed = failed;

    setRootSuite({ value: rootSuite });
    setProjects(new Map(projects));
    setProgress({ ...progress });
  };

  const runTests = (testIds: string[]) => {
    setProgress({ total: testIds.length, passed: 0, failed: 0 });
    setIsRunningTest(true);
    sendMessage('run', { testIds }).then(() => {
      setIsRunningTest(false);
    });
  };

  return <div className='vbox'>
    <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true}>
      <TraceView test={selectedTest}></TraceView>
      <div className='vbox watch-mode-sidebar'>
        <Toolbar>
          <div className='section-title' style={{ cursor: 'pointer' }} onClick={() => setSettingsVisible(false)}>Tests</div>
          <ToolbarButton icon='play' title='Run' onClick={runVisibleTests} disabled={isRunningTest}></ToolbarButton>
          <ToolbarButton icon='debug-stop' title='Stop' onClick={() => sendMessageNoReply('stop')} disabled={!isRunningTest}></ToolbarButton>
          <ToolbarButton icon='refresh' title='Reload' onClick={() => refreshRootSuite(true)} disabled={isRunningTest}></ToolbarButton>
          <ToolbarButton icon='eye-watch' title='Watch' toggled={isWatchingFiles} onClick={() => setIsWatchingFiles(!isWatchingFiles)}></ToolbarButton>
          <div className='spacer'></div>
          <ToolbarButton icon='gear' title='Toggle color mode' toggled={settingsVisible} onClick={() => { setSettingsVisible(!settingsVisible); }}></ToolbarButton>
        </Toolbar>
        <TestList
          projects={projects}
          rootSuite={rootSuite}
          isRunningTest={isRunningTest}
          isWatchingFiles={isWatchingFiles}
          runTests={runTests}
          onTestSelected={setSelectedTest}
          isVisible={!settingsVisible} />
        {settingsVisible && <SettingsView projects={projects} setProjects={setProjects} onClose={() => setSettingsVisible(false)}></SettingsView>}
      </div>
    </SplitView>
    <div className='status-line'>
        Running: {progress.total} tests | {progress.passed} passed | {progress.failed} failed
    </div>
  </div>;
};

const TreeListView = TreeView<TreeItem>;

export const TestList: React.FC<{
  projects: Map<string, boolean>,
  rootSuite: { value: Suite | undefined },
  runTests: (testIds: string[]) => void,
  isRunningTest: boolean,
  isWatchingFiles: boolean,
  isVisible: boolean
  onTestSelected: (test: TestCase | undefined) => void,
}> = ({ projects, rootSuite, runTests, isRunningTest, isWatchingFiles, isVisible, onTestSelected }) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const [filterText, setFilterText] = React.useState<string>('');
  const [selectedTreeItemId, setSelectedTreeItemId] = React.useState<string | undefined>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    refreshRootSuite(true);
  }, []);

  const { rootItem, treeItemMap, visibleTestIds } = React.useMemo(() => {
    const rootItem = createTree(rootSuite.value, projects);
    filterTree(rootItem, filterText);
    const treeItemMap = new Map<string, TreeItem>();
    const visibleTestIds = new Set<string>();
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'test')
        visibleTestIds.add(treeItem.id);
      treeItem.children?.forEach(visit);
      treeItemMap.set(treeItem.id, treeItem);
    };
    visit(rootItem);
    hideOnlyTests(rootItem);
    return { rootItem, treeItemMap, visibleTestIds };
  }, [filterText, rootSuite, projects]);

  runVisibleTests = () => runTests([...visibleTestIds]);

  const { selectedTreeItem } = React.useMemo(() => {
    const selectedTreeItem = selectedTreeItemId ? treeItemMap.get(selectedTreeItemId) : undefined;
    let selectedTest: TestCase | undefined;
    if (selectedTreeItem?.kind === 'test')
      selectedTest = selectedTreeItem.test;
    else if (selectedTreeItem?.kind === 'case' && selectedTreeItem.tests.length === 1)
      selectedTest = selectedTreeItem.tests[0];
    onTestSelected(selectedTest);
    return { selectedTreeItem };
  }, [onTestSelected, selectedTreeItemId, treeItemMap]);

  React.useEffect(() => {
    sendMessageNoReply('watch', { fileName: isWatchingFiles ? fileName(selectedTreeItem) : undefined });
  }, [selectedTreeItem, isWatchingFiles]);

  const runTreeItem = (treeItem: TreeItem) => {
    // expandedItems.set(treeItem.id, true);
    setSelectedTreeItemId(treeItem.id);
    runTests(collectTestIds(treeItem));
  };

  runWatchedTests = () => {
    runTests(collectTestIds(selectedTreeItem));
  };

  if (!isVisible)
    return <></>;

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
    <TreeListView
      treeState={treeState}
      setTreeState={setTreeState}
      rootItem={rootItem}
      render={treeItem => {
        return <div className='hbox watch-mode-list-item'>
          <div className='watch-mode-list-item-title'>{treeItem.title}</div>
          <ToolbarButton icon='play' title='Run' onClick={() => runTreeItem(treeItem)} disabled={isRunningTest}></ToolbarButton>
          <ToolbarButton icon='go-to-file' title='Open in VS Code' onClick={() => sendMessageNoReply('open', { location: locationToOpen(treeItem) })}></ToolbarButton>
        </div>;
      }}
      icon={treeItem => {
        if (treeItem.status === 'running')
          return 'codicon-loading';
        if (treeItem.status === 'failed')
          return 'codicon-error';
        if (treeItem.status === 'passed')
          return 'codicon-check';
        return 'codicon-circle-outline';
      }}
      selectedItem={selectedTreeItem}
      onAccepted={runTreeItem}
      onSelected={treeItem => {
        setSelectedTreeItemId(treeItem.id);
      }}
      noItemsMessage='No tests' />
  </div>;
};

export const SettingsView: React.FC<{
  projects: Map<string, boolean>,
  setProjects: (projectNames: Map<string, boolean>) => void,
  onClose: () => void,
}> = ({ projects, setProjects, onClose }) => {
  return <div className='vbox'>
    <div className='hbox' style={{ flex: 'none' }}>
      <div className='section-title' style={{ marginTop: 10 }}>Projects</div>
      <div className='spacer'></div>
      <ToolbarButton icon='close' title='Close settings' toggled={false} onClick={onClose}></ToolbarButton>
    </div>
    {[...projects.entries()].map(([projectName, value]) => {
      return <div style={{ display: 'flex', alignItems: 'center', lineHeight: '24px' }}>
        <input id={`project-${projectName}`} type='checkbox' checked={value} style={{ cursor: 'pointer' }} onClick={() => {
          const copy = new Map(projects);
          copy.set(projectName, !copy.get(projectName));
          if (![...copy.values()].includes(true))
            copy.set(projectName, true);
          setProjects(copy);
        }}/>
        <label htmlFor={`project-${projectName}`} style={{ cursor: 'pointer' }}>
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
  test: TestCase | undefined,
}> = ({ test }) => {
  const [model, setModel] = React.useState<MultiTraceModel | undefined>();
  const [stepsProgress, setStepsProgress] = React.useState(0);
  updateStepsProgress = () => setStepsProgress(stepsProgress + 1);

  React.useEffect(() => {
    (async () => {
      if (!test) {
        setModel(undefined);
        return;
      }

      const result = test.results?.[0];
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
  }, [test, stepsProgress]);

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

const refreshRootSuite = (eraseResults: boolean) => {
  if (!eraseResults) {
    sendMessageNoReply('list');
    return;
  }

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
  if (message.method === 'listChanged') {
    refreshRootSuite(false);
    return;
  }

  if (message.method === 'fileChanged') {
    runWatchedTests();
    return;
  }

  if (message.method === 'stdio') {
    if (message.params.buffer) {
      const data = atob(message.params.buffer);
      xtermDataSource.write(data);
    } else {
      xtermDataSource.write(message.params.text);
    }
    return;
  }

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

const locationToOpen = (treeItem?: TreeItem) => {
  if (!treeItem)
    return;
  if (treeItem.kind === 'test')
    return treeItem.test.location.file + ':' + treeItem.test.location.line;
  if (treeItem.kind === 'case')
    return treeItem.location.file + ':' + treeItem.location.line;
  if (treeItem.kind === 'file')
    return treeItem.file;
};

const collectTestIds = (treeItem?: TreeItem): string[] => {
  if (!treeItem)
    return [];
  const testIds: string[] = [];
  const visit = (treeItem: TreeItem) => {
    if (treeItem.kind === 'case')
      testIds.push(...treeItem.tests.map(t => t.id));
    else if (treeItem.kind === 'test')
      testIds.push(treeItem.id);
    else
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
  kind: 'root' | 'file' | 'case' | 'test',
  id: string;
  title: string;
  parent: TreeItem | null;
  children: TreeItem[];
  status: 'none' | 'running' | 'passed' | 'failed';
};

type RootItem = TreeItemBase & {
  kind: 'root',
  children: FileItem[];
};

type FileItem = TreeItemBase & {
  kind: 'file',
  file: string;
  children: TestCaseItem[];
};

type TestCaseItem = TreeItemBase & {
  kind: 'case',
  tests: TestCase[];
  location: Location,
};

type TestItem = TreeItemBase & {
  kind: 'test',
  test: TestCase;
};

type TreeItem = RootItem | FileItem | TestCaseItem | TestItem;

function createTree(rootSuite: Suite | undefined, projects: Map<string, boolean>): RootItem {
  const rootItem: RootItem = {
    kind: 'root',
    id: 'root',
    title: '',
    parent: null,
    children: [],
    status: 'none',
  };
  const fileItems = new Map<string, FileItem>();
  for (const projectSuite of rootSuite?.suites || []) {
    if (!projects.get(projectSuite.title))
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
          status: 'none',
        };
        fileItems.set(fileSuite.location!.file, fileItem);
        rootItem.children.push(fileItem);
      }

      for (const test of fileSuite.allTests()) {
        const title = test.titlePath().slice(3).join(' › ');
        let testCaseItem = fileItem.children.find(t => t.title === title) as TestCaseItem;
        if (!testCaseItem) {
          testCaseItem = {
            kind: 'case',
            id: fileItem.id + ' / ' + title,
            title,
            parent: fileItem,
            children: [],
            tests: [],
            location: test.location,
            status: 'none',
          };
          fileItem.children.push(testCaseItem);
        }

        let status: 'none' | 'running' | 'passed' | 'failed' = 'none';
        if (test.results.some(r => r.duration === -1))
          status = 'running';
        else if (test.results.length && test.outcome() !== 'expected')
          status = 'failed';
        else if (test.outcome() === 'expected')
          status = 'passed';

        testCaseItem.tests.push(test);
        testCaseItem.children.push({
          kind: 'test',
          id: test.id,
          title: projectSuite.title,
          parent: testCaseItem,
          test,
          children: [],
          status,
        });
      }
      (fileItem.children as TestCaseItem[]).sort((a, b) => a.location.line - b.location.line);
    }
  }

  const propagateStatus = (treeItem: TreeItem) => {
    for (const child of treeItem.children)
      propagateStatus(child);

    let allPassed = treeItem.children.length > 0;
    let hasFailed = false;
    let hasRunning = false;

    for (const child of treeItem.children) {
      allPassed = allPassed && child.status === 'passed';
      hasFailed = hasFailed || child.status === 'failed';
      hasRunning = hasRunning || child.status === 'running';
    }

    if (hasRunning)
      treeItem.status = 'running';
    else if (hasFailed)
      treeItem.status = 'failed';
    else if (allPassed)
      treeItem.status = 'passed';
  };
  propagateStatus(rootItem);
  return rootItem;
}

function filterTree(rootItem: RootItem, filterText: string) {
  const trimmedFilterText = filterText.trim();
  const filterTokens = trimmedFilterText.toLowerCase().split(' ');
  const result: FileItem[] = [];
  for (const fileItem of rootItem.children) {
    if (trimmedFilterText) {
      const filteredCases: TestCaseItem[] = [];
      for (const testCaseItem of fileItem.children) {
        const fullTitle = (fileItem.title + ' ' + testCaseItem.title).toLowerCase();
        if (filterTokens.every(token => fullTitle.includes(token)))
          filteredCases.push(testCaseItem);
      }
      fileItem.children = filteredCases;
    }
    if (fileItem.children.length)
      result.push(fileItem);
  }
  rootItem.children = result;
}

function hideOnlyTests(rootItem: RootItem) {
  const visit = (treeItem: TreeItem) => {
    if (treeItem.kind === 'case' && treeItem.children.length === 1)
      treeItem.children = [];
    else
      treeItem.children.forEach(visit);
  };
  visit(rootItem);
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
