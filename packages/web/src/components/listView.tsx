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
  itemRender: (item: any) => React.ReactNode,
  itemKey?: (item: any) => string,
  itemIcon?: (item: any) => string | undefined,
  itemIndent?: (item: any) => number | undefined,
  itemType?: (item: any) => 'error' | undefined,
  selectedItem?: any,
  onAccepted?: (item: any) => void,
  onSelected?: (item: any) => void,
  onHighlighted?: (item: any | undefined) => void,
  showNoItemsMessage?: boolean,
  dataTestId?: string,
};

export const ListView: React.FC<ListViewProps> = ({
  items = [],
  itemKey,
  itemRender,
  itemIcon,
  itemType,
  itemIndent,
  selectedItem,
  onAccepted,
  onSelected,
  onHighlighted,
  showNoItemsMessage,
  dataTestId,
}) => {
  const itemListRef = React.createRef<HTMLDivElement>();
  const [highlightedItem, setHighlightedItem] = React.useState<any>();

  return <div className='list-view vbox' data-testid={dataTestId}>
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
        onHighlighted?.(undefined);
        onSelected?.(items[newIndex]);
      }}
      ref={itemListRef}
    >
      {showNoItemsMessage && items.length === 0 && <div className='list-view-empty'>No items</div>}
      {items.map((item, index) => <ListItemView
        key={itemKey ? itemKey(item) : String(index)}
        hasIcons={!!itemIcon}
        icon={itemIcon?.(item)}
        type={itemType?.(item)}
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
  hasIcons: boolean,
  icon: string | undefined,
  type: 'error' | undefined,
  indent: number | undefined,
  isHighlighted: boolean,
  isSelected: boolean,
  onSelected: () => void,
  onMouseEnter: () => void,
  onMouseLeave: () => void,
  children: React.ReactNode | React.ReactNode[],
}> = ({ key, hasIcons, icon, type, indent, onSelected, onMouseEnter, onMouseLeave, isHighlighted, isSelected, children }) => {
  const selectedSuffix = isSelected ? ' selected' : '';
  const highlightedSuffix = isHighlighted ? ' highlighted' : '';
  const errorSuffix = type === 'error' ? ' error' : '';
  const divRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (divRef.current && isSelected)
      scrollIntoViewIfNeeded(divRef.current);
  }, [isSelected]);

  return <div
    key={key}
    className={'list-view-entry' + selectedSuffix + highlightedSuffix + errorSuffix}
    onClick={onSelected}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    ref={divRef}
  >
    {indent ? <div style={{ minWidth: indent * 16 }}></div> : undefined}
    {hasIcons && <div className={'codicon ' + (icon || 'blank')} style={{ minWidth: 16, marginRight: 4 }}></div>}
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
