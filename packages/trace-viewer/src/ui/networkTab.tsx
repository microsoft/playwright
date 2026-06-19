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

import * as React from 'react';
import type { Boundaries } from './geometry';
import './networkTab.css';
import { NetworkResourceDetails, WebSocketResourceDetails } from './networkResourceDetails';
import { bytesToString, msToString } from '@isomorphic/formatUtils';
import { PlaceholderPanel } from './placeholderPanel';
import { context } from '@isomorphic/trace/traceModel';
import type { ResourceEntry, TraceModel } from '@isomorphic/trace/traceModel';
import { GridView, type RenderedGridCell } from '@web/components/gridView';
import { SplitView } from '@web/components/splitView';
import { NetworkFilters, defaultFilterState, type FilterState, type ResourceType } from './networkFilters';
import type { Language } from '@isomorphic/locatorGenerators';

type NetworkTabModel = {
  resources: ResourceEntry[],
  model: TraceModel | undefined,
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
  resource: ResourceEntry,
  contextId: string,
};
type ColumnName = keyof RenderedEntry;
type Sorting = { by: ColumnName, negate: boolean};
const NetworkGridView = GridView<RenderedEntry>;

export function useNetworkTabModel(model: TraceModel | undefined, selectedTime: Boundaries | undefined, pageId?: string): NetworkTabModel {
  const resources = React.useMemo(() => {
    const resources = model?.resources || [];
    const filtered = resources.filter(resource => {
      if (pageId && resource.pageref !== pageId)
        return false;
      if (!selectedTime)
        return true;
      return !!resource._monotonicTime && (resource._monotonicTime >= selectedTime.minimum && resource._monotonicTime <= selectedTime.maximum);
    });
    return filtered;
  }, [model, selectedTime, pageId]);
  return { resources, model };
}

export const NetworkTab: React.FunctionComponent<{
  boundaries: Boundaries,
  networkModel: NetworkTabModel,
  onResourceHovered?: (time: Boundaries | undefined) => void,
  sdkLanguage: Language,
}> = ({ boundaries, networkModel, onResourceHovered, sdkLanguage }) => {
  const [sorting, setSorting] = React.useState<Sorting | undefined>(undefined);
  const [selectedResourceKey, setSelectedResourceKey] = React.useState<string | undefined>(undefined);
  const [filterState, setFilterState] = React.useState(defaultFilterState);

  const { renderedEntries, multipleContexts } = React.useMemo(() => {
    const renderedEntries = networkModel.resources.map(entry => renderEntry(entry, boundaries, networkModel.model)).filter(filterEntry(filterState));
    if (sorting)
      sort(renderedEntries, sorting);
    const multipleContexts = new Set(renderedEntries.map(entry => entry.contextId).filter(Boolean)).size > 1;
    return { renderedEntries, multipleContexts };
  }, [networkModel.resources, networkModel.model, filterState, sorting, boundaries]);

  const visibleSelectedEntry = React.useMemo(() => (selectedResourceKey ? renderedEntries.find(entry => entry.resource.id === selectedResourceKey) : undefined), [selectedResourceKey, renderedEntries]);

  const [columnWidths, setColumnWidths] = React.useState<Map<ColumnName, number>>(() => {
    return new Map(allColumns().map(column => [column, columnWidth(column)]));
  });

  const onFilterStateChange = React.useCallback((newFilterState: FilterState) => {
    setFilterState(newFilterState);
    setSelectedResourceKey(undefined);
  }, []);

  if (!networkModel.resources.length)
    return <PlaceholderPanel text='No network calls' />;

  const grid = <NetworkGridView
    name='network'
    ariaLabel='Network requests'
    items={renderedEntries}
    selectedItem={visibleSelectedEntry}
    onSelected={item => setSelectedResourceKey(item.resource.id)}
    onHighlighted={item => onResourceHovered?.(item ? resourceTimeRange(item.resource) : undefined)}
    columns={visibleColumns(!!visibleSelectedEntry, multipleContexts)}
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
    {!visibleSelectedEntry && grid}
    {visibleSelectedEntry &&
      <SplitView
        sidebarSize={columnWidths.get('name')!}
        sidebarIsFirst={true}
        orientation='horizontal'
        settingName='networkResourceDetails'
        main={visibleSelectedEntry.resource._resourceType === 'websocket'
          ? <WebSocketResourceDetails resource={visibleSelectedEntry.resource} startTimeOffset={visibleSelectedEntry.start} onClose={() => setSelectedResourceKey(undefined)} />
          : <NetworkResourceDetails resource={visibleSelectedEntry.resource} sdkLanguage={sdkLanguage} startTimeOffset={visibleSelectedEntry.start} onClose={() => setSelectedResourceKey(undefined)} />}
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

function visibleColumns(entrySelected: boolean, multipleContexts: boolean): (keyof RenderedEntry)[] {
  if (entrySelected) {
    const columns: (keyof RenderedEntry)[] = ['name'];
    if (multipleContexts)
      columns.unshift('contextId');
    return columns;
  }
  let columns: (keyof RenderedEntry)[] = allColumns();
  if (!multipleContexts)
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
      body: entry.status.code === -1 ? 'canceled' : entry.status.code > 0 ? entry.status.code : '',
      title: entry.status.code === -1 ? 'canceled' : entry.status.text,
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

function resourceContextId(model: TraceModel | undefined, resource: ResourceEntry): string {
  if (!model)
    return '';
  if (resource.pageref)
    return model.pagerefToTitle.get(resource.pageref) || '';
  if (resource._apiRequest) {
    const contextEntry = context(resource);
    return (contextEntry && model.contextToTitle.get(contextEntry)) || '';
  }
  return '';
}

const renderEntry = (resource: ResourceEntry, boundaries: Boundaries, model: TraceModel | undefined): RenderedEntry => {
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
  let contentType: string;
  if (resource._resourceType === 'websocket') {
    contentType = 'websocket';
  } else {
    contentType = resource.response.content.mimeType;
    const charset = contentType.match(/^(.*);\s*charset=.*$/);
    if (charset)
      contentType = charset[1];
  }

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
    contextId: resourceContextId(model, resource),
  };
};

function resourceTimeRange(resource: ResourceEntry): Boundaries | undefined {
  if (!resource._monotonicTime)
    return undefined;
  return { minimum: resource._monotonicTime, maximum: resource._monotonicTime + resource.time };
}

function formatRouteStatus(request: ResourceEntry): string {
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

const resourceTypePredicates: Record<ResourceType, (entry: RenderedEntry) => boolean> = {
  'Fetch': entry => entry.contentType === 'application/json',
  'HTML': entry => entry.contentType === 'text/html',
  'CSS': entry => entry.contentType === 'text/css',
  'JS': entry => entry.contentType.includes('javascript'),
  'Font': entry => entry.contentType.includes('font'),
  'Image': entry => entry.contentType.includes('image'),
  'WS': entry => entry.resource._resourceType === 'websocket',
};

function filterEntry({ searchValue, resourceTypes }: FilterState) {
  return (entry: RenderedEntry) => {
    const isRightType = resourceTypes.size === 0 || Array.from(resourceTypes).some(type => resourceTypePredicates[type](entry));
    return isRightType && entry.name.url.toLowerCase().includes(searchValue.toLowerCase());
  };
}
