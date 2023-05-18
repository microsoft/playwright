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
import { baseFullConfig, TeleReporterReceiver, TeleSuite } from '@testIsomorphic/teleReceiver';
import type { TeleTestCase } from '@testIsomorphic/teleReceiver';
import type { FullConfig, Suite, TestCase, Location, TestError } from '@playwright/test/types/testReporter';
import { SplitView } from '@web/components/splitView';
import { idForAction, MultiTraceModel } from './modelUtil';
import type { SourceLocation } from './modelUtil';
import './uiModeView.css';
import { ToolbarButton } from '@web/components/toolbarButton';
import { Toolbar } from '@web/components/toolbar';
import type { ContextEntry } from '../entries';
import type { XtermDataSource } from '@web/components/xtermWrapper';
import { XtermWrapper } from '@web/components/xtermWrapper';
import { Expandable } from '@web/components/expandable';
import { toggleTheme } from '@web/theme';
import { artifactsFolderName } from '@testIsomorphic/folders';
import { msToString, settings, useSetting } from '@web/uiUtils';
import type { ActionTraceEvent } from '@trace/trace';

let updateRootSuite: (config: FullConfig, rootSuite: Suite, loadErrors: TestError[], progress: Progress | undefined) => void = () => {};
let runWatchedTests = (fileNames: string[]) => {};
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

type TestModel = {
  config: FullConfig | undefined;
  rootSuite: Suite | undefined;
  loadErrors: TestError[];
};

