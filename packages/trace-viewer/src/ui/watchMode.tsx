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
import { TeleReporterReceiver, TeleSuite } from '@testIsomorphic/teleReceiver';
import type { TeleTestCase } from '@testIsomorphic/teleReceiver';
import type { FullConfig, Suite, TestCase, TestResult, Location } from '../../../playwright-test/types/testReporter';
import { SplitView } from '@web/components/splitView';
import { MultiTraceModel } from './modelUtil';
import './watchMode.css';
import { ToolbarButton } from '@web/components/toolbarButton';
import { Toolbar } from '@web/components/toolbar';
import type { ContextEntry } from '../entries';
import type { XtermDataSource } from '@web/components/xtermWrapper';
import { XtermWrapper } from '@web/components/xtermWrapper';
import { Expandable } from '@web/components/expandable';
import { toggleTheme } from '@web/theme';
import { artifactsFolderName } from '@testIsomorphic/folders';

let updateRootSuite: (rootSuite: Suite, progress: Progress) => void = () => {};
let runWatchedTests = (fileName: string) => {};
let xtermSize = { cols: 80, rows: 24 };

const xtermDataSource: XtermDataSource = {
  pending: [],
  clear: () => {},
  write: data => xtermDataSource.pending.push(data),
  resize: (cols: number, rows: number) => {
    xtermSize = { cols, rows };
    sendMessageNoReply('resizeTerminal', { cols, rows });
  },
};

