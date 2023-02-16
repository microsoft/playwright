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
  itemKey: (item: any) => string,
  itemRender: (item: any) => React.ReactNode,
  itemIcon?: (item: any) => string | undefined,
  itemIndent?: (item: any) => number | undefined,
  selectedItem?: any,
  onAccepted?: (item: any) => void,
  onSelected?: (item: any) => void,
  onHighlighted?: (item: any | undefined) => void,
  showNoItemsMessage?: boolean,
};

export const ListView: React.FC<ListViewProps> = ({
  items = [],
  itemKey,
  itemRender,
  itemIcon,
  itemIndent,
  selectedItem,
  onAccepted,
  onSelected,
  onHighlighted,
  showNoItemsMessage,
}) => {
  const itemListRef = React.createRef<HTMLDivElement>();
  const [highlightedItem, setHighlightedItem] = React.useState<any>();

  return <div className='list-view vbox'>
    <div
      className='list-view-content'
      tabIndex={0}
      onDoubleClick={() => onAccepted?.(selectedItem)}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          onAccepted?.(selectedItem);
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
        scrollIntoViewIfNeeded(element);
        onSelected?.(items[newIndex]);
      }}
      ref={itemListRef}
    >
      {showNoItemsMessage && items.length === 0 && <div className='list-view-empty'>No items</div>}
      {items.map(item => <ListItemView
        key={itemKey(item)}
        icon={itemIcon?.(item)}
        indent={itemIndent?.(item)}
        isHighlighted={item === highlightedItem}
        isSelected={item === selectedItem}
        onSelected={() => onSelected?.(item)}
        onMouseEnter={() => {
          setHighlightedItem(item);
          onHighlighted?.(item);
        }}
        onMouseLeave={() => {
          setHighlightedItem(undefined);
          onHighlighted?.(undefined);
        }}
      >
        {itemRender(item)}
      </ListItemView>)}
    </div>
  </div>;
};

const ListItemView: React.FC<{
  key: string,
  icon: string | undefined,
  indent: number | undefined,
  isHighlighted: boolean,
  isSelected: boolean,
  onSelected: () => void,
  onMouseEnter: () => void,
  onMouseLeave: () => void,
  children: React.ReactNode | React.ReactNode[],
}> = ({ key, icon, indent, onSelected, onMouseEnter, onMouseLeave, isHighlighted, isSelected, children }) => {
  const selectedSuffix = isSelected ? ' selected' : '';
  const highlightedSuffix = isHighlighted ? ' highlighted' : '';
  const divRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (divRef.current && isSelected)
      scrollIntoViewIfNeeded(divRef.current);
  }, [isSelected]);

  return <div
    key={key}
    className={'list-view-entry' + selectedSuffix + highlightedSuffix}
    onClick={onSelected}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    ref={divRef}
  >
    {indent ? <div style={{ minWidth: indent * 16 }}></div> : undefined}
    <div className={'codicon ' + icon} style={{ minWidth: 16, marginRight: 4 }}></div>
    {typeof children === 'string' ? <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{children}</div> : children}
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
