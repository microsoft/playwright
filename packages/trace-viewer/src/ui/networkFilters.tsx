/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import { handleTabListKeyDown } from '@web/uiUtils';
import './networkFilters.css';

const resourceTypes = ['Fetch', 'HTML', 'JS', 'CSS', 'Font', 'Image', 'WS'] as const;
export type ResourceType = typeof resourceTypes[number];

export type FilterState = {
  searchValue: string;
  resourceTypes: Set<ResourceType>;
};

export const defaultFilterState: FilterState = { searchValue: '', resourceTypes: new Set() };

export const NetworkFilters = ({ filterState, onFilterStateChange }: {
  filterState: FilterState,
  onFilterStateChange: (filterState: FilterState) => void,
}) => {
  const tabListRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    handleTabListKeyDown(e, tabListRef.current);
  };

  const isAllSelected = filterState.resourceTypes.size === 0;

  return (
    <div className='network-filters'>
      <input
        type='search'
        placeholder='Filter network'
        spellCheck={false}
        value={filterState.searchValue}
        onChange={e => onFilterStateChange({ ...filterState, searchValue: e.target.value })}
      />

      <div className='network-filters-resource-types' role='tablist' aria-multiselectable='true' onKeyDown={handleKeyDown} ref={tabListRef}>
        <div
          title='All'
          onClick={() => onFilterStateChange({ ...filterState, resourceTypes: new Set() })}
          className={`network-filters-resource-type ${isAllSelected ? 'selected' : ''}`}
          role='tab'
          tabIndex={isAllSelected ? 0 : -1}
          aria-selected={isAllSelected}
        >
          All
        </div>

        {resourceTypes.map(resourceType => (
          <div
            key={resourceType}
            title={resourceType}
            onClick={event => {
              let newType;
              if (event.ctrlKey || event.metaKey)
                newType = filterState.resourceTypes.symmetricDifference(new Set([resourceType]));
              else
                newType = new Set([resourceType]);

              onFilterStateChange({ ...filterState, resourceTypes: newType });
            }}
            className={`network-filters-resource-type ${filterState.resourceTypes.has(resourceType) ? 'selected' : ''}`}
            role='tab'
            tabIndex={filterState.resourceTypes.has(resourceType) ? 0 : -1}
            aria-selected={filterState.resourceTypes.has(resourceType)}
          >
            {resourceType}
          </div>
        ))}
      </div>
    </div>
  );
};
