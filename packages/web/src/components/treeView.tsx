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
import { clsx, scrollIntoViewIfNeeded } from '../uiUtils';
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
  title?: (item: T) => string,
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
  title,
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
    return indexTree<T>(rootItem, selectedItem, treeState.expandedItems, autoExpandDepth || 0, isVisible);
  }, [rootItem, selectedItem, treeState, autoExpandDepth, isVisible]);

  const itemListRef = React.useRef<HTMLDivElement>(null);
  const [highlightedItem, setHighlightedItem] = React.useState<any>();
  const [isKeyboardNavigation, setIsKeyboardNavigation] = React.useState(false);

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

        let newSelectedItem: T | undefined = selectedItem;
        if (event.key === 'ArrowDown') {
          if (selectedItem) {
            const itemData = treeItems.get(selectedItem)!;
            newSelectedItem = itemData.next as T;
          } else if (treeItems.size) {
            const itemList = [...treeItems.keys()];
            newSelectedItem = itemList[0];
          }
        }
        if (event.key === 'ArrowUp') {
          if (selectedItem) {
            const itemData = treeItems.get(selectedItem)!;
            newSelectedItem = itemData.prev as T;
          } else if (treeItems.size) {
            const itemList = [...treeItems.keys()];
            newSelectedItem = itemList[itemList.length - 1];
          }
        }

        // scrollIntoViewIfNeeded(element || undefined);
        onHighlighted?.(undefined);
        if (newSelectedItem) {
          setIsKeyboardNavigation(true);
          onSelected?.(newSelectedItem);
        }
        setHighlightedItem(undefined);
      }}
      ref={itemListRef}
    >
      {noItemsMessage && treeItems.size === 0 && <div className='tree-view-empty'>{noItemsMessage}</div>}
      {rootItem.children.map(child => {
        const itemData = treeItems.get(child as T);
        return itemData && <TreeItemHeader
          key={child.id}
          item={child as T}
          treeItems={treeItems}
          selectedItem={selectedItem}
          onSelected={onSelected}
          onAccepted={onAccepted}
          isError={isError}
          toggleExpanded={toggleExpanded}
          highlightedItem={highlightedItem}
          setHighlightedItem={setHighlightedItem}
          render={render}
          icon={icon}
          title={title}
          isKeyboardNavigation={isKeyboardNavigation}
          setIsKeyboardNavigation={setIsKeyboardNavigation} />;
      })}
    </div>
  </div>;
}

type TreeItemHeaderProps<T> = {
  item: T,
  treeItems: Map<T, TreeItemData>,
  selectedItem: T | undefined,
  onSelected?: (item: T) => void,
  toggleExpanded: (item: T) => void,
  highlightedItem: T | undefined,
  isError?: (item: T) => boolean,
  onAccepted?: (item: T) => void,
  setHighlightedItem: (item: T | undefined) => void,
  render: (item: T) => React.ReactNode,
  title?: (item: T) => string,
  icon?: (item: T) => string | undefined,
  isKeyboardNavigation: boolean,
  setIsKeyboardNavigation: (value: boolean) => void,
};

export function TreeItemHeader<T extends TreeItem>({
  item,
  treeItems,
  selectedItem,
  onSelected,
  highlightedItem,
  setHighlightedItem,
  isError,
  onAccepted,
  toggleExpanded,
  render,
  title,
  icon,
  isKeyboardNavigation,
  setIsKeyboardNavigation }: TreeItemHeaderProps<T>) {
  const groupId = React.useId();
  const itemRef = React.useRef(null);

  React.useEffect(() => {
    if (selectedItem === item && isKeyboardNavigation && itemRef.current) {
      scrollIntoViewIfNeeded(itemRef.current);
      setIsKeyboardNavigation(false);
    }
  }, [item, selectedItem, isKeyboardNavigation, setIsKeyboardNavigation]);

  const itemData = treeItems.get(item)!;
  const indentation = itemData.depth;
  const expanded = itemData.expanded;
  let expandIcon = 'codicon-blank';
  if (typeof expanded === 'boolean')
    expandIcon = expanded ? 'codicon-chevron-down' : 'codicon-chevron-right';
  const rendered = render(item);
  const children = expanded && item.children.length ? item.children as T[] : [];
  const titled = title?.(item);
  const iconed = icon?.(item) || 'codicon-blank';

  return <div ref={itemRef} role='treeitem' aria-selected={item === selectedItem} aria-expanded={expanded} aria-controls={groupId} title={titled} className='vbox' style={{ flex: 'none' }}>
    <div
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
        aria-hidden='true'
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
      {icon && <div className={'codicon ' + iconed} style={{ minWidth: 16, marginRight: 4 }} aria-label={'[' + iconed.replace('codicon', 'icon') + ']'}></div>}
      {typeof rendered === 'string' ? <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{rendered}</div> : rendered}
    </div>
    {!!children.length && <div id={groupId} role='group'>
      {children.map(child => {
        const itemData = treeItems.get(child);
        return itemData && <TreeItemHeader
          key={child.id}
          item={child}
          treeItems={treeItems}
          selectedItem={selectedItem}
          onSelected={onSelected}
          onAccepted={onAccepted}
          isError={isError}
          toggleExpanded={toggleExpanded}
          highlightedItem={highlightedItem}
          setHighlightedItem={setHighlightedItem}
          render={render}
          title={title}
          icon={icon}
          isKeyboardNavigation={isKeyboardNavigation}
          setIsKeyboardNavigation={setIsKeyboardNavigation} />;
      })}
    </div>}
  </div>;
}

type TreeItemData = {
  depth: number;
  expanded: boolean | undefined;
  parent: TreeItem | null;
  next: TreeItem | null;
  prev: TreeItem | null;
};

function indexTree<T extends TreeItem>(
  rootItem: T,
  selectedItem: T | undefined,
  expandedItems: Map<string, boolean | undefined>,
  autoExpandDepth: number,
  isVisible: (item: T) => boolean = () => true): Map<T, TreeItemData> {
  if (!isVisible(rootItem))
    return new Map();

  const result = new Map<T, TreeItemData>();
  const temporaryExpanded = new Set<string>();
  for (let item: TreeItem | undefined = selectedItem?.parent; item; item = item.parent)
    temporaryExpanded.add(item.id);
  let lastItem: T | null = null;

  const appendChildren = (parent: T, depth: number) => {
    for (const item of parent.children as T[]) {
      if (!isVisible(item))
        continue;
      const expandState = temporaryExpanded.has(item.id) || expandedItems.get(item.id);
      const autoExpandMatches = autoExpandDepth > depth && result.size < 25 && expandState !== false;
      const expanded = item.children.length ? expandState ?? autoExpandMatches : undefined;
      const itemData: TreeItemData = {
        depth,
        expanded,
        parent: rootItem === parent ? null : parent,
        next: null,
        prev: lastItem,
      };
      if (lastItem)
        result.get(lastItem)!.next = item;
      lastItem = item;
      result.set(item, itemData);
      if (expanded)
        appendChildren(item, depth + 1);
    }
  };
  appendChildren(rootItem, 0);
  return result;
}