export const WatchModeView: React.FC<{}> = ({
}) => {
  const [filterText, setFilterText] = React.useState<string>('');
  const [isShowingOutput, setIsShowingOutput] = React.useState<boolean>(false);

  const [statusFilters, setStatusFilters] = React.useState<Map<string, boolean>>(new Map([
    ['passed', false],
    ['failed', false],
    ['skipped', false],
  ]));
  const [projectFilters, setProjectFilters] = React.useState<Map<string, boolean>>(new Map());
  const [rootSuite, setRootSuite] = React.useState<{ value: Suite | undefined }>({ value: undefined });
  const [progress, setProgress] = React.useState<Progress>({ total: 0, passed: 0, failed: 0, skipped: 0 });
  const [selectedTest, setSelectedTest] = React.useState<TestCase | undefined>(undefined);
  const [visibleTestIds, setVisibleTestIds] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [runningState, setRunningState] = React.useState<{ testIds: Set<string>, itemSelectedByUser?: boolean }>();

  const inputRef = React.useRef<HTMLInputElement>(null);

  const reloadTests = () => {
    setIsLoading(true);
    updateRootSuite(new TeleSuite('', 'root'), { total: 0, passed: 0, failed: 0, skipped: 0 });
    refreshRootSuite(true).then(() => {
      setIsLoading(false);
    });
  };

  React.useEffect(() => {
    inputRef.current?.focus();
    reloadTests();
  }, []);

  updateRootSuite = (rootSuite: Suite, newProgress: Progress) => {
    for (const projectName of projectFilters.keys()) {
      if (!rootSuite.suites.find(s => s.title === projectName))
        projectFilters.delete(projectName);
    }
    for (const projectSuite of rootSuite.suites) {
      if (!projectFilters.has(projectSuite.title))
        projectFilters.set(projectSuite.title, false);
    }
    if (projectFilters.size && ![...projectFilters.values()].includes(true))
      projectFilters.set(projectFilters.entries().next().value[0], true);

    setRootSuite({ value: rootSuite });
    setProjectFilters(new Map(projectFilters));
    setProgress(newProgress);
  };

  const runTests = (testIds: string[]) => {
    // Clear test results.
    {
      const testIdSet = new Set(testIds);
      for (const test of rootSuite.value?.allTests() || []) {
        if (testIdSet.has(test.id))
          (test as TeleTestCase)._createTestResult('pending');
      }
      setRootSuite({ ...rootSuite });
    }

    const time = '  [' + new Date().toLocaleTimeString() + ']';
    xtermDataSource.write('\x1B[2m—'.repeat(Math.max(0, xtermSize.cols - time.length)) + time + '\x1B[22m');
    setProgress({ total: testIds.length, passed: 0, failed: 0, skipped: 0 });
    setRunningState({ testIds: new Set(testIds) });
    sendMessage('run', { testIds }).then(() => {
      setRunningState(undefined);
    });
  };

  const isRunningTest = !!runningState;
  const result = selectedTest?.results[0];
  const outputDir = selectedTest ? outputDirForTestCase(selectedTest) : undefined;

  return <div className='vbox watch-mode'>
    <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true}>
      <div className='vbox'>
        <div className={'vbox' + (isShowingOutput ? '' : ' hidden')}>
          <Toolbar>
            <ToolbarButton icon='circle-slash' title='Clear output' onClick={() => xtermDataSource.clear()}></ToolbarButton>
            <div className='spacer'></div>
            <ToolbarButton icon='close' title='Close' onClick={() => setIsShowingOutput(false)}></ToolbarButton>
          </Toolbar>
          <XtermWrapper source={xtermDataSource}></XtermWrapper>;
        </div>
        <div className={'vbox' + (isShowingOutput ? ' hidden' : '')}>
          <TraceView outputDir={outputDir} testCase={selectedTest} result={result} />
        </div>
      </div>
      <div className='vbox watch-mode-sidebar'>
        <Toolbar>
          <img src='icon-32x32.png' />
          <div className='section-title'>Playwright</div>
          <div className='spacer'></div>
          <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()} />
          <ToolbarButton icon='refresh' title='Reload' onClick={() => reloadTests()} disabled={isRunningTest || isLoading}></ToolbarButton>
          <ToolbarButton icon='terminal' title='Toggle output' toggled={isShowingOutput} onClick={() => { setIsShowingOutput(!isShowingOutput); }} />
        </Toolbar>
        <FiltersView
          filterText={filterText}
          setFilterText={setFilterText}
          statusFilters={statusFilters}
          setStatusFilters={setStatusFilters}
          projectFilters={projectFilters}
          setProjectFilters={setProjectFilters}
          runTests={() => runTests(visibleTestIds)} />
        <Toolbar>
          <div className='section-title'>Tests</div>
          <div className='spacer'></div>
          <ToolbarButton icon='play' title='Run all' onClick={() => runTests(visibleTestIds)} disabled={isRunningTest || isLoading}></ToolbarButton>
          <ToolbarButton icon='debug-stop' title='Stop' onClick={() => sendMessageNoReply('stop')} disabled={!isRunningTest || isLoading}></ToolbarButton>
        </Toolbar>
        <TestList
          statusFilters={statusFilters}
          projectFilters={projectFilters}
          filterText={filterText}
          rootSuite={rootSuite}
          runningState={runningState}
          runTests={runTests}
          onTestSelected={setSelectedTest}
          setVisibleTestIds={setVisibleTestIds} />
      </div>
    </SplitView>
    <div className='status-line'>
      <div>Total: {progress.total}</div>
      {isRunningTest && <div><span className='codicon codicon-loading'></span>{`Running ${visibleTestIds.length}\u2026`}</div>}
      {isLoading && <div><span className='codicon codicon-loading'></span> {'Loading\u2026'}</div>}
      {!isRunningTest && <div>Showing: {visibleTestIds.length}</div>}
      <div>{progress.passed} passed</div>
      <div>{progress.failed} failed</div>
      <div>{progress.skipped} skipped</div>
    </div>
  </div>;
};

