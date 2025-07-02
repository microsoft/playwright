/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Entry } from '@trace/har';
import * as React from 'react';
import type { Boundaries } from './geometry';
import './networkTab.css';
import { NetworkResourceDetails } from './networkResourceDetails';
import { bytesToString, msToString } from '@web/uiUtils';
import { PlaceholderPanel } from './placeholderPanel';
import { context, type MultiTraceModel } from './modelUtil';
import { GridView, type RenderedGridCell } from '@web/components/gridView';
import { SplitView } from '@web/components/splitView';
import type { ContextEntry } from '../types/entries';
import { NetworkFilters, defaultFilterState, type FilterState, type ResourceType } from './networkFilters';
import type { Language } from '@isomorphic/locatorGenerators';

type NetworkTabModel = {
  resources: Entry[],
  contextIdMap: ContextIdMap,
};

type RenderedEntry = {
  name: { name: string, url: string },
  method: string,
  status: { code: number, text: string },
  contentType: string,
  duration: number,
  size: number,
  start: number,
  route: string,
  resource: Entry,
  contextId: string,
};
type ColumnName = keyof RenderedEntry;
type Sorting = { by: ColumnName, negate: boolean};
const NetworkGridView = GridView<RenderedEntry>;

export function useNetworkTabModel(model: MultiTraceModel | undefined, selectedTime: Boundaries | undefined): NetworkTabModel {
  const resources = React.useMemo(() => {
    const resources = model?.resources || [];
    const filtered = resources.filter(resource => {
      if (!selectedTime)
        return true;
      return !!resource._monotonicTime && (resource._monotonicTime >= selectedTime.minimum && resource._monotonicTime <= selectedTime.maximum);
    });
    return filtered;
  }, [model, selectedTime]);
  const contextIdMap = React.useMemo(() => new ContextIdMap(model), [model]);
  return { resources, contextIdMap };
}

export const NetworkTab: React.FunctionComponent<{
  boundaries: Boundaries,
  networkModel: NetworkTabModel,
  onEntryHovered?: (entry: Entry | undefined) => void,
  sdkLanguage: Language,
}> = ({ boundaries, networkModel, onEntryHovered, sdkLanguage }) => {
  const [sorting, setSorting] = React.useState<Sorting | undefined>(undefined);
  const [selectedEntry, setSelectedEntry] = React.useState<RenderedEntry | undefined>(undefined);
  const [filterState, setFilterState] = React.useState(defaultFilterState);

  const { renderedEntries } = React.useMemo(() => {
    const renderedEntries = networkModel.resources.map(entry => renderEntry(entry, boundaries, networkModel.contextIdMap)).filter(filterEntry(filterState));
    if (sorting)
      sort(renderedEntries, sorting);
    return { renderedEntries };
  }, [networkModel.resources, networkModel.contextIdMap, filterState, sorting, boundaries]);

  const [columnWidths, setColumnWidths] = React.useState<Map<ColumnName, number>>(() => {
    return new Map(allColumns().map(column => [column, columnWidth(column)]));
  });

  const onFilterStateChange = React.useCallback((newFilterState: FilterState) => {
    setFilterState(newFilterState);
    setSelectedEntry(undefined);
  }, []);

  if (!networkModel.resources.length)
    return <PlaceholderPanel text='No network calls' />;

  const grid = <NetworkGridView
    name='network'
    ariaLabel='Network requests'
    items={renderedEntries}
    selectedItem={selectedEntry}
    onSelected={item => setSelectedEntry(item)}
    onHighlighted={item => onEntryHovered?.(item?.resource)}
    columns={visibleColumns(!!selectedEntry, renderedEntries)}
    columnTitle={columnTitle}
    columnWidths={columnWidths}
    setColumnWidths={setColumnWidths}
    isError={item => item.status.code >= 400 || item.status.code === -1}
    isInfo={item => !!item.route}
    render={(item, column) => renderCell(item, column)}
    sorting={sorting}
    setSorting={setSorting}
  />;
  return <>
    <NetworkFilters filterState={filterState} onFilterStateChange={onFilterStateChange} />
    {!selectedEntry && grid}
    {selectedEntry &&
      <SplitView
        sidebarSize={columnWidths.get('name')!}
        sidebarIsFirst={true}
        orientation='horizontal'
        settingName='networkResourceDetails'
        main={<NetworkResourceDetails resource={selectedEntry.resource} sdkLanguage={sdkLanguage} startTimeOffset={selectedEntry.start} onClose={() => setSelectedEntry(undefined)} />}
        sidebar={grid}
      />}
  </>;
};

