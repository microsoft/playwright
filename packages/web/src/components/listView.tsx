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

export type ListViewProps<T> = {
  items: T[],
  id?: (item: T, index: number) => string,
  render: (item: T, index: number) => React.ReactNode,
  icon?: (item: T, index: number) => string | undefined,
  indent?: (item: T, index: number) => number | undefined,
  isError?: (item: T, index: number) => boolean,
  isWarning?: (item: T, index: number) => boolean,
  selectedItem?: T,
  onAccepted?: (item: T, index: number) => void,
  onSelected?: (item: T, index: number) => void,
  onLeftArrow?: (item: T, index: number) => void,
  onRightArrow?: (item: T, index: number) => void,
  onHighlighted?: (item: T | undefined) => void,
  onIconClicked?: (item: T, index: number) => void,
  noItemsMessage?: string,
  dataTestId?: string,
};

export function ListView<T>({
  items = [],
  id,
  render,
  icon,
  isError,
  isWarning,
  indent,
  selectedItem,
  onAccepted,
  onSelected,
  onLeftArrow,
  onRightArrow,
  onHighlighted,
  onIconClicked,
  noItemsMessage,
  dataTestId,
}: ListViewProps<T>) {
  const itemListRef = React.useRef<HTMLDivElement>(null);
  const [highlightedItem, setHighlightedItem] = React.useState<any>();

  React.useEffect(() => {
    onHighlighted?.(highlightedItem);
  }, [onHighlighted, highlightedItem]);

  return <div className='list-view vbox' role='list' data-testid={dataTestId}>
    <div
      className='list-view-content'
      tabIndex={0}
      onDoubleClick={() => selectedItem && onAccepted?.(selectedItem, items.indexOf(selectedItem))}
      onKeyDown={event => {
        if (selectedItem && event.key === 'Enter') {
          onAccepted?.(selectedItem, items.indexOf(selectedItem));
          return;
        }
        if (event.key !== 'ArrowDown' &&  event.key !== 'ArrowUp' && event.key !== 'ArrowLeft' &&  event.key !== 'ArrowRight')
          return;

        event.stopPropagation();
        event.preventDefault();

        if (selectedItem && event.key === 'ArrowLeft') {
          onLeftArrow?.(selectedItem, items.indexOf(selectedItem));
          return;
        }
        if (selectedItem && event.key === 'ArrowRight') {
          onRightArrow?.(selectedItem, items.indexOf(selectedItem));
          return;
        }

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
      }}
      ref={itemListRef}
    >
      {noItemsMessage && items.length === 0 && <div className='list-view-empty'>{noItemsMessage}</div>}
      {items.map((item, index) => {
        const selectedSuffix = selectedItem === item ? ' selected' : '';
        const highlightedSuffix = highlightedItem === item ? ' highlighted' : '';
        const errorSuffix = isError?.(item, index) ? ' error' : '';
        const warningSuffix = isWarning?.(item, index) ? ' warning' : '';
        const indentation = indent?.(item, index) || 0;
        const rendered = render(item, index);
        return <div
          key={id?.(item, index) || index}
          role='listitem'
          className={'list-view-entry' + selectedSuffix + highlightedSuffix + errorSuffix + warningSuffix}
          onClick={() => onSelected?.(item, index)}
          onMouseEnter={() => setHighlightedItem(item)}
          onMouseLeave={() => setHighlightedItem(undefined)}
        >
          {indentation ? new Array(indentation).fill(0).map(() => <div className='list-view-indent'></div>) : undefined}
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

function scrollIntoViewIfNeeded(element: Element | undefined) {
  if (!element)
    return;
  if ((element as any)?.scrollIntoViewIfNeeded)
    (element as any).scrollIntoViewIfNeeded(false);
  else
    element?.scrollIntoView();
}