const FiltersView: React.FC<{
  filterText: string;
  setFilterText: (text: string) => void;
  statusFilters: Map<string, boolean>;
  setStatusFilters: (filters: Map<string, boolean>) => void;
  projectFilters: Map<string, boolean>;
  setProjectFilters: (filters: Map<string, boolean>) => void;
  runTests: () => void;
}> = ({ filterText, setFilterText, statusFilters, setStatusFilters, projectFilters, setProjectFilters, runTests }) => {
  const [expanded, setExpanded] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const statusLine = [...statusFilters.entries()].filter(([_, v]) => v).map(([s]) => s).join(' ') || 'all';
  const projectsLine = [...projectFilters.entries()].filter(([_, v]) => v).map(([p]) => p).join(' ') || 'all';
  return <div className='filters'>
    <Expandable
      expanded={expanded}
      setExpanded={setExpanded}
      title={<input ref={inputRef} type='search' placeholder='Filter (e.g. text, @tag)' spellCheck={false} value={filterText}
        onChange={e => {
          setFilterText(e.target.value);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter')
            runTests();
        }} />}>
      {<div className='filter-title' title={statusLine} onClick={() => setExpanded(false)}><span className='filter-label'>Status:</span> {statusLine}</div>}
      {[...statusFilters.entries()].map(([status, value]) => {
        return <div className='filter-entry'>
          <label>
            <input type='checkbox' checked={value} onClick={() => {
              const copy = new Map(statusFilters);
              copy.set(status, !copy.get(status));
              setStatusFilters(copy);
            }}/>
            <div>{status}</div>
          </label>
        </div>;
      })}

      {<div className='filter-title' title={projectsLine}><span className='filter-label'>Projects:</span> {projectsLine}</div>}
      {[...projectFilters.entries()].map(([projectName, value]) => {
        return <div className='filter-entry'>
          <label>
            <input type='checkbox' checked={value} onClick={() => {
              const copy = new Map(projectFilters);
              copy.set(projectName, !copy.get(projectName));
              setProjectFilters(copy);
            }}/>
            <div>{projectName}</div>
          </label>
        </div>;
      })}
    </Expandable>
    {!expanded && <div className='filter-summary' title={'Status: ' + statusLine + '\nProjects: ' + projectsLine} onClick={() => setExpanded(true)}>
      <span className='filter-label'>Status:</span> {statusLine}
      <span className='filter-label'>Projects:</span> {projectsLine}
    </div>}
  </div>;
};

const TestTreeView = TreeView<TreeItem>;

