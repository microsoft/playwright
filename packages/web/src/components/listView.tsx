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

export type ListViewProps = {
  items: any[],
  selectedItem: any | undefined,
  highlightedItem: any | undefined,
  onSelected: (item: any) => void,
  onHighlighted: (item: any | undefined) => void,
  itemKey: (item: any) => string,
  renderItem: (item: any) => React.ReactNode,
};

export const ListView: React.FC<ListViewProps> = ({
  items = [],
  selectedItem,
  highlightedItem,
  onSelected,
  onHighlighted,
  itemKey,
  renderItem,
}) => {
  const itemListRef = React.createRef<HTMLDivElement>();

  React.useEffect(() => {
    itemListRef.current?.focus();
  }, [selectedItem, itemListRef]);

  return <div className='list-view vbox'>
    <div
      className='list-view-content'
      tabIndex={0}
      onKeyDown={event => {
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
        scrollIntoViewIfNeeded(element);
        onSelected(items[newIndex]);
      }}
      ref={itemListRef}
    >
      {items.length === 0 && <div className='list-view-empty'>No items</div>}
      {items.map(item => <ListItemView
        key={itemKey(item)}
        render={() => renderItem(item)}
        isHighlighted={item === highlightedItem}
        isSelected={item === selectedItem}
        onSelected={() => onSelected(item)}
        onMouseEnter={() => onHighlighted(item)}
        onMouseLeave={() => onHighlighted(undefined)}
      />)}
    </div>
  </div>;
};

const ListItemView: React.FC<{
  key: string,
  render: () => React.ReactNode,
  isHighlighted: boolean,
  isSelected: boolean,
  onSelected: () => void,
  onMouseEnter: () => void,
  onMouseLeave: () => void,
}> = ({ key, render, onSelected, onMouseEnter, onMouseLeave, isHighlighted, isSelected }) => {
  const selectedSuffix = isSelected ? ' selected' : '';
  const highlightedSuffix = isHighlighted ? ' highlighted' : '';
  const divRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (divRef.current && isSelected)
      scrollIntoViewIfNeeded(divRef.current);
  }, [isSelected]);

  return <div
    className={'list-view-entry' + selectedSuffix + highlightedSuffix}
    key={key}
    onClick={onSelected}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    ref={divRef}
  >
    {render()}
  </div>;
};

function scrollIntoViewIfNeeded(element?: Element | null) {
  if (!element)
    return;
  if ((element as any)?.scrollIntoViewIfNeeded)
    (element as any).scrollIntoViewIfNeeded(false);
  else
    element?.scrollIntoView();
}