const columnTitle = (column: ColumnName) => {
  if (column === 'contextId')
    return 'Source';
  if (column === 'name')
    return 'Name';
  if (column === 'method')
    return 'Method';
  if (column === 'status')
    return 'Status';
  if (column === 'contentType')
    return 'Content Type';
  if (column === 'duration')
    return 'Duration';
  if (column === 'size')
    return 'Size';
  if (column === 'start')
    return 'Start';
  if (column === 'route')
    return 'Route';
  return '';
};

const columnWidth = (column: ColumnName) => {
  if (column === 'name')
    return 200;
  if (column === 'method')
    return 60;
  if (column === 'status')
    return 60;
  if (column === 'contentType')
    return 200;
  if (column === 'contextId')
    return 60;
  return 100;
};

function visibleColumns(entrySelected: boolean, renderedEntries: RenderedEntry[]): (keyof RenderedEntry)[] {
  if (entrySelected) {
    const columns: (keyof RenderedEntry)[] = ['name'];
    if (hasMultipleContexts(renderedEntries))
      columns.unshift('contextId');
    return columns;
  }
  let columns: (keyof RenderedEntry)[] = allColumns();
  if (!hasMultipleContexts(renderedEntries))
    columns = columns.filter(name => name !== 'contextId');
  return columns;
}

function allColumns(): (keyof RenderedEntry)[] {
  return ['contextId', 'name', 'method', 'status', 'contentType', 'duration', 'size', 'start', 'route'];
}

const renderCell = (entry: RenderedEntry, column: ColumnName): RenderedGridCell => {
  if (column === 'contextId') {
    return {
      body: entry.contextId,
      title: entry.name.url,
    };
  }
  if (column === 'name') {
    return {
      body: entry.name.name,
      title: entry.name.url,
    };
  }
  if (column === 'method')
    return { body: entry.method };
  if (column === 'status') {
    return {
      body: entry.status.code > 0 ? entry.status.code : '',
      title: entry.status.text
    };
  }
  if (column === 'contentType')
    return { body: entry.contentType };
  if (column === 'duration')
    return { body: msToString(entry.duration) };
  if (column === 'size')
    return { body: bytesToString(entry.size) };
  if (column === 'start')
    return { body: msToString(entry.start) };
  if (column === 'route')
    return { body: entry.route };
  return { body: '' };
};

class ContextIdMap {
  private _pagerefToShortId = new Map<string, string>();
  private _contextToId = new Map<ContextEntry, string>();
  private _lastPageId = 0;
  private _lastApiRequestContextId = 0;

  constructor(model: MultiTraceModel | undefined) {}

  contextId(resource: Entry): string {
    if (resource.pageref)
      return this._pageId(resource.pageref);
    else if (resource._apiRequest)
      return this._apiRequestContextId(resource);
    return '';
  }

  private _pageId(pageref: string): string {
    let shortId = this._pagerefToShortId.get(pageref);
    if (!shortId) {
      ++this._lastPageId;
      shortId = 'page#' + this._lastPageId;
      this._pagerefToShortId.set(pageref, shortId);
    }
    return shortId;
  }

  private _apiRequestContextId(resource: Entry): string {
    const contextEntry = context(resource);
    if (!contextEntry)
      return '';
    let contextId = this._contextToId.get(contextEntry);
    if (!contextId) {
      ++this._lastApiRequestContextId;
      contextId = 'api#' + this._lastApiRequestContextId;
      this._contextToId.set(contextEntry, contextId);
    }
    return contextId;
  }
}

