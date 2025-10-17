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

import './networkFilters.css';

const resourceTypes = ['Fetch', 'HTML', 'JS', 'CSS', 'Font', 'Image'] as const;
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
  return (
    <div className='network-filters'>
      <input
        type='search'
        placeholder='Filter network'
        spellCheck={false}
        value={filterState.searchValue}
        onChange={e => onFilterStateChange({ ...filterState, searchValue: e.target.value })}
      />

      <div className='network-filters-resource-types'>
        <div
          title='All'
          onClick={() => onFilterStateChange({ ...filterState, resourceTypes: new Set() })}
          className={`network-filters-resource-type ${filterState.resourceTypes.size === 0 ? 'selected' : ''}`}
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
          >
            {resourceType}
          </div>
        ))}
      </div>
    </div>
  );
};