export const UIModeView: React.FC<{}> = ({
}) => {
  const [filterText, setFilterText] = React.useState<string>('');
  const [isShowingOutput, setIsShowingOutput] = React.useState<boolean>(false);

  const [statusFilters, setStatusFilters] = React.useState<Map<string, boolean>>(new Map([
    ['passed', false],
    ['failed', false],
    ['skipped', false],
  ]));
  const [projectFilters, setProjectFilters] = React.useState<Map<string, boolean>>(new Map());
  const [testModel, setTestModel] = React.useState<TestModel>({ config: undefined, rootSuite: undefined, loadErrors: [] });
  const [progress, setProgress] = React.useState<Progress & { total: number } | undefined>();
  const [selectedItem, setSelectedItem] = React.useState<{ testFile?: SourceLocation, testCase?: TestCase }>({});
  const [visibleTestIds, setVisibleTestIds] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [runningState, setRunningState] = React.useState<{ testIds: Set<string>, itemSelectedByUser?: boolean } | undefined>();
  const [watchAll, setWatchAll] = useSetting<boolean>('watch-all', false);
  const [watchedTreeIds, setWatchedTreeIds] = React.useState<{ value: Set<string> }>({ value: new Set() });
  const runTestPromiseChain = React.useRef(Promise.resolve());
  const runTestBacklog = React.useRef<Set<string>>(new Set());
  const [collapseAllCount, setCollapseAllCount] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const reloadTests = React.useCallback(() => {
    setIsLoading(true);
    setWatchedTreeIds({ value: new Set() });
    updateRootSuite(baseFullConfig, new TeleSuite('', 'root'), [], undefined);
    refreshRootSuite(true).then(() => {
      setIsLoading(false);
    });
  }, []);

  React.useEffect(() => {
    inputRef.current?.focus();
    reloadTests();
  }, [reloadTests]);

  updateRootSuite = React.useCallback((config: FullConfig, rootSuite: Suite, loadErrors: TestError[], newProgress: Progress | undefined) => {
    const selectedProjects = config.configFile ? settings.getObject<string[] | undefined>(config.configFile + ':projects', undefined) : undefined;
    for (const projectName of projectFilters.keys()) {
      if (!rootSuite.suites.find(s => s.title === projectName))
        projectFilters.delete(projectName);
    }
    for (const projectSuite of rootSuite.suites) {
      if (!projectFilters.has(projectSuite.title))
        projectFilters.set(projectSuite.title, !!selectedProjects?.includes(projectSuite.title));
    }
    if (!selectedProjects && projectFilters.size && ![...projectFilters.values()].includes(true))
      projectFilters.set(projectFilters.entries().next().value[0], true);

    setTestModel({ config, rootSuite, loadErrors });
    setProjectFilters(new Map(projectFilters));
    if (runningState && newProgress)
      setProgress({ ...newProgress, total: runningState.testIds.size });
    else if (!newProgress)
      setProgress(undefined);
  }, [projectFilters, runningState]);

  const runTests = React.useCallback((mode: 'queue-if-busy' | 'bounce-if-busy', testIds: Set<string>) => {
    if (mode === 'bounce-if-busy' && runningState)
      return;

    runTestBacklog.current = new Set([...runTestBacklog.current, ...testIds]);
    runTestPromiseChain.current = runTestPromiseChain.current.then(async () => {
      const testIds = runTestBacklog.current;
      runTestBacklog.current = new Set();
      if (!testIds.size)
        return;

      // Clear test results.
      {
        for (const test of testModel.rootSuite?.allTests() || []) {
          if (testIds.has(test.id)) {
            (test as TeleTestCase)._clearResults();
            (test as TeleTestCase)._createTestResult('pending');
          }
        }
        setTestModel({ ...testModel });
      }

      const time = '  [' + new Date().toLocaleTimeString() + ']';
      xtermDataSource.write('\x1B[2m—'.repeat(Math.max(0, xtermSize.cols - time.length)) + time + '\x1B[22m');
      setProgress({ total: testIds.size, passed: 0, failed: 0, skipped: 0 });
      setRunningState({ testIds });

      await sendMessage('run', { testIds: [...testIds] });
      // Clear pending tests in case of interrupt.
      for (const test of testModel.rootSuite?.allTests() || []) {
        if (test.results[0]?.duration === -1)
          (test as TeleTestCase)._clearResults();
      }
      setTestModel({ ...testModel });
      setRunningState(undefined);
    });
  }, [runningState, testModel]);

  const isRunningTest = !!runningState;

  return <div className='vbox ui-mode'>
    <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true}>
      <div className='vbox'>
        <div className={'vbox' + (isShowingOutput ? '' : ' hidden')}>
          <Toolbar>
            <div className='section-title' style={{ flex: 'none' }}>Output</div>
            <ToolbarButton icon='circle-slash' title='Clear output' onClick={() => xtermDataSource.clear()}></ToolbarButton>
            <div className='spacer'></div>
            <ToolbarButton icon='close' title='Close' onClick={() => setIsShowingOutput(false)}></ToolbarButton>
          </Toolbar>
          <XtermWrapper source={xtermDataSource}></XtermWrapper>
        </div>
        <div className={'vbox' + (isShowingOutput ? ' hidden' : '')}>
          <TraceView item={selectedItem} rootDir={testModel.config?.rootDir} />
        </div>
      </div>
      <div className='vbox ui-mode-sidebar'>
        <Toolbar noShadow={true} noMinHeight={true}>
          <img src='icon-32x32.png' />
          <div className='section-title'>Playwright</div>
          <ToolbarButton icon='color-mode' title='Toggle color mode' onClick={() => toggleTheme()} />
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
          testModel={testModel}
          runTests={() => runTests('bounce-if-busy', visibleTestIds)} />
        <Toolbar noMinHeight={true}>
          {!isRunningTest && !progress && <div className='section-title'>Tests</div>}
          {!isRunningTest && progress && <div data-testid='status-line' className='status-line'>
            <div>{progress.passed}/{progress.total} passed ({(progress.passed / progress.total) * 100 | 0}%)</div>
          </div>}
          {isRunningTest && progress && <div data-testid='status-line' className='status-line'>
            <div>Running {progress.passed}/{runningState.testIds.size} passed ({(progress.passed / runningState.testIds.size) * 100 | 0}%)</div>
          </div>}
          <ToolbarButton icon='play' title='Run all' onClick={() => runTests('bounce-if-busy', visibleTestIds)} disabled={isRunningTest || isLoading}></ToolbarButton>
          <ToolbarButton icon='debug-stop' title='Stop' onClick={() => sendMessageNoReply('stop')} disabled={!isRunningTest || isLoading}></ToolbarButton>
          <ToolbarButton icon='eye' title='Watch all' toggled={watchAll} onClick={() => setWatchAll(!watchAll)}></ToolbarButton>
          <ToolbarButton icon='collapse-all' title='Collapse all' onClick={() => {
            setCollapseAllCount(collapseAllCount + 1);
          }} />
        </Toolbar>
        <TestList
          statusFilters={statusFilters}
          projectFilters={projectFilters}
          filterText={filterText}
          testModel={testModel}
          runningState={runningState}
          runTests={runTests}
          onItemSelected={setSelectedItem}
          setVisibleTestIds={setVisibleTestIds}
          watchAll={watchAll}
          watchedTreeIds={watchedTreeIds}
          setWatchedTreeIds={setWatchedTreeIds}
          isLoading={isLoading}
          requestedCollapseAllCount={collapseAllCount} />
      </div>
    </SplitView>
  </div>;
};

