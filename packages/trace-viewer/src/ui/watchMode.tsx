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
import type { TeleTestCase } from '../../../playwright-test/src/isomorphic/teleReceiver';
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
import { Expandable } from '@web/components/expandable';

let updateRootSuite: (rootSuite: Suite, progress: Progress) => void = () => {};
let updateStepsProgress: () => void = () => {};
let runWatchedTests = () => {};
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
  const [projects, setProjects] = React.useState<Map<string, boolean>>(new Map());
  const [rootSuite, setRootSuite] = React.useState<{ value: Suite | undefined }>({ value: undefined });
  const [isRunningTest, setIsRunningTest] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<Progress>({ total: 0, passed: 0, failed: 0, skipped: 0 });
  const [selectedTest, setSelectedTest] = React.useState<TestCase | undefined>(undefined);
  const [settingsVisible, setSettingsVisible] = React.useState<boolean>(false);
  const [isWatchingFiles, setIsWatchingFiles] = React.useState<boolean>(true);
  const [visibleTestIds, setVisibleTestIds] = React.useState<string[]>([]);
  const [filterText, setFilterText] = React.useState<string>('');
  const [filterExpanded, setFilterExpanded] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    refreshRootSuite(true);
  }, []);

  updateRootSuite = (rootSuite: Suite, newProgress: Progress) => {
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

    setRootSuite({ value: rootSuite });
    setProjects(new Map(projects));
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
    setIsRunningTest(true);
    sendMessage('run', { testIds }).then(() => {
      setIsRunningTest(false);
    });
  };

  const updateFilter = (name: string, value: string) => {
    const result: string[] = [];
    const prefix = name + ':';
    for (const t of filterText.split(' ')) {
      if (t.startsWith(prefix)) {
        if (value) {
          result.push(prefix + value);
          value = '';
        }
      } else {
        result.push(t);
      }
    }
    if (value)
      result.unshift(prefix + value);
    setFilterText(result.join(' '));
  };

  const result = selectedTest?.results[0];
  return <div className='vbox'>
    <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true}>
      {(result && result.duration >= 0) ? <FinishedTraceView testResult={result} /> : <InProgressTraceView testResult={result} />}
      <div className='vbox watch-mode-sidebar'>
        <Toolbar>
          <div className='section-title' style={{ cursor: 'pointer' }} onClick={() => setSettingsVisible(false)}>Tests</div>
          <ToolbarButton icon='play' title='Run' onClick={() => runTests(visibleTestIds)} disabled={isRunningTest}></ToolbarButton>
          <ToolbarButton icon='debug-stop' title='Stop' onClick={() => sendMessageNoReply('stop')} disabled={!isRunningTest}></ToolbarButton>
          <ToolbarButton icon='refresh' title='Reload' onClick={() => refreshRootSuite(true)} disabled={isRunningTest}></ToolbarButton>
          <ToolbarButton icon='eye-watch' title='Watch' toggled={isWatchingFiles} onClick={() => setIsWatchingFiles(!isWatchingFiles)}></ToolbarButton>
          <div className='spacer'></div>
          <ToolbarButton icon='gear' title='Toggle color mode' toggled={settingsVisible} onClick={() => { setSettingsVisible(!settingsVisible); }}></ToolbarButton>
        </Toolbar>
        {!settingsVisible && <Expandable
          title={<input ref={inputRef} type='search' placeholder='Filter (e.g. text, @tag)' spellCheck={false} value={filterText}
            onChange={e => {
              setFilterText(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter')
                runTests(visibleTestIds);
            }}></input>}
          style={{ flex: 'none', marginTop: 8 }}
          expanded={filterExpanded}
          setExpanded={setFilterExpanded}>
          <div className='filters'>
            <span>Status:</span>
            <div onClick={() => updateFilter('s', '')}>all</div>
            {['failed', 'passed', 'skipped'].map(s => <div className={filterText.includes('s:' + s) ? 'filters-toggled' : ''} onClick={() => updateFilter('s', s)}>{s}</div>)}
          </div>
          {[...projects.values()].filter(v => v).length > 1 && <div className='filters'>
            <span>Project:</span>
            <div onClick={() => updateFilter('p', '')}>all</div>
            {[...projects].filter(([k, v]) => v).map(([k, v]) => k).map(p => <div  className={filterText.includes('p:' + p) ? 'filters-toggled' : ''} onClick={() => updateFilter('p', p)}>{p}</div>)}
          </div>}
        </Expandable>}
        <TestList
          projects={projects}
          filterText={filterText}
          rootSuite={rootSuite}
          isRunningTest={isRunningTest}
          isWatchingFiles={isWatchingFiles}
          runTests={runTests}
          onTestSelected={setSelectedTest}
          isVisible={!settingsVisible}
          setVisibleTestIds={setVisibleTestIds} />
        {settingsVisible && <SettingsView projects={projects} setProjects={setProjects} onClose={() => setSettingsVisible(false)}></SettingsView>}
      </div>
    </SplitView>
    <div className='status-line'>
      <div>Total: {progress.total}</div>
      {isRunningTest && <div><span className='codicon codicon-loading'></span>Running {visibleTestIds.length}</div>}
      {!isRunningTest && <div>Showing: {visibleTestIds.length}</div>}
      <div>{progress.passed} passed</div>
      <div>{progress.failed} failed</div>
      <div>{progress.skipped} skipped</div>
    </div>
  </div>;
};

