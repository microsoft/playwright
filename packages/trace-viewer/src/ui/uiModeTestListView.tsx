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

import type { TreeItem } from '@testIsomorphic/testTree';
import type { TestTree } from '@testIsomorphic/testTree';
import '@web/common.css';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton } from '@web/components/toolbarButton';
import type { TreeState } from '@web/components/treeView';
import { TreeView } from '@web/components/treeView';
import '@web/third_party/vscode/codicon.css';
import { msToString } from '@web/uiUtils';
import type * as reporterTypes from 'playwright/types/testReporter';
import React from 'react';
import type { SourceLocation } from './modelUtil';
import { testStatusIcon } from './testUtils';
import './uiModeTestListView.css';
import type { TestServerConnection } from '@testIsomorphic/testServerConnection';
import { TagView } from './tag';
import type { TeleSuiteUpdaterTestModel } from '@testIsomorphic/teleSuiteUpdater';

const TestTreeView = TreeView<TreeItem>;

export const TestListView: React.FC<{
  filterText: string,
  testTree: TestTree,
  testServerConnection: TestServerConnection | undefined,
  testModel?: TeleSuiteUpdaterTestModel,
  runTests: (mode: 'bounce-if-busy' | 'queue-if-busy', testIds: Set<string>) => void,
  runningState?: { testIds: Set<string>, itemSelectedByUser?: boolean, completed?: boolean },
  watchAll: boolean,
  watchedTreeIds: { value: Set<string> },
  setWatchedTreeIds: (ids: { value: Set<string> }) => void,
  isLoading?: boolean,
  onItemSelected: (item: { treeItem?: TreeItem, testCase?: reporterTypes.TestCase, testFile?: SourceLocation }) => void,
  requestedCollapseAllCount: number,
  requestedExpandAllCount: number,
  setFilterText: (text: string) => void,
  onRevealSource: () => void,
}> = ({ filterText, testModel, testServerConnection, testTree, runTests, runningState, watchAll, watchedTreeIds, setWatchedTreeIds, isLoading, onItemSelected, requestedCollapseAllCount, requestedExpandAllCount, setFilterText, onRevealSource }) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const [selectedTreeItemId, setSelectedTreeItemId] = React.useState<string | undefined>();
  const [collapseAllCount, setCollapseAllCount] = React.useState(requestedCollapseAllCount);
  const [expandAllCount, setExpandAllCount] = React.useState(requestedExpandAllCount);

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

    if (expandAllCount !== requestedExpandAllCount) {
      treeState.expandedItems.clear();
      for (const item of testTree.flatTreeItems())
        treeState.expandedItems.set(item.id, true);
      setExpandAllCount(requestedExpandAllCount);
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
  }, [runningState, setSelectedTreeItemId, testTree, collapseAllCount, setCollapseAllCount, requestedCollapseAllCount, expandAllCount, setExpandAllCount, requestedExpandAllCount, treeState, setTreeState]);

  // Compute selected item
  const selectedTreeItem = React.useMemo(() => {
    if (!selectedTreeItemId)
      return undefined;
    return testTree.treeItemById(selectedTreeItemId);
  }, [selectedTreeItemId, testTree]);

  // Handle selection effects separately
  React.useEffect(() => {
    if (!testModel)
      return;
    const testFile = itemLocation(selectedTreeItem, testModel);
    let selectedTest: reporterTypes.TestCase | undefined;
    if (selectedTreeItem?.kind === 'test')
      selectedTest = selectedTreeItem.test;
    else if (selectedTreeItem?.kind === 'case' && selectedTreeItem.tests.length === 1)
      selectedTest = selectedTreeItem.tests[0];
    onItemSelected({ treeItem: selectedTreeItem, testCase: selectedTest, testFile });
  }, [testModel, selectedTreeItem, onItemSelected]);

  // Update watch all.
  React.useEffect(() => {
    if (isLoading)
      return;
    if (watchAll) {
      testServerConnection?.watchNoReply({ fileNames: testTree.fileNames() });
    } else {
      const fileNames = new Set<string>();
      for (const itemId of watchedTreeIds.value) {
        const treeItem = testTree.treeItemById(itemId);
        const fileName = treeItem?.location.file;
        if (fileName)
          fileNames.add(fileName);
      }
      testServerConnection?.watchNoReply({ fileNames: [...fileNames] });
    }
  }, [isLoading, testTree, watchAll, watchedTreeIds, testServerConnection]);

  const runTreeItem = (treeItem: TreeItem) => {
    setSelectedTreeItemId(treeItem.id);
    runTests('bounce-if-busy', testTree.collectTestIds(treeItem));
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) {
      const parts = filterText.split(' ');
      if (parts.includes(tag))
        setFilterText(parts.filter(t => t !== tag).join(' ').trim());
      else
        setFilterText((filterText + ' ' + tag).trim());
    } else {
      // Replace all existing tags with this tag.
      setFilterText((filterText.split(' ').filter(t => !t.startsWith('@')).join(' ') + ' ' + tag).trim());
    }
  };

  return <TestTreeView
    name='tests'
    treeState={treeState}
    setTreeState={setTreeState}
    rootItem={testTree.rootItem}
    dataTestId='test-tree'
    render={treeItem => {
      const prefixId = treeItem.id.replace(/[^\w\d-_]/g, '-');
      const labelId = prefixId + '-label';
      const timeId = prefixId + '-time';
      return <div className='hbox ui-mode-tree-item' aria-labelledby={`${labelId} ${timeId}`}>
        <div id={labelId} className='ui-mode-tree-item-title'>
          <span>{treeItem.title}</span>
          {treeItem.kind === 'case' ? treeItem.tags.map(tag => <TagView key={tag} tag={tag.slice(1)} onClick={e => handleTagClick(e, tag)} />) : null}
        </div>
        {!!treeItem.duration && treeItem.status !== 'skipped' && <div id={timeId} className='ui-mode-tree-item-time'>{msToString(treeItem.duration)}</div>}
        <Toolbar noMinHeight={true} noShadow={true}>
          <ToolbarButton icon='play' title='Run' onClick={() => runTreeItem(treeItem)} disabled={!!runningState && !runningState.completed}></ToolbarButton>
          <ToolbarButton icon='go-to-file' title='Show source' onClick={onRevealSource} style={(treeItem.kind === 'group' && treeItem.subKind === 'folder') ? { visibility: 'hidden' } : {}}></ToolbarButton>
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
    title={treeItem => treeItem.title}
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

function itemLocation(item: TreeItem | undefined, model: TeleSuiteUpdaterTestModel | undefined): SourceLocation | undefined {
  if (!item || !model)
    return;
  return {
    file: item.location.file,
    line: item.location.line,
    column: item.location.column,
    source: {
      errors: model.loadErrors.filter(e => e.location?.file === item.location.file).map(e => ({ line: e.location!.line, message: e.message! })),
      content: undefined,
    }
  };
}