function hasMultipleContexts(renderedEntries: RenderedEntry[]): boolean {
  const contextIds = new Set<string>();
  for (const entry of renderedEntries) {
    contextIds.add(entry.contextId);
    if (contextIds.size > 1)
      return true;
  }
  return false;
}

const renderEntry = (resource: Entry, boundaries: Boundaries, contextIdGenerator: ContextIdMap): RenderedEntry => {
  const routeStatus = formatRouteStatus(resource);
  let resourceName: string;
  try {
    const url = new URL(resource.request.url);
    resourceName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
    if (!resourceName)
      resourceName = url.host;
    if (url.search)
      resourceName += url.search;
  } catch {
    resourceName = resource.request.url;
  }
  let contentType = resource.response.content.mimeType;
  const charset = contentType.match(/^(.*);\s*charset=.*$/);
  if (charset)
    contentType = charset[1];

  return {
    name: { name: resourceName, url: resource.request.url },
    method: resource.request.method,
    status: { code: resource.response.status, text: resource.response.statusText },
    contentType: contentType,
    duration: resource.time,
    size: resource.response._transferSize! > 0 ? resource.response._transferSize! : resource.response.bodySize,
    start: resource._monotonicTime! - boundaries.minimum,
    route: routeStatus,
    resource,
    contextId: contextIdGenerator.contextId(resource),
  };
};

function formatRouteStatus(request: Entry): string {
  if (request._wasAborted)
    return 'aborted';
  if (request._wasContinued)
    return 'continued';
  if (request._wasFulfilled)
    return 'fulfilled';
  if (request._apiRequest)
    return 'api';
  return '';
}

function sort(resources: RenderedEntry[], sorting: Sorting) {
  const c = comparator(sorting?.by);
  if (c)
    resources.sort(c);
  if (sorting.negate)
    resources.reverse();
}

function comparator(sortBy: ColumnName) {
  if (sortBy === 'start')
    return (a: RenderedEntry, b: RenderedEntry) => a.start - b.start;

  if (sortBy === 'duration')
    return (a: RenderedEntry, b: RenderedEntry) => a.duration - b.duration;

  if (sortBy === 'status')
    return (a: RenderedEntry, b: RenderedEntry) => a.status.code - b.status.code;

  if (sortBy === 'method') {
    return (a: RenderedEntry, b: RenderedEntry) => {
      const valueA = a.method;
      const valueB = b.method;
      return valueA.localeCompare(valueB);
    };
  }

  if (sortBy === 'size') {
    return (a: RenderedEntry, b: RenderedEntry) => {
      return a.size - b.size;
    };
  }

  if (sortBy === 'contentType') {
    return (a: RenderedEntry, b: RenderedEntry) => {
      return a.contentType.localeCompare(b.contentType);
    };
  }

  if (sortBy === 'name') {
    return (a: RenderedEntry, b: RenderedEntry) => {
      return a.name.name.localeCompare(b.name.name);
    };
  }

  if (sortBy === 'route') {
    return (a: RenderedEntry, b: RenderedEntry) => {
      return a.route.localeCompare(b.route);
    };
  }

  if (sortBy === 'contextId')
    return (a: RenderedEntry, b: RenderedEntry) => a.contextId.localeCompare(b.contextId);
}

const resourceTypePredicates: Record<ResourceType, (contentType: string) => boolean> = {
  'All': () => true,
  'Fetch': contentType => contentType === 'application/json',
  'HTML': contentType => contentType === 'text/html',
  'CSS': contentType => contentType === 'text/css',
  'JS': contentType => contentType.includes('javascript'),
  'Font': contentType => contentType.includes('font'),
  'Image': contentType => contentType.includes('image'),
};

function filterEntry({ searchValue, resourceType }: FilterState) {
  return (entry: RenderedEntry) => {
    const typePredicate = resourceTypePredicates[resourceType];

    return typePredicate(entry.contentType) && entry.name.url.toLowerCase().includes(searchValue.toLowerCase());
  };
}
