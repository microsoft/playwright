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

export type TestItemStatus = 'none' | 'running' | 'scheduled' | 'passed' | 'failed' | 'skipped';
import type * as reporterTypes from '../../types/testReporter';

export type TreeItemBase = {
  kind: 'root' | 'group' | 'case' | 'test',
  id: string;
  title: string;
  location: reporterTypes.Location,
  duration: number;
  parent: TreeItem | undefined;
  children: TreeItem[];
  status: TestItemStatus;
};

export type GroupItem = TreeItemBase & {
  kind: 'group';
  subKind: 'folder' | 'file' | 'describe';
  hasLoadErrors: boolean;
  children: (TestCaseItem | GroupItem)[];
};

export type TestCaseItem = TreeItemBase & {
  kind: 'case',
  tests: reporterTypes.TestCase[];
  children: TestItem[];
};

export type TestItem = TreeItemBase & {
  kind: 'test',
  test: reporterTypes.TestCase;
  project: string;
};

export type TreeItem = GroupItem | TestCaseItem | TestItem;

export class TestTree {
  rootItem: GroupItem;
  readonly treeItemMap = new Map<string, TreeItem>();
  readonly visibleTestIds = new Set<string>();
  readonly fileNames = new Set<string>();

  constructor(rootSuite: reporterTypes.Suite | undefined, loadErrors: reporterTypes.TestError[], projectFilters: Map<string, boolean>) {
    const filterProjects = [...projectFilters.values()].some(Boolean);
    this.rootItem = {
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

    const visitSuite = (projectName: string, parentSuite: reporterTypes.Suite, parentGroup: GroupItem) => {
      for (const suite of parentSuite.suites) {
        const title = suite.title || '<anonymous>';
        let group = parentGroup.children.find(item => item.kind === 'group' && item.title === title) as GroupItem | undefined;
        if (!group) {
          group = {
            kind: 'group',
            subKind: 'describe',
            id: 'suite:' + parentSuite.titlePath().join('\x1e') + '\x1e' + title,  // account for anonymous suites
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
        let testCaseItem = parentGroup.children.find(t => t.kind !== 'group' && t.title === title) as TestCaseItem;
        if (!testCaseItem) {
          testCaseItem = {
            kind: 'case',
            id: 'test:' + test.titlePath().join('\x1e'),
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

        const result = test.results[0];
        let status: 'none' | 'running' | 'scheduled' | 'passed' | 'failed' | 'skipped' = 'none';
        if ((result as any)?.[statusEx] === 'scheduled')
          status = 'scheduled';
        else if ((result as any)?.[statusEx] === 'running')
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
        const fileItem = this._fileItem(fileSuite.location!.file.split(pathSeparator), true, fileMap);
        visitSuite(projectSuite.title, fileSuite, fileItem);
      }
    }

    for (const loadError of loadErrors) {
      if (!loadError.location)
        continue;
      const fileItem = this._fileItem(loadError.location.file.split(pathSeparator), true, fileMap);
      fileItem.hasLoadErrors = true;
    }
  }

  filterTree(filterText: string, statusFilters: Map<string, boolean>, runningTestIds: Set<string> | undefined) {
    const tokens = filterText.trim().toLowerCase().split(' ');
    const filtersStatuses = [...statusFilters.values()].some(Boolean);

    const filter = (testCase: TestCaseItem) => {
      const titleWithTags = [...testCase.tests[0].titlePath(), ...testCase.tests[0].tags].join(' ').toLowerCase();
      if (!tokens.every(token => titleWithTags.includes(token)) && !testCase.tests.some(t => runningTestIds?.has(t.id)))
        return false;
      testCase.children = (testCase.children as TestItem[]).filter(test => {
        return !filtersStatuses || runningTestIds?.has(test.test.id) || statusFilters.get(test.status);
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
    visit(this.rootItem);
  }

  private _fileItem(filePath: string[], isFile: boolean, fileItems: Map<string, GroupItem>): GroupItem {
    if (filePath.length === 0)
      return this.rootItem;
    const fileName = filePath.join(pathSeparator);
    const existingFileItem = fileItems.get(fileName);
    if (existingFileItem)
      return existingFileItem;
    const parentFileItem = this._fileItem(filePath.slice(0, filePath.length - 1), false, fileItems);
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

  sortAndPropagateStatus() {
    sortAndPropagateStatus(this.rootItem);
  }

  hideOnlyTests() {
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'case' && treeItem.children.length === 1)
        treeItem.children = [];
      else
        treeItem.children.forEach(visit);
    };
    visit(this.rootItem);
  }

  shortenRoot() {
    let shortRoot = this.rootItem;
    while (shortRoot.children.length === 1 && shortRoot.children[0].kind === 'group' && shortRoot.children[0].subKind === 'folder')
      shortRoot = shortRoot.children[0];
    shortRoot.location = this.rootItem.location;
    this.rootItem = shortRoot;
  }

  indexTree() {
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'group' && treeItem.location.file)
        this.fileNames.add(treeItem.location.file);
      if (treeItem.kind === 'case')
        treeItem.tests.forEach(t => this.visibleTestIds.add(t.id));
      treeItem.children.forEach(visit);
      this.treeItemMap.set(treeItem.id, treeItem);
    };
    visit(this.rootItem);
  }

  collectTestIds(treeItem?: TreeItem): Set<string> {
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
  }

  locationToOpen(treeItem?: TreeItem) {
    if (!treeItem)
      return;
    return treeItem.location.file + ':' + treeItem.location.line;
  }
}

export function sortAndPropagateStatus(treeItem: TreeItem) {
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

export const pathSeparator = navigator.userAgent.toLowerCase().includes('windows') ? '\\' : '/';
export const statusEx = Symbol('statusEx');