const TestList: React.FC<{
  statusFilters: Map<string, boolean>,
  projectFilters: Map<string, boolean>,
  filterText: string,
  rootSuite: { value: Suite | undefined },
  runTests: (testIds: string[]) => void,
  runningState?: { testIds: Set<string>, itemSelectedByUser?: boolean },
  setVisibleTestIds: (testIds: string[]) => void,
  onTestSelected: (test: TestCase | undefined) => void,
}> = ({ statusFilters, projectFilters, filterText, rootSuite, runTests, runningState, onTestSelected, setVisibleTestIds }) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const [selectedTreeItemId, setSelectedTreeItemId] = React.useState<string | undefined>();
  const [watchedTreeIds] = React.useState<Set<string>>(new Set());

  const { rootItem, treeItemMap } = React.useMemo(() => {
    const rootItem = createTree(rootSuite.value, projectFilters);
    filterTree(rootItem, filterText, statusFilters);
    hideOnlyTests(rootItem);
    const treeItemMap = new Map<string, TreeItem>();
    const visibleTestIds = new Set<string>();
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'case')
        treeItem.tests.forEach(t => visibleTestIds.add(t.id));
      treeItem.children.forEach(visit);
      treeItemMap.set(treeItem.id, treeItem);
    };
    visit(rootItem);
    setVisibleTestIds([...visibleTestIds]);
    return { rootItem, treeItemMap };
  }, [filterText, rootSuite, statusFilters, projectFilters, setVisibleTestIds]);

  React.useEffect(() => {
    // Look for a first failure within the run batch to select it.
    if (!runningState || runningState.itemSelectedByUser)
      return;
    let selectedTreeItem: TreeItem | undefined;
    const visit = (treeItem: TreeItem) => {
      treeItem.children.forEach(visit);
      if (selectedTreeItem)
        return;
      if (treeItem.status === 'failed') {
        if (treeItem.kind === 'test' && runningState.testIds.has(treeItem.test.id))
          selectedTreeItem = treeItem;
        else if (treeItem.kind === 'case' && runningState.testIds.has(treeItem.tests[0]?.id))
          selectedTreeItem = treeItem;
      }
    };
    visit(rootItem);

    if (selectedTreeItem)
      setSelectedTreeItemId(selectedTreeItem.id);
  }, [runningState, setSelectedTreeItemId, rootItem]);

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

  const setWatchedTreeIds = (watchedTreeIds: Set<string>) => {
    const fileNames = new Set<string>();
    for (const itemId of watchedTreeIds) {
      const treeItem = treeItemMap.get(itemId)!;
      fileNames.add(fileNameForTreeItem(treeItem)!);
    }
    sendMessageNoReply('watch', { fileNames: [...fileNames] });
  };

  const runTreeItem = (treeItem: TreeItem) => {
    setSelectedTreeItemId(treeItem.id);
    runTests(collectTestIds(treeItem));
  };

  runWatchedTests = (fileName: string) => {
    const testIds: string[] = [];
    for (const treeId of watchedTreeIds) {
      const treeItem = treeItemMap.get(treeId)!;
      if (fileNameForTreeItem(treeItem) === fileName)
        testIds.push(...collectTestIds(treeItem));
    }
    runTests(testIds);
  };

  return <TestTreeView
    treeState={treeState}
    setTreeState={setTreeState}
    rootItem={rootItem}
    dataTestId='test-tree'
    render={treeItem => {
      return <div className='hbox watch-mode-list-item'>
        <div className='watch-mode-list-item-title'>{treeItem.title}</div>
        <ToolbarButton icon='play' title='Run' onClick={() => runTreeItem(treeItem)} disabled={!!runningState}></ToolbarButton>
        <ToolbarButton icon='go-to-file' title='Open in VS Code' onClick={() => sendMessageNoReply('open', { location: locationToOpen(treeItem) })}></ToolbarButton>
        <ToolbarButton icon='eye' title='Watch' onClick={() => {
          if (watchedTreeIds.has(treeItem.id))
            watchedTreeIds.delete(treeItem.id);
          else
            watchedTreeIds.add(treeItem.id);
          setWatchedTreeIds(watchedTreeIds);
        }} toggled={watchedTreeIds.has(treeItem.id)}></ToolbarButton>
      </div>;
    }}
    icon={treeItem => {
      if (treeItem.status === 'running')
        return 'codicon-loading';
      if (treeItem.status === 'failed')
        return 'codicon-error';
      if (treeItem.status === 'passed')
        return 'codicon-check';
      if (treeItem.status === 'skipped')
        return 'codicon-circle-slash';
      return 'codicon-circle-outline';
    }}
    selectedItem={selectedTreeItem}
    onAccepted={runTreeItem}
    onSelected={treeItem => {
      if (runningState)
        runningState.itemSelectedByUser = true;
      setSelectedTreeItemId(treeItem.id);
    }}
    autoExpandDeep={!!filterText}
    noItemsMessage='No tests' />;
};

const TraceView: React.FC<{
  outputDir: string | undefined,
  testCase: TestCase | undefined,
  result: TestResult | undefined,
}> = ({ outputDir, testCase, result }) => {
  const [model, setModel] = React.useState<MultiTraceModel | undefined>();
  const [counter, setCounter] = React.useState(0);
  const pollTimer = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (pollTimer.current)
      clearTimeout(pollTimer.current);

    if (!result) {
      setModel(undefined);
      return;
    }

    // Test finished.
    const attachment = result && result.duration >= 0 && result.attachments.find(a => a.name === 'trace');
    if (attachment && attachment.path) {
      loadSingleTraceFile(attachment.path).then(model => setModel(model));
      return;
    }

    if (!outputDir) {
      setModel(undefined);
      return;
    }

    const traceLocation = `${outputDir}/${artifactsFolderName(result!.workerIndex)}/traces/${testCase?.id}.json`;
    // Start polling running test.
    pollTimer.current = setTimeout(async () => {
      try {
        const model = await loadSingleTraceFile(traceLocation);
        setModel(model);
      } catch {
        setModel(undefined);
      } finally {
        setCounter(counter + 1);
      }
    }, 250);
    return () => {
      if (pollTimer.current)
        clearTimeout(pollTimer.current);
    };
  }, [result, outputDir, testCase, setModel, counter, setCounter]);

  return <Workbench key='workbench' model={model} hideTimelineBars={true} hideStackFrames={true} showSourcesFirst={true} />;
};

