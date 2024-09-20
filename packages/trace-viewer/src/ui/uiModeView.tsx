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
import '@web/common.css';
import React from 'react';
import { TeleSuite } from '@testIsomorphic/teleReceiver';
import { TeleSuiteUpdater, type TeleSuiteUpdaterProgress, type TeleSuiteUpdaterTestModel } from '@testIsomorphic/teleSuiteUpdater';
import type { TeleTestCase } from '@testIsomorphic/teleReceiver';
import type * as reporterTypes from 'playwright/types/testReporter';
import { SplitView } from '@web/components/splitView';
import type { SourceLocation } from './modelUtil';
import './uiModeView.css';
import { ToolbarButton } from '@web/components/toolbarButton';
import { Toolbar } from '@web/components/toolbar';
import type { XtermDataSource } from '@web/components/xtermWrapper';
import { XtermWrapper } from '@web/components/xtermWrapper';
import { useDarkModeSetting } from '@web/theme';
import { clsx, settings, useSetting } from '@web/uiUtils';
import { statusEx, TestTree } from '@testIsomorphic/testTree';
import type { TreeItem  } from '@testIsomorphic/testTree';
import { TestServerConnection, WebSocketTestServerTransport } from '@testIsomorphic/testServerConnection';
import { FiltersView } from './uiModeFiltersView';
import { TestListView } from './uiModeTestListView';
import { TraceView } from './uiModeTraceView';
import { SettingsView } from './settingsView';

let xtermSize = { cols: 80, rows: 24 };
const xtermDataSource: XtermDataSource = {
  pending: [],
  clear: () => {},
  write: data => xtermDataSource.pending.push(data),
  resize: () => {},
};

const searchParams = new URLSearchParams(window.location.search);
const guid = searchParams.get('ws');
const wsURL = new URL(`../${guid}`, window.location.toString());
wsURL.protocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
const queryParams = {
  args: searchParams.getAll('arg'),
  grep: searchParams.get('grep') || undefined,
  grepInvert: searchParams.get('grepInvert') || undefined,
  projects: searchParams.getAll('project'),
  workers: searchParams.get('workers') || undefined,
  timeout: searchParams.has('timeout') ? +searchParams.get('timeout')! : undefined,
  headed: searchParams.has('headed'),
  outputDir: searchParams.get('outputDir') || undefined,
  updateSnapshots: (searchParams.get('updateSnapshots') as 'all' | 'none' | 'missing' | undefined) || undefined,
  reporters: searchParams.has('reporter') ? searchParams.getAll('reporter') : undefined,
  pathSeparator: searchParams.get('pathSeparator') || '/',
};
if (queryParams.updateSnapshots && !['all', 'none', 'missing'].includes(queryParams.updateSnapshots))
  queryParams.updateSnapshots = undefined;

const isMac = navigator.platform === 'MacIntel';

