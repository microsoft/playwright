/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import * as React from 'react';
import { ListView } from './listView';

export type TreeItem = {
  id: string,
  parent: TreeItem | undefined,
  children: TreeItem[],
};

export type TreeState = {
  expandedItems: Map<string, boolean>;
};

export type TreeViewProps<T> = {
  rootItem: T,
  render: (item: T) => React.ReactNode,
  icon?: (item: T) => string | undefined,
  isError?: (item: T) => boolean,
  selectedItem?: T,
  onAccepted?: (item: T) => void,
  onSelected?: (item: T) => void,
  onHighlighted?: (item: T | undefined) => void,
  noItemsMessage?: string,
  dataTestId?: string,
  treeState: TreeState,
  setTreeState: (treeState: TreeState) => void,
  autoExpandDeep?: boolean,
};

const TreeListView = ListView<TreeItem>;

export function TreeView<T extends TreeItem>({
  rootItem,
  render,
  icon,
  isError,
  selectedItem,
  onAccepted,
  onSelected,
  onHighlighted,
  treeState,
  setTreeState,
  noItemsMessage,
  dataTestId,
  autoExpandDeep,
}: TreeViewProps<T>) {
  const treeItems = React.useMemo(() => {
    for (let item: TreeItem | undefined = selectedItem?.parent; item; item = item.parent)
      treeState.expandedItems.set(item.id, true);
    return flattenTree<T>(rootItem, treeState.expandedItems, autoExpandDeep);
  }, [rootItem, selectedItem, treeState, autoExpandDeep]);

  return <TreeListView
    items={[...treeItems.keys()]}
    id={item => item.id}
    dataTestId={dataTestId}
    render={item => {
      const rendered = render(item as T);
      return <>
        {icon && <div className={'codicon ' + (icon(item as T) || 'blank')} style={{ minWidth: 16, marginRight: 4 }}></div>}
        {typeof rendered === 'string' ? <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{rendered}</div> : rendered}
      </>;
    }}
    icon={item => {
      const expanded = treeItems.get(item as T)!.expanded;
      if (typeof expanded === 'boolean')
        return expanded ? 'codicon-chevron-down' : 'codicon-chevron-right';
    }}
    isError={item => isError?.(item as T) || false}
    indent={item => treeItems.get(item as T)!.depth}
    selectedItem={selectedItem}
    onAccepted={item => onAccepted?.(item as T)}
    onSelected={item => onSelected?.(item as T)}
    onHighlighted={item => onHighlighted?.(item as T)}
    onLeftArrow={item => {
      const { expanded, parent } = treeItems.get(item as T)!;
      if (expanded) {
        treeState.expandedItems.set(item.id, false);
        setTreeState({ ...treeState });
      } else if (parent) {
        onSelected?.(parent as T);
      }
    }}
    onRightArrow={item => {
      if (item.children.length) {
        treeState.expandedItems.set(item.id, true);
        setTreeState({ ...treeState });
      }
    }}
    onIconClicked={item => {
      const { expanded } = treeItems.get(item as T)!;
      if (expanded) {
        // Move nested selection up.
        for (let i: TreeItem | undefined = selectedItem; i; i = i.parent) {
          if (i === item) {
            onSelected?.(item as T);
            break;
          }
        }
        treeState.expandedItems.set(item.id, false);
      } else {
        treeState.expandedItems.set(item.id, true);
      }
      setTreeState({ ...treeState });
    }}
    noItemsMessage={noItemsMessage} />;
}

type TreeItemData = {
  depth: number,
  expanded: boolean | undefined,
  parent: TreeItem | null,
};

function flattenTree<T extends TreeItem>(rootItem: T, expandedItems: Map<string, boolean | undefined>, autoExpandDeep?: boolean): Map<T, TreeItemData> {
  const result = new Map<T, TreeItemData>();
  const appendChildren = (parent: T, depth: number) => {
    for (const item of parent.children as T[]) {
      const expandState = expandedItems.get(item.id);
      const autoExpandMatches = (autoExpandDeep || depth === 0) && result.size < 25 && expandState !== false;
      const expanded = item.children.length ? expandState || autoExpandMatches : undefined;
      result.set(item, { depth, expanded, parent: rootItem === parent ? null : parent });
      if (expanded)
        appendChildren(item, depth + 1);
    }
  };
  appendChildren(rootItem, 0);
  return result;
}
