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
import type { WebSocketSnapshot } from '@trace/snapshot';
import * as React from 'react';
import type { Boundaries } from './geometry';
import './networkTab.css';
import { NetworkResourceDetails, WebSocketDetails } from './networkResourceDetails';
import { bytesToString, msToString } from '@web/uiUtils';
import { PlaceholderPanel } from './placeholderPanel';
import { context } from '@isomorphic/trace/traceModel';
import type { TraceModel } from '@isomorphic/trace/traceModel';
import { GridView, type RenderedGridCell } from '@web/components/gridView';
import { SplitView } from '@web/components/splitView';
import type { ContextEntry } from '@isomorphic/trace/entries';
import { NetworkFilters, defaultFilterState, type FilterState, type ResourceType } from './networkFilters';
import type { Language } from '@isomorphic/locatorGenerators';

type NetworkTabModel = {
  resources: Entry[],
  websockets: WebSocketSnapshot[],
  contextIdMap: ContextIdMap,
};

type RenderedEntry = {
  ordinal: number,
  name: { name: string, url: string },
  method: string,
  status: { code: number, text: string },
  contentType: string,
  duration: number,
  size: number,
  start: number,
  route: string,
  resource?: Entry,
  websocket?: WebSocketSnapshot,
  contextId: string,
  isWebSocket: boolean,
};
type ColumnName = keyof RenderedEntry;
type Sorting = { by: ColumnName, negate: boolean};
const NetworkGridView = GridView<RenderedEntry>;

export function useNetworkTabModel(model: TraceModel | undefined, selectedTime: Boundaries | undefined): NetworkTabModel {
  const resources = React.useMemo(() => {
    const resources = model?.resources || [];
    const filtered = resources.filter(resource => {
      if (!selectedTime)
        return true;
      return !!resource._monotonicTime && (resource._monotonicTime >= selectedTime.minimum && resource._monotonicTime <= selectedTime.maximum);
    });
    return filtered;
  }, [model, selectedTime]);
  const websockets = React.useMemo(() => {
    const websockets = model?.websockets || [];
    const filtered = websockets.filter(ws => {
      if (!selectedTime)
        return true;
      return ws.createdTimestamp >= selectedTime.minimum && ws.createdTimestamp <= selectedTime.maximum;
    });
    return filtered;
  }, [model, selectedTime]);
  const contextIdMap = React.useMemo(() => new ContextIdMap(model), [model]);
  return { resources, websockets, contextIdMap };
}

