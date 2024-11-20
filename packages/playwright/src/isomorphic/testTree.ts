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

// -- Reuse boundary -- Everything below this line is reused in the vscode extension.

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
  test: reporterTypes.TestCase | undefined;
  project: reporterTypes.FullProject | undefined;
  tags: Array<string>;
};

export type TestItem = TreeItemBase & {
  kind: 'test',
  test: reporterTypes.TestCase;
  project: reporterTypes.FullProject;
};

export type TreeItem = GroupItem | TestCaseItem | TestItem;

export class TestTree {
  rootItem: GroupItem;
  private _treeItemById = new Map<string, TreeItem>();
  private _treeItemByTestId = new Map<string, TestItem | TestCaseItem>();
  readonly pathSeparator: string;

  constructor(rootFolder: string, rootSuite: reporterTypes.Suite | undefined, loadErrors: reporterTypes.TestError[], projectFilters: Map<string, boolean> | undefined, pathSeparator: string) {
    const filterProjects = projectFilters && [...projectFilters.values()].some(Boolean);
    this.pathSeparator = pathSeparator;
    this.rootItem = {
      kind: 'group',
      subKind: 'folder',
      id: rootFolder,
      title: '',
      location: { file: '', line: 0, column: 0 },
      duration: 0,
      parent: undefined,
      children: [],
      status: 'none',
      hasLoadErrors: false,
    };
    this._treeItemById.set(rootFolder, this.rootItem);

    const visitSuite = (project: reporterTypes.FullProject, parentSuite: reporterTypes.Suite, parentGroup: GroupItem) => {
      for (const suite of parentSuite.suites) {
        if (!suite.title) {
          // Flatten anonymous describes.
          visitSuite(project, suite, parentGroup);
          continue;
        }

        let group = parentGroup.children.find(item => item.kind === 'group' && item.title === suite.title) as GroupItem | undefined;
        if (!group) {
          group = {
            kind: 'group',
            subKind: 'describe',
            id: 'suite:' + parentSuite.titlePath().join('\x1e') + '\x1e' + suite.title,  // account for anonymous suites
            title: suite.title,
            location: suite.location!,
            duration: 0,
            parent: parentGroup,
            children: [],
            status: 'none',
            hasLoadErrors: false,
          };
          this._addChild(parentGroup, group);
        }
        visitSuite(project, suite, group);
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
            project: undefined,
            test: undefined,
            tags: test.tags,
          };
          this._addChild(parentGroup, testCaseItem);
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
        const testItem: TestItem = {
          kind: 'test',
          id: test.id,
          title: project.name,
          location: test.location!,
          test,
          parent: testCaseItem,
          children: [],
          status,
          duration: test.results.length ? Math.max(0, test.results[0].duration) : 0,
          project,
        };
        this._addChild(testCaseItem, testItem);
        this._treeItemByTestId.set(test.id, testItem);
        testCaseItem.duration = (testCaseItem.children as TestItem[]).reduce((a, b) => a + b.duration, 0);
      }
    };

    for (const projectSuite of rootSuite?.suites || []) {
      if (filterProjects && !projectFilters.get(projectSuite.title))
        continue;
      for (const fileSuite of projectSuite.suites) {
        const fileItem = this._fileItem(fileSuite.location!.file.split(pathSeparator), true);
        visitSuite(projectSuite.project()!, fileSuite, fileItem);
      }
    }

    for (const loadError of loadErrors) {
      if (!loadError.location)
        continue;
      const fileItem = this._fileItem(loadError.location.file.split(pathSeparator), true);
      fileItem.hasLoadErrors = true;
    }
  }

  private _addChild(parent: TreeItem, child: TreeItem) {
    parent.children.push(child);
    child.parent = parent;
    this._treeItemById.set(child.id, child);
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

  private _fileItem(filePath: string[], isFile: boolean): GroupItem {
    if (filePath.length === 0)
      return this.rootItem;
    const fileName = filePath.join(this.pathSeparator);
    const existingFileItem = this._treeItemById.get(fileName);
    if (existingFileItem)
      return existingFileItem as GroupItem;
    const parentFileItem = this._fileItem(filePath.slice(0, filePath.length - 1), false);
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
    this._addChild(parentFileItem, fileItem);
    return fileItem;
  }

  sortAndPropagateStatus() {
    sortAndPropagateStatus(this.rootItem);
  }

  flattenForSingleProject() {
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'case' && treeItem.children.length === 1) {
        treeItem.project = treeItem.children[0].project;
        treeItem.test = treeItem.children[0].test;
        treeItem.children = [];
        this._treeItemByTestId.set(treeItem.test.id, treeItem);
      } else {
        treeItem.children.forEach(visit);
      }
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

  testIds(): Set<string> {
    const result = new Set<string>();
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'case')
        treeItem.tests.forEach(t => result.add(t.id));
      treeItem.children.forEach(visit);
    };
    visit(this.rootItem);
    return result;
  }

  fileNames(): string[] {
    const result = new Set<string>();
    const visit = (treeItem: TreeItem) => {
      if (treeItem.kind === 'group' && treeItem.subKind === 'file')
        result.add(treeItem.id);
      else
        treeItem.children.forEach(visit);
    };
    visit(this.rootItem);
    return [...result];
  }

  flatTreeItems(): TreeItem[] {
    const result: TreeItem[] = [];
    const visit = (treeItem: TreeItem) => {
      result.push(treeItem);
      treeItem.children.forEach(visit);
    };
    visit(this.rootItem);
    return result;
  }

  treeItemById(id: string): TreeItem | undefined {
    return this._treeItemById.get(id);
  }

  collectTestIds(treeItem?: TreeItem): Set<string> {
    return treeItem ? collectTestIds(treeItem) : new Set();
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

export function collectTestIds(treeItem: TreeItem): Set<string> {
  const testIds = new Set<string>();
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

export const statusEx = Symbol('statusEx');