declare global {
  interface Window {
    binding(data: any): Promise<void>;
  }
}

let receiver: TeleReporterReceiver | undefined;

let throttleTimer: NodeJS.Timeout | undefined;
let throttleData: { rootSuite: Suite, progress: Progress } | undefined;
const throttledAction = () => {
  clearTimeout(throttleTimer);
  throttleTimer = undefined;
  updateRootSuite(throttleData!.rootSuite, throttleData!.progress);
};

const throttleUpdateRootSuite = (rootSuite: Suite, progress: Progress, immediate = false) => {
  throttleData = { rootSuite, progress };
  if (immediate)
    throttledAction();
  else if (!throttleTimer)
    throttleTimer = setTimeout(throttledAction, 250);
};

const refreshRootSuite = (eraseResults: boolean): Promise<void> => {
  if (!eraseResults)
    return sendMessage('list', {});

  let rootSuite: Suite;
  const progress: Progress = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };
  receiver = new TeleReporterReceiver({
    onBegin: (config: FullConfig, suite: Suite) => {
      if (!rootSuite)
        rootSuite = suite;
      progress.total = suite.allTests().length;
      progress.passed = 0;
      progress.failed = 0;
      progress.skipped = 0;
      throttleUpdateRootSuite(rootSuite, progress, true);
    },

    onEnd: () => {
      throttleUpdateRootSuite(rootSuite, progress, true);
    },

    onTestBegin: () => {
      throttleUpdateRootSuite(rootSuite, progress);
    },

    onTestEnd: (test: TestCase) => {
      if (test.outcome() === 'skipped')
        ++progress.skipped;
      else if (test.outcome() === 'unexpected')
        ++progress.failed;
      else
        ++progress.passed;
      throttleUpdateRootSuite(rootSuite, progress);
    },
  });
  return sendMessage('list', {});
};