export const NetworkTab: React.FunctionComponent<{
  boundaries: Boundaries,
  networkModel: NetworkTabModel,
  onResourceHovered?: (ordinal: number | undefined) => void,
  sdkLanguage: Language,
}> = ({ boundaries, networkModel, onResourceHovered, sdkLanguage }) => {
  const [sorting, setSorting] = React.useState<Sorting | undefined>(undefined);
  const [selectedEntry, setSelectedEntry] = React.useState<RenderedEntry | undefined>(undefined);
  const [filterState, setFilterState] = React.useState(defaultFilterState);

  const { renderedEntries } = React.useMemo(() => {
    // Combine HTTP resources and WebSocket entries
    const httpEntries = networkModel.resources.map((entry, i) => renderEntry(entry, boundaries, networkModel.contextIdMap, i));
    const wsEntries = networkModel.websockets.map((ws, i) => renderWebSocketEntry(ws, boundaries, networkModel.contextIdMap, networkModel.resources.length + i));
    const allEntries = [...httpEntries, ...wsEntries].filter(filterEntry(filterState));
    if (sorting)
      sort(allEntries, sorting);
    return { renderedEntries: allEntries };
  }, [networkModel.resources, networkModel.websockets, networkModel.contextIdMap, filterState, sorting, boundaries]);

  const [columnWidths, setColumnWidths] = React.useState<Map<ColumnName, number>>(() => {
    return new Map(allColumns().map(column => [column, columnWidth(column)]));
  });

  const onFilterStateChange = React.useCallback((newFilterState: FilterState) => {
    setFilterState(newFilterState);
    setSelectedEntry(undefined);
  }, []);

  if (!networkModel.resources.length && !networkModel.websockets.length)
    return <PlaceholderPanel text='No network calls' />;

  const grid = <NetworkGridView
    name='network'
    ariaLabel='Network requests'
    items={renderedEntries}
    selectedItem={selectedEntry}
    onSelected={item => setSelectedEntry(item)}
    onHighlighted={item => onResourceHovered?.(item?.ordinal)}
    columns={visibleColumns(!!selectedEntry, renderedEntries)}
    columnTitle={columnTitle}
    columnWidths={columnWidths}
    setColumnWidths={setColumnWidths}
    isError={item => item.status.code >= 400 || item.status.code === -1}
    isInfo={item => !!item.route || item.isWebSocket}
    render={(item, column) => renderCell(item, column)}
    sorting={sorting}
    setSorting={setSorting}
  />;

  const renderDetails = () => {
    if (!selectedEntry)
      return null;
    if (selectedEntry.isWebSocket && selectedEntry.websocket)
      return <WebSocketDetails websocket={selectedEntry.websocket} startTimeOffset={selectedEntry.start} onClose={() => setSelectedEntry(undefined)} />;
    if (selectedEntry.resource)
      return <NetworkResourceDetails resource={selectedEntry.resource} sdkLanguage={sdkLanguage} startTimeOffset={selectedEntry.start} onClose={() => setSelectedEntry(undefined)} />;
    return null;
  };

  return <>
    <NetworkFilters filterState={filterState} onFilterStateChange={onFilterStateChange} />
    {!selectedEntry && grid}
    {selectedEntry &&
      <SplitView
        sidebarSize={columnWidths.get('name')!}
        sidebarIsFirst={true}
        orientation='horizontal'
        settingName='networkResourceDetails'
        main={renderDetails()}
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

  constructor(model: TraceModel | undefined) {}

  contextId(resource: Entry): string {
    if (resource.pageref)
      return this.pageId(resource.pageref);
    else if (resource._apiRequest)
      return this._apiRequestContextId(resource);
    return '';
  }

  pageId(pageref: string): string {
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

const renderEntry = (resource: Entry, boundaries: Boundaries, contextIdGenerator: ContextIdMap, ordinal: number): RenderedEntry => {
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
    ordinal,
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
    isWebSocket: false,
  };
};

const renderWebSocketEntry = (ws: WebSocketSnapshot, boundaries: Boundaries, contextIdGenerator: ContextIdMap, ordinal: number): RenderedEntry => {
  let resourceName: string;
  try {
    const url = new URL(ws.url);
    resourceName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
    if (!resourceName)
      resourceName = url.host;
    if (url.search)
      resourceName += url.search;
  } catch {
    resourceName = ws.url;
  }

  const duration = ws.closedTimestamp ? ws.closedTimestamp - ws.createdTimestamp : 0;
  const totalFrameSize = ws.frames.reduce((sum, frame) => {
    // For binary frames, data is base64-encoded, so decode the size
    const frameSize = frame.opcode === 2 ? Math.ceil(frame.data.length * 3 / 4) : frame.data.length;
    return sum + frameSize;
  }, 0);

  return {
    ordinal,
    name: { name: resourceName, url: ws.url },
    method: 'WS',
    status: { code: ws.error ? -1 : 101, text: ws.error || 'Switching Protocols' },
    contentType: 'websocket',
    duration,
    size: totalFrameSize,
    start: ws.createdTimestamp - boundaries.minimum,
    route: '',
    websocket: ws,
    contextId: ws.pageId ? contextIdGenerator.pageId(ws.pageId) : '',
    isWebSocket: true,
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
  'Fetch': contentType => contentType === 'application/json',
  'HTML': contentType => contentType === 'text/html',
  'CSS': contentType => contentType === 'text/css',
  'JS': contentType => contentType.includes('javascript'),
  'Font': contentType => contentType.includes('font'),
  'Image': contentType => contentType.includes('image'),
  'WS': contentType => contentType === 'websocket',
};

function filterEntry({ searchValue, resourceTypes }: FilterState) {
  return (entry: RenderedEntry) => {
    const isRightType = resourceTypes.size === 0 || Array.from(resourceTypes).some(type => resourceTypePredicates[type](entry.contentType));
    return isRightType && entry.name.url.toLowerCase().includes(searchValue.toLowerCase());
  };
}
