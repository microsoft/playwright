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
import { clsx, scrollIntoViewIfNeeded } from '@web/uiUtils';
import './treeView.css';

export type TreeItem = {
  id: string,
  parent: TreeItem | undefined,
  children: TreeItem[],
};

export type TreeState = {
  expandedItems: Map<string, boolean>;
};

export type TreeViewProps<T> = {
  name: string,
  rootItem: T,
  render: (item: T) => React.ReactNode,
  icon?: (item: T) => string | undefined,
  isError?: (item: T) => boolean,
  isVisible?: (item: T) => boolean,
  selectedItem?: T,
  onAccepted?: (item: T) => void,
  onSelected?: (item: T) => void,
  onHighlighted?: (item: T | undefined) => void,
  noItemsMessage?: string,
  dataTestId?: string,
  treeState: TreeState,
  setTreeState: (treeState: TreeState) => void,
  autoExpandDepth?: number,
};

const scrollPositions = new Map<string, number>();

export function TreeView<T extends TreeItem>({
  name,
  rootItem,
  render,
  icon,
  isError,
  isVisible,
  selectedItem,
  onAccepted,
  onSelected,
  onHighlighted,
  treeState,
  setTreeState,
  noItemsMessage,
  dataTestId,
  autoExpandDepth,
}: TreeViewProps<T>) {
  const treeItems = React.useMemo(() => {
    return flattenTree<T>(rootItem, selectedItem, treeState.expandedItems, autoExpandDepth || 0);
  }, [rootItem, selectedItem, treeState, autoExpandDepth]);

  // Filter visible items.
  const visibleItems = React.useMemo(() => {
    if (!isVisible)
      return [...treeItems.keys()];
    const cachedVisible = new Map<TreeItem, boolean>();
    const visit = (item: TreeItem): boolean => {
      const cachedResult = cachedVisible.get(item);
      if (cachedResult !== undefined)
        return cachedResult;

      let hasVisibleChildren = item.children.some(child => visit(child));
      for (const child of item.children) {
        const result = visit(child);
        hasVisibleChildren = hasVisibleChildren || result;
      }
      const result = isVisible(item as T) || hasVisibleChildren;
      cachedVisible.set(item, result);
      return result;
    };
    for (const item of treeItems.keys())
      visit(item);
    const result: T[] = [];
    for (const item of treeItems.keys()) {
      if (isVisible(item))
        result.push(item);
    }
    return result;
  }, [treeItems, isVisible]);

  const itemListRef = React.useRef<HTMLDivElement>(null);
  const [highlightedItem, setHighlightedItem] = React.useState<any>();

  React.useEffect(() => {
    onHighlighted?.(highlightedItem);
  }, [onHighlighted, highlightedItem]);

  React.useEffect(() => {
    const treeElem = itemListRef.current;
    if (!treeElem)
      return;
    const saveScrollPosition = () => {
      scrollPositions.set(name, treeElem.scrollTop);
    };
    treeElem.addEventListener('scroll', saveScrollPosition, { passive: true });
    return () => treeElem.removeEventListener('scroll', saveScrollPosition);
  }, [name]);

  React.useEffect(() => {
    if (itemListRef.current)
      itemListRef.current.scrollTop = scrollPositions.get(name) || 0;
  }, [name]);

  const toggleExpanded = React.useCallback((item: T) => {
    const { expanded } = treeItems.get(item)!;
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
  }, [treeItems, selectedItem, onSelected, treeState, setTreeState]);

  return <div className={clsx(`tree-view vbox`, name + '-tree-view')} role={'tree'} data-testid={dataTestId || (name + '-tree')}>
    <div
      className={clsx('tree-view-content')}
      tabIndex={0}
      onKeyDown={event => {
        if (selectedItem && event.key === 'Enter') {
          onAccepted?.(selectedItem);
          return;
        }
        if (event.key !== 'ArrowDown' &&  event.key !== 'ArrowUp' && event.key !== 'ArrowLeft' &&  event.key !== 'ArrowRight')
          return;

        event.stopPropagation();
        event.preventDefault();

        if (selectedItem && event.key === 'ArrowLeft') {
          const { expanded, parent } = treeItems.get(selectedItem)!;
          if (expanded) {
            treeState.expandedItems.set(selectedItem.id, false);
            setTreeState({ ...treeState });
          } else if (parent) {
            onSelected?.(parent as T);
          }
          return;
        }
        if (selectedItem && event.key === 'ArrowRight') {
          if (selectedItem.children.length) {
            treeState.expandedItems.set(selectedItem.id, true);
            setTreeState({ ...treeState });
          }
          return;
        }

        const index = selectedItem ? visibleItems.indexOf(selectedItem) : -1;
        let newIndex = index;
        if (event.key === 'ArrowDown') {
          if (index === -1)
            newIndex = 0;
          else
            newIndex = Math.min(index + 1, visibleItems.length - 1);
        }
        if (event.key === 'ArrowUp') {
          if (index === -1)
            newIndex = visibleItems.length - 1;
          else
            newIndex = Math.max(index - 1, 0);
        }

        const element = itemListRef.current?.children.item(newIndex);
        scrollIntoViewIfNeeded(element || undefined);
        onHighlighted?.(undefined);
        onSelected?.(visibleItems[newIndex]);
        setHighlightedItem(undefined);
      }}
      ref={itemListRef}
    >
      {noItemsMessage && visibleItems.length === 0 && <div className='tree-view-empty'>{noItemsMessage}</div>}
      {visibleItems.map(item => {
        return <div key={item.id} role='treeitem' aria-selected={item === selectedItem}>
          <TreeItemHeader
            item={item}
            itemData={treeItems.get(item)!}
            selectedItem={selectedItem}
            onSelected={onSelected}
            onAccepted={onAccepted}
            isError={isError}
            toggleExpanded={toggleExpanded}
            highlightedItem={highlightedItem}
            setHighlightedItem={setHighlightedItem}
            render={render}
            icon={icon} />
        </div>;
      })}
    </div>
  </div>;
}

