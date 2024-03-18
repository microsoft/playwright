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
import { baseFullConfig, TeleSuite } from '@testIsomorphic/teleReceiver';
import { TeleSuiteUpdater } from './teleSuiteUpdater';
import type { Progress } from './teleSuiteUpdater';
import type { TeleTestCase } from '@testIsomorphic/teleReceiver';
import type * as reporterTypes from 'playwright/types/testReporter';
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
import { connect } from './wsPort';
import { statusEx, TestTree } from '@testIsomorphic/testTree';
import type { TreeItem  } from '@testIsomorphic/testTree';
import { testStatusIcon } from './testUtils';

let updateRootSuite: (config: reporterTypes.FullConfig, rootSuite: reporterTypes.Suite, loadErrors: reporterTypes.TestError[], progress: Progress | undefined) => void = () => {};
let runWatchedTests = (fileNames: string[]) => {};
let xtermSize = { cols: 80, rows: 24 };

let sendMessage: (method: string, params?: any) => Promise<any> = async () => {};

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
  config: reporterTypes.FullConfig | undefined;
  rootSuite: reporterTypes.Suite | undefined;
  loadErrors: reporterTypes.TestError[];
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
  const [selectedItem, setSelectedItem] = React.useState<{ treeItem?: TreeItem, testFile?: SourceLocation, testCase?: reporterTypes.TestCase }>({});
  const [visibleTestIds, setVisibleTestIds] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [runningState, setRunningState] = React.useState<{ testIds: Set<string>, itemSelectedByUser?: boolean } | undefined>();
  const [watchAll, setWatchAll] = useSetting<boolean>('watch-all', false);
  const [watchedTreeIds, setWatchedTreeIds] = React.useState<{ value: Set<string> }>({ value: new Set() });
  const runTestPromiseChain = React.useRef(Promise.resolve());
  const runTestBacklog = React.useRef<Set<string>>(new Set());
  const [collapseAllCount, setCollapseAllCount] = React.useState(0);
  const [isDisconnected, setIsDisconnected] = React.useState(false);
  const [hasBrowsers, setHasBrowsers] = React.useState(true);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const reloadTests = React.useCallback(() => {
    setIsLoading(true);
    setWatchedTreeIds({ value: new Set() });
    updateRootSuite(baseFullConfig, new TeleSuite('', 'root'), [], undefined);
    refreshRootSuite().then(async () => {
      setIsLoading(false);
      const { hasBrowsers } = await sendMessage('checkBrowsers');
      setHasBrowsers(hasBrowsers);
    });
  }, []);

  React.useEffect(() => {
    inputRef.current?.focus();
    setIsLoading(true);
    connect({ onEvent: dispatchEvent, onClose: () => setIsDisconnected(true) }).then(send => {
      sendMessage = async (method, params) => {
        const logForTest = (window as any).__logForTest;
        logForTest?.({ method, params });
        await send(method, params);
      };
      reloadTests();
    });
  }, [reloadTests]);

  updateRootSuite = React.useCallback((config: reporterTypes.FullConfig, rootSuite: reporterTypes.Suite, loadErrors: reporterTypes.TestError[], newProgress: Progress | undefined) => {
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
      setProgress(newProgress);
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
            const result = (test as TeleTestCase)._createTestResult('pending');
            (result as any)[statusEx] = 'scheduled';
          }
        }
        setTestModel({ ...testModel });
      }

      const time = '  [' + new Date().toLocaleTimeString() + ']';
      xtermDataSource.write('\x1B[2m—'.repeat(Math.max(0, xtermSize.cols - time.length)) + time + '\x1B[22m');
      setProgress({ total: 0, passed: 0, failed: 0, skipped: 0 });
      setRunningState({ testIds });

      await sendMessage('runTests', { testIds: [...testIds], projects: [...projectFilters].filter(([_, v]) => v).map(([p]) => p) });
      // Clear pending tests in case of interrupt.
      for (const test of testModel.rootSuite?.allTests() || []) {
        if (test.results[0]?.duration === -1)
          (test as TeleTestCase)._clearResults();
      }
      setTestModel({ ...testModel });
      setRunningState(undefined);
    });
  }, [projectFilters, runningState, testModel]);

  const isRunningTest = !!runningState;
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const openInstallDialog = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dialogRef.current?.showModal();
  }, []);
  const closeInstallDialog = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dialogRef.current?.close();
  }, []);
  const installBrowsers = React.useCallback((e: React.MouseEvent) => {
    closeInstallDialog(e);
    setIsShowingOutput(true);
    sendMessage('installBrowsers').then(async () => {
      setIsShowingOutput(false);
      const { hasBrowsers } = await sendMessage('checkBrowsers');
      setHasBrowsers(hasBrowsers);
    });
  }, [closeInstallDialog]);

  return <div className='vbox ui-mode'>
    {!hasBrowsers && <dialog ref={dialogRef}>
      <div className='title'><span className='codicon codicon-lightbulb'></span>Install browsers</div>
      <div className='body'>
        Playwright did not find installed browsers.
        <br></br>
        Would you like to run `playwright install`?
        <br></br>
        <button className='button' onClick={installBrowsers}>Install</button>
        <button className='button secondary' onClick={closeInstallDialog}>Dismiss</button>
      </div>
    </dialog>}
    {isDisconnected && <div className='disconnected'>
      <div className='title'>UI Mode disconnected</div>
      <div><a href='#' onClick={() => window.location.href = '/'}>Reload the page</a> to reconnect</div>
    </div>}
    <SplitView sidebarSize={250} minSidebarSize={150} orientation='horizontal' sidebarIsFirst={true} settingName='testListSidebar'>
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
          <img src='playwright-logo.svg' alt='Playwright logo' />
          <div className='section-title'>Playwright</div>
          <ToolbarButton icon='color-mode' title='Toggle color mode' onClick={() => toggleTheme()} />
          <ToolbarButton icon='refresh' title='Reload' onClick={() => reloadTests()} disabled={isRunningTest || isLoading}></ToolbarButton>
          <ToolbarButton icon='terminal' title='Toggle output' toggled={isShowingOutput} onClick={() => { setIsShowingOutput(!isShowingOutput); }} />
          {!hasBrowsers && <ToolbarButton icon='lightbulb-autofix' style={{ color: 'var(--vscode-list-warningForeground)' }} title='Playwright browsers are missing' onClick={openInstallDialog} />}
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
          <ToolbarButton icon='eye' title='Watch all' toggled={watchAll} onClick={() => {
            setWatchedTreeIds({ value: new Set() });
            setWatchAll(!watchAll);
          }}></ToolbarButton>
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
    {expanded && <div className='hbox' style={{ marginLeft: 14, maxHeight: 200, overflowY: 'auto' }}>
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
              <div>{projectName || 'untitled'}</div>
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
  onItemSelected: (item: { treeItem?: TreeItem, testCase?: reporterTypes.TestCase, testFile?: SourceLocation }) => void,
  requestedCollapseAllCount: number,
}> = ({ statusFilters, projectFilters, filterText, testModel, runTests, runningState, watchAll, watchedTreeIds, setWatchedTreeIds, isLoading, onItemSelected, setVisibleTestIds, requestedCollapseAllCount }) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const [selectedTreeItemId, setSelectedTreeItemId] = React.useState<string | undefined>();
  const [collapseAllCount, setCollapseAllCount] = React.useState(requestedCollapseAllCount);

  // Build the test tree.
  const { testTree } = React.useMemo(() => {
    const testTree = new TestTree('', testModel.rootSuite, testModel.loadErrors, projectFilters, pathSeparator);
    testTree.filterTree(filterText, statusFilters, runningState?.testIds);
    testTree.sortAndPropagateStatus();
    testTree.shortenRoot();
    testTree.flattenForSingleProject();
    setVisibleTestIds(testTree.testIds());
    return { testTree };
  }, [filterText, testModel, statusFilters, projectFilters, setVisibleTestIds, runningState]);

  // Look for a first failure within the run batch to select it.
  React.useEffect(() => {
    // If collapse was requested, clear the expanded items and return w/o selected item.
    if (collapseAllCount !== requestedCollapseAllCount) {
      treeState.expandedItems.clear();
      for (const item of testTree.flatTreeItems())
        treeState.expandedItems.set(item.id, false);
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
    visit(testTree.rootItem);

    if (selectedTreeItem)
      setSelectedTreeItemId(selectedTreeItem.id);
  }, [runningState, setSelectedTreeItemId, testTree, collapseAllCount, setCollapseAllCount, requestedCollapseAllCount, treeState, setTreeState]);

  // Compute selected item.
  const { selectedTreeItem } = React.useMemo(() => {
    const selectedTreeItem = selectedTreeItemId ? testTree.treeItemById(selectedTreeItemId) : undefined;
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
    let selectedTest: reporterTypes.TestCase | undefined;
    if (selectedTreeItem?.kind === 'test')
      selectedTest = selectedTreeItem.test;
    else if (selectedTreeItem?.kind === 'case' && selectedTreeItem.tests.length === 1)
      selectedTest = selectedTreeItem.tests[0];
    onItemSelected({ treeItem: selectedTreeItem, testCase: selectedTest, testFile });
    return { selectedTreeItem };
  }, [onItemSelected, selectedTreeItemId, testModel, testTree]);

  // Update watch all.
  React.useEffect(() => {
    if (isLoading)
      return;
    if (watchAll) {
      sendMessageNoReply('watch', { fileNames: testTree.fileNames() });
    } else {
      const fileNames = new Set<string>();
      for (const itemId of watchedTreeIds.value) {
        const treeItem = testTree.treeItemById(itemId);
        const fileName = treeItem?.location.file;
        if (fileName)
          fileNames.add(fileName);
      }
      sendMessageNoReply('watch', { fileNames: [...fileNames] });
    }
  }, [isLoading, testTree, watchAll, watchedTreeIds]);

  const runTreeItem = (treeItem: TreeItem) => {
    setSelectedTreeItemId(treeItem.id);
    runTests('bounce-if-busy', testTree.collectTestIds(treeItem));
  };

  runWatchedTests = (changedTestFiles: string[]) => {
    const testIds: string[] = [];
    const set = new Set(changedTestFiles);
    if (watchAll) {
      const visit = (treeItem: TreeItem) => {
        const fileName = treeItem.location.file;
        if (fileName && set.has(fileName))
          testIds.push(...testTree.collectTestIds(treeItem));
        if (treeItem.kind === 'group' && treeItem.subKind === 'folder')
          treeItem.children.forEach(visit);
      };
      visit(testTree.rootItem);
    } else {
      for (const treeId of watchedTreeIds.value) {
        const treeItem = testTree.treeItemById(treeId);
        const fileName = treeItem?.location.file;
        if (fileName && set.has(fileName))
          testIds.push(...testTree.collectTestIds(treeItem));
      }
    }
    runTests('queue-if-busy', new Set(testIds));
  };

  return <TestTreeView
    name='tests'
    treeState={treeState}
    setTreeState={setTreeState}
    rootItem={testTree.rootItem}
    dataTestId='test-tree'
    render={treeItem => {
      return <div className='hbox ui-mode-list-item'>
        <div className='ui-mode-list-item-title' title={treeItem.title}>{treeItem.title}</div>
        {!!treeItem.duration && treeItem.status !== 'skipped' && <div className='ui-mode-list-item-time'>{msToString(treeItem.duration)}</div>}
        <Toolbar noMinHeight={true} noShadow={true}>
          <ToolbarButton icon='play' title='Run' onClick={() => runTreeItem(treeItem)} disabled={!!runningState}></ToolbarButton>
          <ToolbarButton icon='go-to-file' title='Open in VS Code' onClick={() => sendMessageNoReply('open', { location: testTree.locationToOpen(treeItem) })} style={(treeItem.kind === 'group' && treeItem.subKind === 'folder') ? { visibility: 'hidden' } : {}}></ToolbarButton>
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
    icon={treeItem => testStatusIcon(treeItem.status)}
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
  item: { treeItem?: TreeItem, testFile?: SourceLocation, testCase?: reporterTypes.TestCase },
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
    showSourcesFirst={true}
    rootDir={rootDir}
    initialSelection={initialSelection}
    onSelectionChanged={onSelectionChanged}
    fallbackLocation={item.testFile}
    isLive={model?.isLive}
    status={item.treeItem?.status} />;
};

let teleSuiteUpdater: TeleSuiteUpdater | undefined;

let throttleTimer: NodeJS.Timeout | undefined;
let throttleData: { config: reporterTypes.FullConfig, rootSuite: reporterTypes.Suite, loadErrors: reporterTypes.TestError[], progress: Progress } | undefined;
const throttledAction = () => {
  clearTimeout(throttleTimer);
  throttleTimer = undefined;
  updateRootSuite(throttleData!.config, throttleData!.rootSuite, throttleData!.loadErrors, throttleData!.progress);
};

const throttleUpdateRootSuite = (config: reporterTypes.FullConfig, rootSuite: reporterTypes.Suite, loadErrors: reporterTypes.TestError[], progress: Progress, immediate = false) => {
  throttleData = { config, rootSuite, loadErrors, progress };
  if (immediate)
    throttledAction();
  else if (!throttleTimer)
    throttleTimer = setTimeout(throttledAction, 250);
};

const refreshRootSuite = (): Promise<void> => {
  teleSuiteUpdater = new TeleSuiteUpdater({
    onUpdate: (source, immediate) => {
      throttleUpdateRootSuite(source.config!, source.rootSuite || new TeleSuite('', 'root'), source.loadErrors, source.progress, immediate);
    },
    onError: error => {
      xtermDataSource.write((error.stack || error.value || '') + '\n');
    },
    pathSeparator,
  });
  return sendMessage('listTests', {});
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

const dispatchEvent = (method: string, params?: any) => {
  if (method === 'listChanged') {
    sendMessage('listTests', {}).catch(() => {});
    return;
  }

  if (method === 'testFilesChanged') {
    runWatchedTests(params.testFileNames);
    return;
  }

  if (method === 'stdio') {
    if (params.buffer) {
      const data = atob(params.buffer);
      xtermDataSource.write(data);
    } else {
      xtermDataSource.write(params.text);
    }
    return;
  }

  if (method === 'listReport')
    teleSuiteUpdater?.dispatch('list', params);
  if (method === 'testReport')
    teleSuiteUpdater?.dispatch('test', params);
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
  const response = await fetch(`contexts?${params.toString()}`);
  const contextEntries = await response.json() as ContextEntry[];
  return new MultiTraceModel(contextEntries);
}

export const pathSeparator = navigator.userAgent.toLowerCase().includes('windows') ? '\\' : '/';