const FiltersView: React.FC<{
  filterText: string;
  setFilterText: (text: string) => void;
  statusFilters: Map<string, boolean>;
  setStatusFilters: (filters: Map<string, boolean>) => void;
  projectFilters: Map<string, boolean>;
  setProjectFilters: (filters: Map<string, boolean>) => void;
  testModel: TestModel | undefined,
  runTests: () => void;
}> = ({ filterText, setFilterText, statusFilters, setStatusFilters, projectFilters, setProjectFilters, testModel, runTests }) => {
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
    </Expandable>
    <div className='filter-summary' title={'Status: ' + statusLine + '\nProjects: ' + projectsLine} onClick={() => setExpanded(!expanded)}>
      <span className='filter-label'>Status:</span> {statusLine}
      <span className='filter-label'>Projects:</span> {projectsLine}
    </div>
    {expanded && <div className='hbox' style={{ marginLeft: 14 }}>
      <div className='filter-list'>
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
      </div>
      <div className='filter-list'>
        {[...projectFilters.entries()].map(([projectName, value]) => {
          return <div className='filter-entry'>
            <label>
              <input type='checkbox' checked={value} onClick={() => {
                const copy = new Map(projectFilters);
                copy.set(projectName, !copy.get(projectName));
                setProjectFilters(copy);
                const configFile = testModel?.config?.configFile;
                if (configFile)
                  settings.setObject(configFile + ':projects', [...copy.entries()].filter(([_, v]) => v).map(([k]) => k));
              }}/>
              <div>{projectName}</div>
            </label>
          </div>;
        })}
      </div>
    </div>}
  </div>;
};

const TestTreeView = TreeView<TreeItem>;

