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
import './listView.css';
import { clsx, scrollIntoViewIfNeeded } from '../uiUtils';

export type ListViewProps<T> = {
  name: string,
  items: T[],
  id?: (item: T, index: number) => string,
  render: (item: T, index: number) => React.ReactNode,
  icon?: (item: T, index: number) => string | undefined,
  isError?: (item: T, index: number) => boolean,
  isWarning?: (item: T, index: number) => boolean,
  isInfo?: (item: T, index: number) => boolean,
  ariaLabel?: string,
  selectedItem?: T,
  onAccepted?: (item: T, index: number) => void,
  onSelected?: (item: T, index: number) => void,
  onHighlighted?: (item: T | undefined) => void,
  onIconClicked?: (item: T, index: number) => void,
  noItemsMessage?: string,
  dataTestId?: string,
  notSelectable?: boolean,
};

const scrollPositions = new Map<string, number>();

export function ListView<T>({
  name,
  items = [],
  id,
  render,
  icon,
  isError,
  isWarning,
  isInfo,
  selectedItem,
  onAccepted,
  onSelected,
  onHighlighted,
  onIconClicked,
  noItemsMessage,
  dataTestId,
  notSelectable,
  ariaLabel,
}: ListViewProps<T>) {
  const itemListRef = React.useRef<HTMLDivElement>(null);
  const [highlightedItem, setHighlightedItem] = React.useState<any>();

  React.useEffect(() => {
    onHighlighted?.(highlightedItem);
  }, [onHighlighted, highlightedItem]);

  React.useEffect(() => {
    const listElem = itemListRef.current;
    if (!listElem)
      return;
    const saveScrollPosition = () => {
      scrollPositions.set(name, listElem.scrollTop);
    };
    listElem.addEventListener('scroll', saveScrollPosition, { passive: true });
    return () => listElem.removeEventListener('scroll', saveScrollPosition);
  }, [name]);

  React.useEffect(() => {
    if (itemListRef.current)
      itemListRef.current.scrollTop = scrollPositions.get(name) || 0;
  }, [name]);

  return <div className={clsx(`list-view vbox`, name + '-list-view')} role={items.length > 0 ? 'list' : undefined} aria-label={ariaLabel}>
    <div
      className={clsx('list-view-content', notSelectable && 'not-selectable')}
      tabIndex={0}
      onKeyDown={event => {
        if (selectedItem && event.key === 'Enter') {
          onAccepted?.(selectedItem, items.indexOf(selectedItem));
          return;
        }
        if (event.key !== 'ArrowDown' &&  event.key !== 'ArrowUp')
          return;

        event.stopPropagation();
        event.preventDefault();

        const index = selectedItem ? items.indexOf(selectedItem) : -1;
        let newIndex = index;
        if (event.key === 'ArrowDown') {
          if (index === -1)
            newIndex = 0;
          else
            newIndex = Math.min(index + 1, items.length - 1);
        }
        if (event.key === 'ArrowUp') {
          if (index === -1)
            newIndex = items.length - 1;
          else
            newIndex = Math.max(index - 1, 0);
        }

        const element = itemListRef.current?.children.item(newIndex);
        scrollIntoViewIfNeeded(element || undefined);
        onHighlighted?.(undefined);
        onSelected?.(items[newIndex], newIndex);
        setHighlightedItem(undefined);
      }}
      ref={itemListRef}
    >
      {noItemsMessage && items.length === 0 && <div className='list-view-empty'>{noItemsMessage}</div>}
      {items.map((item, index) => {
        const rendered = render(item, index);
        return <div
          key={id?.(item, index) || index}
          onDoubleClick={() => onAccepted?.(item, index)}
          role='listitem'
          className={clsx(
              'list-view-entry',
              selectedItem === item && 'selected',
              !notSelectable && highlightedItem === item && 'highlighted',
              isError?.(item, index) && 'error',
              isWarning?.(item, index) && 'warning',
              isInfo?.(item, index) && 'info')}
          aria-selected={selectedItem === item}
          onClick={() => onSelected?.(item, index)}
          onMouseEnter={() => setHighlightedItem(item)}
          onMouseLeave={() => setHighlightedItem(undefined)}
        >
          {icon && <div
            className={'codicon ' + (icon(item, index) || 'codicon-blank')}
            style={{ minWidth: 16, marginRight: 4 }}
            onDoubleClick={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              onIconClicked?.(item, index);
            }}
          ></div>}
          {typeof rendered === 'string' ? <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{rendered}</div> : rendered}
        </div>;
      })}
    </div>
  </div>;
}