(window as any).dispatch = (message: any) => {
  if (message.method === 'listChanged') {
    refreshRootSuite(false).catch(() => {});
    return;
  }

  if (message.method === 'fileChanged') {
    runWatchedTests(message.params.fileName);
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

const outputDirForTestCase = (testCase: TestCase): string | undefined => {
  for (let suite: Suite | undefined = testCase.parent; suite; suite = suite.parent) {
    if (suite.project())
      return suite.project()?.outputDir;
  }
  return undefined;
};

const fileNameForTreeItem = (treeItem?: TreeItem): string | undefined => {
  return treeItem?.location.file;
};

const locationToOpen = (treeItem?: TreeItem) => {
  if (!treeItem)
    return;
  return treeItem.location.file + ':' + treeItem.location.line;
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
  skipped: number;
};

type TreeItemBase = {
  kind: 'root' | 'group' | 'case' | 'test',
  id: string;
  title: string;
  location: Location,
  parent: TreeItem | undefined;
  children: TreeItem[];
  status: 'none' | 'running' | 'passed' | 'failed' | 'skipped';
};

type GroupItem = TreeItemBase & {
  kind: 'group',
  children: (TestCaseItem | GroupItem)[];
};

type TestCaseItem = TreeItemBase & {
  kind: 'case',
  tests: TestCase[];
  children: TestItem[];
};

type TestItem = TreeItemBase & {
  kind: 'test',
  test: TestCase;
  project: string;
};

type TreeItem = GroupItem | TestCaseItem | TestItem;

function createTree(rootSuite: Suite | undefined, projectFilters: Map<string, boolean>): GroupItem {
  const filterProjects = [...projectFilters.values()].some(Boolean);
  const rootItem: GroupItem = {
    kind: 'group',
    id: 'root',
    title: '',
    location: { file: '', line: 0, column: 0 },
    parent: undefined,
    children: [],
    status: 'none',
  };

  const visitSuite = (projectName: string, parentSuite: Suite, parentGroup: GroupItem) => {
    for (const suite of parentSuite.suites) {
      const title = suite.title;
      let group = parentGroup.children.find(item => item.title === title) as GroupItem | undefined;
      if (!group) {
        group = {
          kind: 'group',
          id: parentGroup.id + '\x1e' + title,
          title,
          location: suite.location!,
          parent: parentGroup,
          children: [],
          status: 'none',
        };
        parentGroup.children.push(group);
      }
      visitSuite(projectName, suite, group);
    }

    for (const test of parentSuite.tests) {
      const title = test.title;
      let testCaseItem = parentGroup.children.find(t => t.title === title) as TestCaseItem;
      if (!testCaseItem) {
        testCaseItem = {
          kind: 'case',
          id: parentGroup.id + '\x1e' + title,
          title,
          parent: parentGroup,
          children: [],
          tests: [],
          location: test.location,
          status: 'none',
        };
        parentGroup.children.push(testCaseItem);
      }

      let status: 'none' | 'running' | 'passed' | 'failed' | 'skipped' = 'none';
      if (test.results.some(r => r.duration === -1))
        status = 'running';
      else if (test.results.length && test.outcome() === 'skipped')
        status = 'skipped';
      else if (test.results.length && test.outcome() !== 'expected')
        status = 'failed';
      else if (test.results.length && test.outcome() === 'expected')
        status = 'passed';

      testCaseItem.tests.push(test);
      testCaseItem.children.push({
        kind: 'test',
        id: test.id,
        title: projectName,
        location: test.location!,
        test,
        parent: testCaseItem,
        children: [],
        status,
        project: projectName
      });
    }
  };

  for (const projectSuite of rootSuite?.suites || []) {
    if (filterProjects && !projectFilters.get(projectSuite.title))
      continue;
    visitSuite(projectSuite.title, projectSuite, rootItem);
  }

  const sortAndPropagateStatus = (treeItem: TreeItem) => {
    for (const child of treeItem.children)
      sortAndPropagateStatus(child);

    if (treeItem.kind === 'group' && treeItem.parent)
      treeItem.children.sort((a, b) => a.location.line - b.location.line);

    let allPassed = treeItem.children.length > 0;
    let allSkipped = treeItem.children.length > 0;
    let hasFailed = false;
    let hasRunning = false;

    for (const child of treeItem.children) {
      allSkipped = allSkipped && child.status === 'skipped';
      allPassed = allPassed && (child.status === 'passed' || child.status === 'skipped');
      hasFailed = hasFailed || child.status === 'failed';
      hasRunning = hasRunning || child.status === 'running';
    }

    if (hasRunning)
      treeItem.status = 'running';
    else if (hasFailed)
      treeItem.status = 'failed';
    else if (allSkipped)
      treeItem.status = 'skipped';
    else if (allPassed)
      treeItem.status = 'passed';
  };
  sortAndPropagateStatus(rootItem);
  return rootItem;
}

function filterTree(rootItem: GroupItem, filterText: string, statusFilters: Map<string, boolean>) {
  const tokens = filterText.trim().toLowerCase().split(' ');
  const filtersStatuses = [...statusFilters.values()].some(Boolean);

  const filter = (testCase: TestCaseItem) => {
    const title = testCase.tests[0].titlePath().join(' ').toLowerCase();
    if (!tokens.every(token => title.includes(token)))
      return false;
    testCase.children = (testCase.children as TestItem[]).filter(test => !filtersStatuses || statusFilters.get(test.status));
    testCase.tests = (testCase.children as TestItem[]).map(c => c.test);
    return !!testCase.children.length;
  };

  const visit = (treeItem: GroupItem) => {
    const newChildren: (GroupItem | TestCaseItem)[] = [];
    for (const child of treeItem.children) {
      if (child.kind === 'case') {
        if (filter(child))
          newChildren.push(child);
      } else {
        visit(child);
        if (child.children.length)
          newChildren.push(child);
      }
    }
    treeItem.children = newChildren;
  };
  visit(rootItem);
}

function hideOnlyTests(rootItem: GroupItem) {
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
