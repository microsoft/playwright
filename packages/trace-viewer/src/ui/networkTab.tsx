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
import type { Boundaries } from '../geometry';
import './networkTab.css';
import { NetworkResourceDetails } from './networkResourceDetails';
import { bytesToString, msToString } from '@web/uiUtils';
import { PlaceholderPanel } from './placeholderPanel';
import { context, type MultiTraceModel } from './modelUtil';
import { GridView, type RenderedGridCell } from '@web/components/gridView';
import { SplitView } from '@web/components/splitView';

type NetworkTabModel = {
  resources: Entry[],
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
  return { resources };
}

export const NetworkTab: React.FunctionComponent<{
  boundaries: Boundaries,
  networkModel: NetworkTabModel,
  model?: MultiTraceModel,
  onEntryHovered: (entry: Entry | undefined) => void,
}> = ({ boundaries, networkModel, model, onEntryHovered }) => {
  const [sorting, setSorting] = React.useState<Sorting | undefined>(undefined);
  const [selectedEntry, setSelectedEntry] = React.useState<RenderedEntry | undefined>(undefined);

  const { renderedEntries } = React.useMemo(() => {
    const generator = ContextIdGenerator.forModel(model);
    const renderedEntries = networkModel.resources.map(entry => renderEntry(entry, boundaries, generator));
    if (sorting)
      sort(renderedEntries, sorting);
    return { renderedEntries };
  }, [networkModel.resources, sorting, boundaries, model]);

  if (!networkModel.resources.length)
    return <PlaceholderPanel text='No network calls' />;

  const grid = <NetworkGridView
    name='network'
    items={renderedEntries}
    selectedItem={selectedEntry}
    onSelected={item => setSelectedEntry(item)}
    onHighlighted={item => onEntryHovered(item?.resource)}
    columns={visibleColumns(!!selectedEntry, renderedEntries)}
    columnTitle={columnTitle}
    columnWidth={columnWidth}
    isError={item => item.status.code >= 400}
    isInfo={item => !!item.route}
    render={(item, column) => renderCell(item, column)}
    sorting={sorting}
    setSorting={setSorting}
  />;
  return <>
    {!selectedEntry && grid}
    {selectedEntry && <SplitView sidebarSize={200} sidebarIsFirst={true} orientation='horizontal'>
      <NetworkResourceDetails resource={selectedEntry.resource} onClose={() => setSelectedEntry(undefined)} />
      {grid}
    </SplitView>}
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
  return 100;
};

function visibleColumns(entrySelected: boolean, renderedEntries: RenderedEntry[]): (keyof RenderedEntry)[] {
  if (entrySelected)
    return ['name'];
  const columns: (keyof RenderedEntry)[] = [];
  if (hasMultipleContexts(renderedEntries))
    columns.push('contextId');
  columns.push('name', 'method', 'status', 'contentType', 'duration', 'size', 'start', 'route');
  return columns;
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

class ContextIdGenerator {
  private _pagerefToShortId = new Map<string, string>();
  private _lastPageId = 0;
  private _lastApiRequestContextId = 0;
  private static _apiRequestContextIdSymbol = Symbol('apiRequestContextId');
  private static _contextIdGeneratorSymbol = Symbol('contextIdGenerator');

  static forModel(model?: MultiTraceModel): ContextIdGenerator {
    if (!model)
      return new ContextIdGenerator();
    let generator = (model as any)[ContextIdGenerator._contextIdGeneratorSymbol];
    if (!generator) {
      generator = new ContextIdGenerator();
      (model as any)[ContextIdGenerator._contextIdGeneratorSymbol] = generator;
    }
    return generator;
  }

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
      shortId = 'page@' + this._lastPageId;
      this._pagerefToShortId.set(pageref, shortId);
    }
    return shortId;
  }

  private _apiRequestContextId(resource: Entry): string {
    const contextEntry = context(resource);
    if (!contextEntry)
      return '';
    let contextId = (contextEntry as any)[ContextIdGenerator._apiRequestContextIdSymbol];
    if (!contextId) {
      ++this._lastApiRequestContextId;
      contextId = 'api@' + this._lastApiRequestContextId;
      (contextEntry as any)[ContextIdGenerator._apiRequestContextIdSymbol] = contextId;
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

const renderEntry = (resource: Entry, boundaries: Boundaries, contextIdGenerator: ContextIdGenerator): RenderedEntry => {
  const routeStatus = formatRouteStatus(resource);
  let resourceName: string;
  try {
    const url = new URL(resource.request.url);
    resourceName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
    if (!resourceName)
      resourceName = url.host;
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