const TreeListView = TreeView<TreeItem>;

export const TestList: React.FC<{
  projects: Map<string, boolean>,
  filterText: string,
  rootSuite: { value: Suite | undefined },
  runTests: (testIds: string[]) => void,
  isRunningTest: boolean,
  isWatchingFiles: boolean,
  isVisible: boolean,
  setVisibleTestIds: (testIds: string[]) => void,
  onTestSelected: (test: TestCase | undefined) => void,
}> = ({ projects, filterText, rootSuite, runTests, isRunningTest, isWatchingFiles, isVisible, onTestSelected, setVisibleTestIds }) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const [selectedTreeItemId, setSelectedTreeItemId] = React.useState<string | undefined>();

  React.useEffect(() => {
    refreshRootSuite(true);
  }, []);

  const { rootItem, treeItemMap } = React.useMemo(() => {
    const rootItem = createTree(rootSuite.value, projects);
    filterTree(rootItem, filterText);
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
  }, [filterText, rootSuite, projects, setVisibleTestIds]);

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
    setSelectedTreeItemId(treeItem.id);
    runTests(collectTestIds(treeItem));
  };

  runWatchedTests = () => {
    runTests(collectTestIds(selectedTreeItem));
  };

  if (!isVisible)
    return <></>;

  return <TreeListView
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
      if (treeItem.status === 'skipped')
        return 'codicon-circle-slash';
      return 'codicon-circle-outline';
    }}
    selectedItem={selectedTreeItem}
    onAccepted={runTreeItem}
    onSelected={treeItem => {
      setSelectedTreeItemId(treeItem.id);
    }}
    noItemsMessage='No tests' />;
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
      return <div style={{ display: 'flex', alignItems: 'center', lineHeight: '24px', marginLeft: 5 }}>
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

export const InProgressTraceView: React.FC<{
  testResult: TestResult | undefined,
}> = ({ testResult }) => {
  const [model, setModel] = React.useState<MultiTraceModel | undefined>();
  const [stepsProgress, setStepsProgress] = React.useState(0);
  updateStepsProgress = () => setStepsProgress(stepsProgress + 1);

  React.useEffect(() => {
    setModel(testResult ? stepsToModel(testResult) : undefined);
  }, [stepsProgress, testResult]);

  return <TraceView model={model} />;
};

export const FinishedTraceView: React.FC<{
  testResult: TestResult,
}> = ({ testResult }) => {
  const [model, setModel] = React.useState<MultiTraceModel | undefined>();

  React.useEffect(() => {
    // Test finished.
    const attachment = testResult.attachments.find(a => a.name === 'trace');
    if (attachment && attachment.path)
      loadSingleTraceFile(attachment.path).then(setModel);
  }, [testResult]);

  return <TraceView model={model} />;
};

export const TraceView: React.FC<{
  model: MultiTraceModel | undefined,
}> = ({ model }) => {
  const xterm = <XtermWrapper source={xtermDataSource}></XtermWrapper>;
  return <Workbench model={model} output={xterm} rightToolbar={[
    <ToolbarButton icon='trash' title='Clear output' onClick={() => xtermDataSource.clear()}></ToolbarButton>,
  ]} hideTimelineBars={true} hideStackFrames={true} />;
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
      // This will update selected trace viewer.
      updateStepsProgress();
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

function createTree(rootSuite: Suite | undefined, projects: Map<string, boolean>): GroupItem {
  const rootItem: GroupItem = {
    kind: 'group',
    id: 'root',
    title: '',
    location: { file: '', line: 0, column: 0 },
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
        children: [],
        status,
        project: projectName
      });
    }
  };

  for (const projectSuite of rootSuite?.suites || []) {
    if (!projects.get(projectSuite.title))
      continue;
    visitSuite(projectSuite.title, projectSuite, rootItem);
  }

  const propagateStatus = (treeItem: TreeItem) => {
    for (const child of treeItem.children)
      propagateStatus(child);

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
  propagateStatus(rootItem);
  return rootItem;
}

function filterTree(rootItem: GroupItem, filterText: string) {
  const trimmedFilterText = filterText.trim();
  const filterTokens = trimmedFilterText.toLowerCase().split(' ');
  const textTokens = filterTokens.filter(token => !token.match(/^[sp]:/));
  const statuses = new Set(filterTokens.filter(t => t.startsWith('s:')).map(t => t.substring(2)));
  if (statuses.size)
    statuses.add('running');
  const projects = new Set(filterTokens.filter(t => t.startsWith('p:')).map(t => t.substring(2)));

  const filter = (testCase: TestCaseItem) => {
    const title = testCase.tests[0].titlePath().join(' ').toLowerCase();
    if (!textTokens.every(token => title.includes(token)))
      return false;
    testCase.children = (testCase.children as TestItem[]).filter(test => !statuses.size || statuses.has(test.status));
    testCase.children = (testCase.children as TestItem[]).filter(test => !projects.size || projects.has(test.project));
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