export const UIModeView: React.FC<{}> = ({
}) => {
  const [filterText, setFilterText] = React.useState<string>('');
  const [isShowingOutput, setIsShowingOutput] = React.useState<boolean>(false);
  const [outputContainsError, setOutputContainsError] = React.useState(false);
  const [statusFilters, setStatusFilters] = React.useState<Map<string, boolean>>(new Map([
    ['passed', false],
    ['failed', false],
    ['skipped', false],
  ]));
  const [projectFilters, setProjectFilters] = React.useState<Map<string, boolean>>(new Map());
  const [testModel, setTestModel] = React.useState<TeleSuiteUpdaterTestModel>();
  const [progress, setProgress] = React.useState<TeleSuiteUpdaterProgress & { total: number } | undefined>();
  const [selectedItem, setSelectedItem] = React.useState<{ treeItem?: TreeItem, testFile?: SourceLocation, testCase?: reporterTypes.TestCase }>({});
  const [visibleTestIds, setVisibleTestIds] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [runningState, setRunningState] = React.useState<{ testIds: Set<string>, itemSelectedByUser?: boolean, completed?: boolean } | undefined>();
  const isRunningTest = runningState && !runningState.completed;

  const [watchAll, setWatchAll] = useSetting<boolean>('watch-all', false);
  const [watchedTreeIds, setWatchedTreeIds] = React.useState<{ value: Set<string> }>({ value: new Set() });
  const commandQueue = React.useRef(Promise.resolve());
  const runTestBacklog = React.useRef<Set<string>>(new Set());
  const [collapseAllCount, setCollapseAllCount] = React.useState(0);
  const [isDisconnected, setIsDisconnected] = React.useState(false);
  const [hasBrowsers, setHasBrowsers] = React.useState(true);
  const [testServerConnection, setTestServerConnection] = React.useState<TestServerConnection>();
  const [teleSuiteUpdater, setTeleSuiteUpdater] = React.useState<TeleSuiteUpdater>();
  const [settingsVisible, setSettingsVisible] = React.useState(false);
  const [testingOptionsVisible, setTestingOptionsVisible] = React.useState(false);
  const [revealSource, setRevealSource] = React.useState(false);
  const onRevealSource = React.useCallback(() => setRevealSource(true), [setRevealSource]);

  const showTestingOptions = false;
  const [singleWorker, setSingleWorker] = React.useState(queryParams.workers === '1');
  const [showBrowser, setShowBrowser] = React.useState(queryParams.headed);
  const [updateSnapshots, setUpdateSnapshots] = React.useState(queryParams.updateSnapshots === 'all');
  const [darkMode, setDarkMode] = useDarkModeSetting();
  const [showScreenshot, setShowScreenshot] = useSetting('screenshot-instead-of-snapshot', false);


  const inputRef = React.useRef<HTMLInputElement>(null);

  const reloadTests = React.useCallback(() => {
    setTestServerConnection(new TestServerConnection(new WebSocketTestServerTransport(wsURL)));
  }, []);

  // Load tests on startup.
  React.useEffect(() => {
    inputRef.current?.focus();
    setIsLoading(true);
    reloadTests();
  }, [reloadTests]);

  // Wire server connection to the auxiliary UI features.
  React.useEffect(() => {
    if (!testServerConnection)
      return;
    const disposables = [
      testServerConnection.onStdio(params => {
        if (params.buffer) {
          const data = atob(params.buffer);
          xtermDataSource.write(data);
        } else {
          xtermDataSource.write(params.text!);
        }

        if (params.type === 'stderr')
          setOutputContainsError(true);
      }),
      testServerConnection.onClose(() => setIsDisconnected(true))
    ];
    xtermDataSource.resize = (cols, rows) => {
      xtermSize = { cols, rows };
      testServerConnection.resizeTerminalNoReply({ cols, rows });
    };
    return () => {
      for (const disposable of disposables)
        disposable.dispose();
    };
  }, [testServerConnection]);

  // This is the main routine, every time connection updates it starts the
  // whole workflow.
  React.useEffect(() => {
    if (!testServerConnection)
      return;

    let throttleTimer: NodeJS.Timeout | undefined;
    const teleSuiteUpdater = new TeleSuiteUpdater({
      onUpdate: immediate => {
        clearTimeout(throttleTimer);
        throttleTimer = undefined;
        if (immediate) {
          setTestModel(teleSuiteUpdater.asModel());
        } else if (!throttleTimer) {
          throttleTimer = setTimeout(() => {
            setTestModel(teleSuiteUpdater.asModel());
          }, 250);
        }
      },
      onError: error => {
        xtermDataSource.write((error.stack || error.value || '') + '\n');
        setOutputContainsError(true);
      },
      pathSeparator: queryParams.pathSeparator,
    });

    setTeleSuiteUpdater(teleSuiteUpdater);

    setTestModel(undefined);
    setIsLoading(true);
    setWatchedTreeIds({ value: new Set() });
    (async () => {
      try {
        await testServerConnection.initialize({
          interceptStdio: true,
          watchTestDirs: true
        });
        const { status, report } = await testServerConnection.runGlobalSetup({
          outputDir: queryParams.outputDir,
        });
        teleSuiteUpdater.processGlobalReport(report);
        if (status !== 'passed')
          return;

        const result = await testServerConnection.listTests({ projects: queryParams.projects, locations: queryParams.args, grep: queryParams.grep, grepInvert: queryParams.grepInvert, outputDir: queryParams.outputDir });
        teleSuiteUpdater.processListReport(result.report);

        testServerConnection.onReport(params => {
          teleSuiteUpdater.processTestReportEvent(params);
        });

        const { hasBrowsers } = await testServerConnection.checkBrowsers({});
        setHasBrowsers(hasBrowsers);
      } finally {
        setIsLoading(false);
      }
    })();
    return () => {
      clearTimeout(throttleTimer);
    };
  }, [testServerConnection]);

  // Update project filter default values.
  React.useEffect(() => {
    if (!testModel)
      return;

    const { config, rootSuite } = testModel;
    const selectedProjects = config.configFile ? settings.getObject<string[] | undefined>(config.configFile + ':projects', undefined) : undefined;
    const newFilter = new Map(projectFilters);
    for (const projectName of newFilter.keys()) {
      if (!rootSuite.suites.find(s => s.title === projectName))
        newFilter.delete(projectName);
    }
    for (const projectSuite of rootSuite.suites) {
      if (!newFilter.has(projectSuite.title))
        newFilter.set(projectSuite.title, !!selectedProjects?.includes(projectSuite.title));
    }
    if (!selectedProjects && newFilter.size && ![...newFilter.values()].includes(true))
      newFilter.set(newFilter.entries().next().value[0], true);
    if (projectFilters.size !== newFilter.size || [...projectFilters].some(([k, v]) => newFilter.get(k) !== v))
      setProjectFilters(newFilter);
  }, [projectFilters, testModel]);

  // Update progress.
  React.useEffect(() => {
    if (isRunningTest && testModel?.progress)
      setProgress(testModel.progress);
    else if (!testModel)
      setProgress(undefined);
  }, [testModel, isRunningTest]);

  // Test tree is built from the model and filters.
  const { testTree } = React.useMemo(() => {
    if (!testModel)
      return { testTree: new TestTree('', new TeleSuite('', 'root'), [], projectFilters, queryParams.pathSeparator) };
    const testTree = new TestTree('', testModel.rootSuite, testModel.loadErrors, projectFilters, queryParams.pathSeparator);
    testTree.filterTree(filterText, statusFilters, isRunningTest ? runningState?.testIds : undefined);
    testTree.sortAndPropagateStatus();
    testTree.shortenRoot();
    testTree.flattenForSingleProject();
    setVisibleTestIds(testTree.testIds());
    return { testTree };
  }, [filterText, testModel, statusFilters, projectFilters, setVisibleTestIds, runningState, isRunningTest]);

  const runTests = React.useCallback((mode: 'queue-if-busy' | 'bounce-if-busy', testIds: Set<string>) => {
    if (!testServerConnection || !testModel)
      return;
    if (mode === 'bounce-if-busy' && isRunningTest)
      return;

    runTestBacklog.current = new Set([...runTestBacklog.current, ...testIds]);
    commandQueue.current = commandQueue.current.then(async () => {
      const testIds = runTestBacklog.current;
      runTestBacklog.current = new Set();
      if (!testIds.size)
        return;

      // Clear test results.
      {
        for (const test of testModel.rootSuite?.allTests() || []) {
          if (testIds.has(test.id)) {
            test.results = [];
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

      await testServerConnection.runTests({
        locations: queryParams.args,
        grep: queryParams.grep,
        grepInvert: queryParams.grepInvert,
        testIds: [...testIds],
        projects: [...projectFilters].filter(([_, v]) => v).map(([p]) => p),
        // When started with `--workers=1`, the setting allows to undo that.
        // Otherwise, fallback to the cli `--workers=X` argument.
        workers: singleWorker ? '1' : (queryParams.workers === '1' ? undefined : queryParams.workers),
        timeout: queryParams.timeout,
        headed: showBrowser,
        outputDir: queryParams.outputDir,
        updateSnapshots: updateSnapshots ? 'all' : queryParams.updateSnapshots,
        reporters: queryParams.reporters,
        trace: 'on',
      });
      // Clear pending tests in case of interrupt.
      for (const test of testModel.rootSuite?.allTests() || []) {
        if (test.results[0]?.duration === -1)
          test.results = [];
      }
      setTestModel({ ...testModel });
      setRunningState(oldState => oldState ? ({ ...oldState, completed: true }) : undefined);
    });
  }, [projectFilters, isRunningTest, testModel, testServerConnection, singleWorker, showBrowser, updateSnapshots]);

  React.useEffect(() => {
    if (!testServerConnection || !teleSuiteUpdater)
      return;
    const disposable = testServerConnection.onTestFilesChanged(async params => {
      // fetch the new list of tests
      commandQueue.current = commandQueue.current.then(async () => {
        setIsLoading(true);
        try {
          const result = await testServerConnection.listTests({ projects: queryParams.projects, locations: queryParams.args, grep: queryParams.grep, grepInvert: queryParams.grepInvert, outputDir: queryParams.outputDir });
          teleSuiteUpdater.processListReport(result.report);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(e);
        } finally {
          setIsLoading(false);
        }
      });
      await commandQueue.current;

      if (params.testFiles.length === 0)
        return;

      // run affected watched tests
      const testModel = teleSuiteUpdater.asModel();
      const testTree = new TestTree('', testModel.rootSuite, testModel.loadErrors, projectFilters, queryParams.pathSeparator);

      const testIds: string[] = [];
      const set = new Set(params.testFiles);
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
    });
    return () => disposable.dispose();
  }, [runTests, testServerConnection, watchAll, watchedTreeIds, teleSuiteUpdater, projectFilters]);

  // Shortcuts.
  React.useEffect(() => {
    if (!testServerConnection)
      return;
    const onShortcutEvent = (e: KeyboardEvent) => {
      if (e.code === 'Backquote' && e.ctrlKey) {
        e.preventDefault();
        setIsShowingOutput(!isShowingOutput);
      } else if (e.code === 'F5' && e.shiftKey) {
        e.preventDefault();
        testServerConnection?.stopTestsNoReply({});
      } else if (e.code === 'F5') {
        e.preventDefault();
        runTests('bounce-if-busy', visibleTestIds);
      }
    };
    addEventListener('keydown', onShortcutEvent);
    return () => {
      removeEventListener('keydown', onShortcutEvent);
    };
  }, [runTests, reloadTests, testServerConnection, visibleTestIds, isShowingOutput]);

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
    testServerConnection?.installBrowsers({}).then(async () => {
      setIsShowingOutput(false);
      const { hasBrowsers } = await testServerConnection?.checkBrowsers({});
      setHasBrowsers(hasBrowsers);
    });
  }, [closeInstallDialog, testServerConnection]);

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
    <SplitView
      sidebarSize={250}
      minSidebarSize={150}
      orientation='horizontal'
      sidebarIsFirst={true}
      settingName='testListSidebar'
      main={<div className='vbox'>
        <div className={clsx('vbox', !isShowingOutput && 'hidden')}>
          <Toolbar>
            <div className='section-title' style={{ flex: 'none' }}>Output</div>
            <ToolbarButton icon='circle-slash' title='Clear output' onClick={() => { xtermDataSource.clear(); setOutputContainsError(false); }}></ToolbarButton>
            <div className='spacer'></div>
            <ToolbarButton icon='close' title='Close' onClick={() => setIsShowingOutput(false)}></ToolbarButton>
          </Toolbar>
          <XtermWrapper source={xtermDataSource}></XtermWrapper>
        </div>
        <div className={clsx('vbox', isShowingOutput && 'hidden')}>
          <TraceView
            pathSeparator={queryParams.pathSeparator}
            item={selectedItem}
            rootDir={testModel?.config?.rootDir}
            revealSource={revealSource}
            onOpenExternally={location => testServerConnection?.openNoReply({ location: { file: location.file, line: location.line, column: location.column } })}
          />
        </div>
      </div>}
      sidebar={<div className='vbox ui-mode-sidebar'>
        <Toolbar noShadow={true} noMinHeight={true}>
          <img src='playwright-logo.svg' alt='Playwright logo' />
          <div className='section-title'>Playwright</div>
          <ToolbarButton icon='refresh' title='Reload' onClick={() => reloadTests()} disabled={isRunningTest || isLoading}></ToolbarButton>
          <div style={{ position: 'relative' }}>
            <ToolbarButton icon={'terminal'} title={'Toggle output — ' + (isMac ? '⌃`' : 'Ctrl + `')} toggled={isShowingOutput} onClick={() => { setIsShowingOutput(!isShowingOutput); }} />
            {outputContainsError && <div title='Output contains error' style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--vscode-notificationsErrorIcon-foreground)' }} />}
          </div>
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
          <ToolbarButton icon='play' title='Run all — F5' onClick={() => runTests('bounce-if-busy', visibleTestIds)} disabled={isRunningTest || isLoading}></ToolbarButton>
          <ToolbarButton icon='debug-stop' title={'Stop — ' + (isMac ? '⇧F5' : 'Shift + F5')} onClick={() => testServerConnection?.stopTests({})} disabled={!isRunningTest || isLoading}></ToolbarButton>
          <ToolbarButton icon='eye' title='Watch all' toggled={watchAll} onClick={() => {
            setWatchedTreeIds({ value: new Set() });
            setWatchAll(!watchAll);
          }}></ToolbarButton>
          <ToolbarButton icon='collapse-all' title='Collapse all' onClick={() => {
            setCollapseAllCount(collapseAllCount + 1);
          }} />
        </Toolbar>
        <TestListView
          filterText={filterText}
          testModel={testModel}
          testTree={testTree}
          testServerConnection={testServerConnection}
          runningState={runningState}
          runTests={runTests}
          onItemSelected={setSelectedItem}
          watchAll={watchAll}
          watchedTreeIds={watchedTreeIds}
          setWatchedTreeIds={setWatchedTreeIds}
          isLoading={isLoading}
          requestedCollapseAllCount={collapseAllCount}
          setFilterText={setFilterText}
          onRevealSource={onRevealSource}
        />
        {showTestingOptions && <>
          <Toolbar noShadow={true} noMinHeight={true} className='settings-toolbar' onClick={() => setTestingOptionsVisible(!testingOptionsVisible)}>
            <span
              className={`codicon codicon-${testingOptionsVisible ? 'chevron-down' : 'chevron-right'}`}
              style={{ marginLeft: 5 }}
              title={testingOptionsVisible ? 'Hide Testing Options' : 'Show Testing Options'}
            />
            <div className='section-title'>Testing Options</div>
          </Toolbar>
          {testingOptionsVisible && <SettingsView settings={[
            { value: singleWorker, set: setSingleWorker, title: 'Single worker' },
            { value: showBrowser, set: setShowBrowser, title: 'Show browser' },
            { value: updateSnapshots, set: setUpdateSnapshots, title: 'Update snapshots' },
          ]} />}
        </>}
        <Toolbar noShadow={true} noMinHeight={true} className='settings-toolbar' onClick={() => setSettingsVisible(!settingsVisible)}>
          <span
            className={`codicon codicon-${settingsVisible ? 'chevron-down' : 'chevron-right'}`}
            style={{ marginLeft: 5 }}
            title={settingsVisible ? 'Hide Settings' : 'Show Settings'}
          />
          <div className='section-title'>Settings</div>
        </Toolbar>
        {settingsVisible && <SettingsView settings={[
          { value: darkMode, set: setDarkMode, title: 'Dark mode' },
          { value: showScreenshot, set: setShowScreenshot, title: 'Show screenshot instead of snapshot' },
        ]} />}
      </div>
      }
    />
  </div>;
};