const TestList: React.FC<{
  statusFilters: Map<string, boolean>,
  projectFilters: Map<string, boolean>,
  filterText: string,
  testModel: TestModel,
  runTests: (mode: 'bounce-if-busy' | 'queue-if-busy', testIds: Set<string>) => void,
  runningState?: { testIds: Set<string>, itemSelectedByUser?: boolean },
  watchAll: boolean,
  watchedTreeIds: { value: Set<string> },
  setWatchedTreeIds: (ids: { value: Set<string> }) => void,
  isLoading?: boolean,
  setVisibleTestIds: (testIds: Set<string>) => void,
  onItemSelected: (item: { testCase?: TestCase, testFile?: SourceLocation }) => void,
  requestedCollapseAllCount: number,
}> = ({ statusFilters, projectFilters, filterText, testModel, runTests, runningState, watchAll, watchedTreeIds, setWatchedTreeIds, isLoading, onItemSelected, setVisibleTestIds, requestedCollapseAllCount }) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const [selectedTreeItemId, setSelectedTreeItemId] = React.useState<string | undefined>();
  const [collapseAllCount, setCollapseAllCount] = React.useState(requestedCollapseAllCount);

  // Build the test tree.
  const { rootItem, treeItemMap, fileNames } = React.useMemo(() => {
    let rootItem = createTree(testModel.rootSuite, testModel.loadErrors, projectFilters);
    filterTree(rootItem, filterText, statusFilters, runningState?.testIds);
    sortAndPropagateStatus(rootItem);
    rootItem = shortenRoot(rootItem);

    hideOnlyTests(rootItem);
    const treeItemMap = new Map<string, TreeItem>();
    const visibleTestIds = new Set<string>();
    const fileNames = new Set<string>();
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'group' && treeItem.location.file)
        fileNames.add(treeItem.location.file);
      if (treeItem.kind === 'case')
        treeItem.tests.forEach(t => visibleTestIds.add(t.id));
      treeItem.children.forEach(visit);
      treeItemMap.set(treeItem.id, treeItem);
    };
    visit(rootItem);
    setVisibleTestIds(visibleTestIds);
    return { rootItem, treeItemMap, fileNames };
  }, [filterText, testModel, statusFilters, projectFilters, setVisibleTestIds, runningState]);

  // Look for a first failure within the run batch to select it.
  React.useEffect(() => {
    // If collapse was requested, clear the expanded items and return w/o selected item.
    if (collapseAllCount !== requestedCollapseAllCount) {
      treeState.expandedItems.clear();
      for (const item of treeItemMap.keys())
        treeState.expandedItems.set(item, false);
      setCollapseAllCount(requestedCollapseAllCount);
      setSelectedTreeItemId(undefined);
      setTreeState({ ...treeState });
      return;
    }

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
  }, [runningState, setSelectedTreeItemId, rootItem, collapseAllCount, setCollapseAllCount, requestedCollapseAllCount, treeState, setTreeState, treeItemMap]);

  // Compute selected item.
  const { selectedTreeItem } = React.useMemo(() => {
    const selectedTreeItem = selectedTreeItemId ? treeItemMap.get(selectedTreeItemId) : undefined;
    let testFile: SourceLocation | undefined;
    if (selectedTreeItem) {
      testFile = {
        file: selectedTreeItem.location.file,
        line: selectedTreeItem.location.line,
        source: {
          errors: testModel.loadErrors.filter(e => e.location?.file === selectedTreeItem.location.file).map(e => ({ line: e.location!.line, message: e.message! })),
          content: undefined,
        }
      };
    }
    let selectedTest: TestCase | undefined;
    if (selectedTreeItem?.kind === 'test')
      selectedTest = selectedTreeItem.test;
    else if (selectedTreeItem?.kind === 'case' && selectedTreeItem.tests.length === 1)
      selectedTest = selectedTreeItem.tests[0];
    onItemSelected({ testCase: selectedTest, testFile });
    return { selectedTreeItem };
  }, [onItemSelected, selectedTreeItemId, testModel, treeItemMap]);

  // Update watch all.
  React.useEffect(() => {
    if (watchAll) {
      sendMessageNoReply('watch', { fileNames: [...fileNames] });
    } else {
      const fileNames = new Set<string>();
      for (const itemId of watchedTreeIds.value) {
        const treeItem = treeItemMap.get(itemId);
        const fileName = treeItem?.location.file;
        if (fileName)
          fileNames.add(fileName);
      }
      sendMessageNoReply('watch', { fileNames: [...fileNames] });
    }
  }, [rootItem, fileNames, watchAll, watchedTreeIds, treeItemMap]);

  const runTreeItem = (treeItem: TreeItem) => {
    setSelectedTreeItemId(treeItem.id);
    runTests('bounce-if-busy', collectTestIds(treeItem));
  };

  runWatchedTests = (changedTestFiles: string[]) => {
    const testIds: string[] = [];
    const set = new Set(changedTestFiles);
    if (watchAll) {
      const visit = (treeItem: TreeItem) => {
        const fileName = treeItem.location.file;
        if (fileName && set.has(fileName))
          testIds.push(...collectTestIds(treeItem));
        if (treeItem.kind === 'group' && treeItem.subKind === 'folder')
          treeItem.children.forEach(visit);
      };
      visit(rootItem);
    } else {
      for (const treeId of watchedTreeIds.value) {
        const treeItem = treeItemMap.get(treeId);
        const fileName = treeItem?.location.file;
        if (fileName && set.has(fileName))
          testIds.push(...collectTestIds(treeItem));
      }
    }
    runTests('queue-if-busy', new Set(testIds));
  };

  return <TestTreeView
    treeState={treeState}
    setTreeState={setTreeState}
    rootItem={rootItem}
    dataTestId='test-tree'
    render={treeItem => {
      return <div className='hbox ui-mode-list-item'>
        <div className='ui-mode-list-item-title'>{treeItem.title}</div>
        {!!treeItem.duration && treeItem.status !== 'skipped' && <div className='ui-mode-list-item-time'>{msToString(treeItem.duration)}</div>}
        <Toolbar noMinHeight={true} noShadow={true}>
          <ToolbarButton icon='play' title='Run' onClick={() => runTreeItem(treeItem)} disabled={!!runningState}></ToolbarButton>
          <ToolbarButton icon='go-to-file' title='Open in VS Code' onClick={() => sendMessageNoReply('open', { location: locationToOpen(treeItem) })}></ToolbarButton>
          {!watchAll && <ToolbarButton icon='eye' title='Watch' onClick={() => {
            if (watchedTreeIds.value.has(treeItem.id))
              watchedTreeIds.value.delete(treeItem.id);
            else
              watchedTreeIds.value.add(treeItem.id);
            setWatchedTreeIds({ ...watchedTreeIds });
          }} toggled={watchedTreeIds.value.has(treeItem.id)}></ToolbarButton>}
        </Toolbar>
      </div>;
    }}
    icon={treeItem => {
      if (treeItem.status === 'scheduled')
        return 'codicon-clock';
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
    isError={treeItem => treeItem.kind === 'group' ? treeItem.hasLoadErrors : false}
    autoExpandDepth={filterText ? 5 : 1}
    noItemsMessage={isLoading ? 'Loading\u2026' : 'No tests'} />;
};

const TraceView: React.FC<{
  item: { testFile?: SourceLocation, testCase?: TestCase },
  rootDir?: string,
}> = ({ item, rootDir }) => {
  const [model, setModel] = React.useState<{ model: MultiTraceModel, isLive: boolean } | undefined>();
  const [counter, setCounter] = React.useState(0);
  const pollTimer = React.useRef<NodeJS.Timeout | null>(null);

  const { outputDir } = React.useMemo(() => {
    const outputDir = item.testCase ? outputDirForTestCase(item.testCase) : undefined;
    return { outputDir };
  }, [item]);

  // Preserve user selection upon live-reloading trace model by persisting the action id.
  // This avoids auto-selection of the last action every time we reload the model.
  const [selectedActionId, setSelectedActionId] = React.useState<string | undefined>();
  const onSelectionChanged = React.useCallback((action: ActionTraceEvent) => setSelectedActionId(idForAction(action)), [setSelectedActionId]);
  const initialSelection = selectedActionId ? model?.model.actions.find(a => idForAction(a) === selectedActionId) : undefined;

  React.useEffect(() => {
    if (pollTimer.current)
      clearTimeout(pollTimer.current);

    const result = item.testCase?.results[0];
    if (!result) {
      setModel(undefined);
      return;
    }

    // Test finished.
    const attachment = result && result.duration >= 0 && result.attachments.find(a => a.name === 'trace');
    if (attachment && attachment.path) {
      loadSingleTraceFile(attachment.path).then(model => setModel({ model, isLive: false }));
      return;
    }

    if (!outputDir) {
      setModel(undefined);
      return;
    }

    const traceLocation = `${outputDir}/${artifactsFolderName(result!.workerIndex)}/traces/${item.testCase?.id}.json`;
    // Start polling running test.
    pollTimer.current = setTimeout(async () => {
      try {
        const model = await loadSingleTraceFile(traceLocation);
        setModel({ model, isLive: true });
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
  }, [outputDir, item, setModel, counter, setCounter]);

  return <Workbench
    key='workbench'
    model={model?.model}
    hideTimelineBars={true}
    hideStackFrames={true}
    showSourcesFirst={true}
    rootDir={rootDir}
    initialSelection={initialSelection}
    onSelectionChanged={onSelectionChanged}
    fallbackLocation={item.testFile}
    isLive={model?.isLive} />;
};

declare global {
  interface Window {
    binding(data: any): Promise<void>;
  }
}

let receiver: TeleReporterReceiver | undefined;

let throttleTimer: NodeJS.Timeout | undefined;
let throttleData: { config: FullConfig, rootSuite: Suite, loadErrors: TestError[], progress: Progress } | undefined;
const throttledAction = () => {
  clearTimeout(throttleTimer);
  throttleTimer = undefined;
  updateRootSuite(throttleData!.config, throttleData!.rootSuite, throttleData!.loadErrors, throttleData!.progress);
};

const throttleUpdateRootSuite = (config: FullConfig, rootSuite: Suite, loadErrors: TestError[], progress: Progress, immediate = false) => {
  throttleData = { config, rootSuite, loadErrors, progress };
  if (immediate)
    throttledAction();
  else if (!throttleTimer)
    throttleTimer = setTimeout(throttledAction, 250);
};

const refreshRootSuite = (eraseResults: boolean): Promise<void> => {
  if (!eraseResults)
    return sendMessage('list', {});

  let rootSuite: Suite;
  let loadErrors: TestError[];
  const progress: Progress = {
    passed: 0,
    failed: 0,
    skipped: 0,
  };
  let config: FullConfig;
  receiver = new TeleReporterReceiver(pathSeparator, {
    onBegin: (c: FullConfig, suite: Suite) => {
      if (!rootSuite) {
        rootSuite = suite;
        loadErrors = [];
      }
      config = c;
      progress.passed = 0;
      progress.failed = 0;
      progress.skipped = 0;
      throttleUpdateRootSuite(config, rootSuite, loadErrors, progress, true);
    },

    onEnd: () => {
      throttleUpdateRootSuite(config, rootSuite, loadErrors, progress, true);
    },

    onTestBegin: () => {
      throttleUpdateRootSuite(config, rootSuite, loadErrors, progress);
    },

    onTestEnd: (test: TestCase) => {
      if (test.outcome() === 'skipped')
        ++progress.skipped;
      else if (test.outcome() === 'unexpected')
        ++progress.failed;
      else
        ++progress.passed;
      throttleUpdateRootSuite(config, rootSuite, loadErrors, progress);
    },

    onError: (error: TestError) => {
      xtermDataSource.write((error.stack || error.value || '') + '\n');
      loadErrors.push(error);
      throttleUpdateRootSuite(config, rootSuite, loadErrors, progress);
    },
  });
  receiver._setClearPreviousResultsWhenTestBegins();
  return sendMessage('list', {});
};

(window as any).dispatch = (message: any) => {
  if (message.method === 'listChanged') {
    refreshRootSuite(false).catch(() => {});
    return;
  }

  if (message.method === 'testFilesChanged') {
    runWatchedTests(message.params.testFileNames);
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

  receiver?.dispatch(message)?.catch(() => {});
};

const sendMessage = async (method: string, params: any) => {
  await (window as any).sendMessage({ method, params });
};

const sendMessageNoReply = (method: string, params?: any) => {
  if ((window as any)._overrideProtocolForTest) {
    (window as any)._overrideProtocolForTest({ method, params }).catch(() => {});
    return;
  }
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

const locationToOpen = (treeItem?: TreeItem) => {
  if (!treeItem)
    return;
  return treeItem.location.file + ':' + treeItem.location.line;
};

const collectTestIds = (treeItem?: TreeItem): Set<string> => {
  const testIds = new Set<string>();
  if (!treeItem)
    return testIds;

  const visit = (treeItem: TreeItem) => {
    if (treeItem.kind === 'case')
      treeItem.tests.map(t => t.id).forEach(id => testIds.add(id));
    else if (treeItem.kind === 'test')
      testIds.add(treeItem.id);
    else
      treeItem.children?.forEach(visit);
  };
  visit(treeItem);
  return testIds;
};

type Progress = {
  passed: number;
  failed: number;
  skipped: number;
};

type TreeItemBase = {
  kind: 'root' | 'group' | 'case' | 'test',
  id: string;
  title: string;
  location: Location,
  duration: number;
  parent: TreeItem | undefined;
  children: TreeItem[];
  status: 'none' | 'running' | 'scheduled' | 'passed' | 'failed' | 'skipped';
};

type GroupItem = TreeItemBase & {
  kind: 'group';
  subKind: 'folder' | 'file' | 'describe';
  hasLoadErrors: boolean;
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

function getFileItem(rootItem: GroupItem, filePath: string[], isFile: boolean, fileItems: Map<string, GroupItem>): GroupItem {
  if (filePath.length === 0)
    return rootItem;
  const fileName = filePath.join(pathSeparator);
  const existingFileItem = fileItems.get(fileName);
  if (existingFileItem)
    return existingFileItem;
  const parentFileItem = getFileItem(rootItem, filePath.slice(0, filePath.length - 1), false, fileItems);
  const fileItem: GroupItem = {
    kind: 'group',
    subKind: isFile ? 'file' : 'folder',
    id: fileName,
    title: filePath[filePath.length - 1],
    location: { file: fileName, line: 0, column: 0 },
    duration: 0,
    parent: parentFileItem,
    children: [],
    status: 'none',
    hasLoadErrors: false,
  };
  parentFileItem.children.push(fileItem);
  fileItems.set(fileName, fileItem);
  return fileItem;
}

function createTree(rootSuite: Suite | undefined, loadErrors: TestError[], projectFilters: Map<string, boolean>): GroupItem {
  const filterProjects = [...projectFilters.values()].some(Boolean);
  const rootItem: GroupItem = {
    kind: 'group',
    subKind: 'folder',
    id: 'root',
    title: '',
    location: { file: '', line: 0, column: 0 },
    duration: 0,
    parent: undefined,
    children: [],
    status: 'none',
    hasLoadErrors: false,
  };

  const visitSuite = (projectName: string, parentSuite: Suite, parentGroup: GroupItem) => {
    for (const suite of parentSuite.suites) {
      const title = suite.title || '<anonymous>';
      let group = parentGroup.children.find(item => item.title === title) as GroupItem | undefined;
      if (!group) {
        group = {
          kind: 'group',
          subKind: 'describe',
          id: parentGroup.id + '\x1e' + title,
          title,
          location: suite.location!,
          duration: 0,
          parent: parentGroup,
          children: [],
          status: 'none',
          hasLoadErrors: false,
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
          duration: 0,
          status: 'none',
        };
        parentGroup.children.push(testCaseItem);
      }

      const result = (test as TeleTestCase).results[0];
      let status: 'none' | 'running' | 'scheduled' | 'passed' | 'failed' | 'skipped' = 'none';
      if (result?.statusEx === 'scheduled')
        status = 'scheduled';
      else if (result?.statusEx === 'running')
        status = 'running';
      else if (result?.status === 'skipped')
        status = 'skipped';
      else if (result?.status === 'interrupted')
        status = 'none';
      else if (result && test.outcome() !== 'expected')
        status = 'failed';
      else if (result && test.outcome() === 'expected')
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
        duration: test.results.length ? Math.max(0, test.results[0].duration) : 0,
        project: projectName,
      });
      testCaseItem.duration = (testCaseItem.children as TestItem[]).reduce((a, b) => a + b.duration, 0);
    }
  };

  const fileMap = new Map<string, GroupItem>();
  for (const projectSuite of rootSuite?.suites || []) {
    if (filterProjects && !projectFilters.get(projectSuite.title))
      continue;
    for (const fileSuite of projectSuite.suites) {
      const fileItem = getFileItem(rootItem, fileSuite.location!.file.split(pathSeparator), true, fileMap);
      visitSuite(projectSuite.title, fileSuite, fileItem);
    }
    for (const loadError of loadErrors) {
      if (!loadError.location)
        continue;
      const fileItem = getFileItem(rootItem, loadError.location.file.split(pathSeparator), true, fileMap);
      fileItem.hasLoadErrors = true;
    }
  }
  return rootItem;
}

function filterTree(rootItem: GroupItem, filterText: string, statusFilters: Map<string, boolean>, runningTestIds: Set<string> | undefined) {
  const tokens = filterText.trim().toLowerCase().split(' ');
  const filtersStatuses = [...statusFilters.values()].some(Boolean);

  const filter = (testCase: TestCaseItem) => {
    const title = testCase.tests[0].titlePath().join(' ').toLowerCase();
    if (!tokens.every(token => title.includes(token)) && !testCase.tests.some(t => runningTestIds?.has(t.id)))
      return false;
    testCase.children = (testCase.children as TestItem[]).filter(test => {
      return !filtersStatuses || runningTestIds?.has(test.id) || statusFilters.get(test.status);
    });
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
        if (child.children.length || child.hasLoadErrors)
          newChildren.push(child);
      }
    }
    treeItem.children = newChildren;
  };
  visit(rootItem);
}

function sortAndPropagateStatus(treeItem: TreeItem) {
  for (const child of treeItem.children)
    sortAndPropagateStatus(child);

  if (treeItem.kind === 'group') {
    treeItem.children.sort((a, b) => {
      const fc = a.location.file.localeCompare(b.location.file);
      return fc || a.location.line - b.location.line;
    });
  }

  let allPassed = treeItem.children.length > 0;
  let allSkipped = treeItem.children.length > 0;
  let hasFailed = false;
  let hasRunning = false;
  let hasScheduled = false;

  for (const child of treeItem.children) {
    allSkipped = allSkipped && child.status === 'skipped';
    allPassed = allPassed && (child.status === 'passed' || child.status === 'skipped');
    hasFailed = hasFailed || child.status === 'failed';
    hasRunning = hasRunning || child.status === 'running';
    hasScheduled = hasScheduled || child.status === 'scheduled';
  }

  if (hasRunning)
    treeItem.status = 'running';
  else if (hasScheduled)
    treeItem.status = 'scheduled';
  else if (hasFailed)
    treeItem.status = 'failed';
  else if (allSkipped)
    treeItem.status = 'skipped';
  else if (allPassed)
    treeItem.status = 'passed';
}

function shortenRoot(rootItem: GroupItem): GroupItem {
  let shortRoot = rootItem;
  while (shortRoot.children.length === 1 && shortRoot.children[0].kind === 'group' && shortRoot.children[0].subKind === 'folder')
    shortRoot = shortRoot.children[0];
  shortRoot.location = rootItem.location;
  return shortRoot;
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

const pathSeparator = navigator.userAgent.toLowerCase().includes('windows') ? '\\' : '/';