type TreeItemHeaderProps<T> = {
  item: T,
  itemData: TreeItemData,
  selectedItem: T | undefined,
  onSelected?: (item: T) => void,
  toggleExpanded: (item: T) => void,
  highlightedItem: T | undefined,
  isError?: (item: T) => boolean,
  onAccepted?: (item: T) => void,
  setHighlightedItem: (item: T | undefined) => void,
  render: (item: T) => React.ReactNode,
  icon?: (item: T) => string | undefined,
};

export function TreeItemHeader<T extends TreeItem>({
  item,
  itemData,
  selectedItem,
  onSelected,
  highlightedItem,
  setHighlightedItem,
  isError,
  onAccepted,
  toggleExpanded,
  render,
  icon }: TreeItemHeaderProps<T>) {

  const indentation = itemData.depth;
  const expanded = itemData.expanded;
  let expandIcon = 'codicon-blank';
  if (typeof expanded === 'boolean')
    expandIcon = expanded ? 'codicon-chevron-down' : 'codicon-chevron-right';
  const rendered = render(item);

  return <div
    onDoubleClick={() => onAccepted?.(item)}
    className={clsx(
        'tree-view-entry',
        selectedItem === item && 'selected',
        highlightedItem === item && 'highlighted',
        isError?.(item) && 'error')}
    onClick={() => onSelected?.(item)}
    onMouseEnter={() => setHighlightedItem(item)}
    onMouseLeave={() => setHighlightedItem(undefined)}
  >
    {indentation ? new Array(indentation).fill(0).map((_, i) => <div key={'indent-' + i} className='tree-view-indent'></div>) : undefined}
    <div
      className={'codicon ' + expandIcon}
      style={{ minWidth: 16, marginRight: 4 }}
      onDoubleClick={e => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={e => {
        e.stopPropagation();
        e.preventDefault();
        toggleExpanded(item);
      }}
    />
    {icon && <div className={'codicon ' + (icon(item) || 'codicon-blank')} style={{ minWidth: 16, marginRight: 4 }}></div>}
    {typeof rendered === 'string' ? <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{rendered}</div> : rendered}
  </div>;
}

type TreeItemData = {
  depth: number,
  expanded: boolean | undefined,
  parent: TreeItem | null,
};

function flattenTree<T extends TreeItem>(
  rootItem: T,
  selectedItem: T | undefined,
  expandedItems: Map<string, boolean | undefined>,
  autoExpandDepth: number): Map<T, TreeItemData> {

  const result = new Map<T, TreeItemData>();
  const temporaryExpanded = new Set<string>();
  for (let item: TreeItem | undefined = selectedItem?.parent; item; item = item.parent)
    temporaryExpanded.add(item.id);

  const appendChildren = (parent: T, depth: number) => {
    for (const item of parent.children as T[]) {
      const expandState = temporaryExpanded.has(item.id) || expandedItems.get(item.id);
      const autoExpandMatches = autoExpandDepth > depth && result.size < 25 && expandState !== false;
      const expanded = item.children.length ? expandState ?? autoExpandMatches : undefined;
      result.set(item, { depth, expanded, parent: rootItem === parent ? null : parent });
      if (expanded)
        appendChildren(item, depth + 1);
    }
  };
  appendChildren(rootItem, 0);
  return result;
}
