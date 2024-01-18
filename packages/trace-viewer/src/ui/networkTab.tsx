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
import type { MultiTraceModel } from './modelUtil';
import { GridView } from '@web/components/gridView';
import { SplitView } from '@web/components/splitView';

type NetworkTabModel = {
  resources: Entry[];
};

type RenderedEntry = {
  name: { name: string; url: string };
  method: string;
  status: { code: number; text: string; className: string };
  contentType: string;
  duration: number;
  size: number;
  start: number;
  route: string;
  resource: Entry;
};
type ColumnName = keyof RenderedEntry;
type Sorting = { by: ColumnName; negate: boolean };
enum ResourceType {
  ALL = 'All',
  JS = 'JS',
  CSS = 'CSS',
  FONT = 'Font',
  IMG = 'Img'
}
const NetworkGridView = GridView<RenderedEntry>;

export function useNetworkTabModel(
  model: MultiTraceModel | undefined,
  selectedTime: Boundaries | undefined
): NetworkTabModel {
  const resources = React.useMemo(() => {
    const resources = model?.resources || [];
    const filtered = resources.filter(resource => {
      if (!selectedTime) return true;
      return (
        !!resource._monotonicTime &&
        resource._monotonicTime >= selectedTime.minimum &&
        resource._monotonicTime <= selectedTime.maximum
      );
    });
    return filtered;
  }, [model, selectedTime]);
  return { resources };
}

export const NetworkTab: React.FunctionComponent<{
  boundaries: Boundaries;
  networkModel: NetworkTabModel;
  onEntryHovered: (entry: Entry | undefined) => void;
}> = ({ boundaries, networkModel, onEntryHovered }) => {
  const [sorting, setSorting] = React.useState<Sorting | undefined>(undefined);
  const [filter, setFilter] = React.useState<ResourceType>(ResourceType.ALL);
  const [selectedEntry, setSelectedEntry] = React.useState<
    RenderedEntry | undefined
  >(undefined);

  const canBeDisplayed = (resource: Entry): boolean => {
    switch (filter) {
      case ResourceType.ALL:
        return true;
      case ResourceType.JS:
        return resource.request.url.includes('.js') || resource.response.headers.some(
            header =>
              header.value.includes('javascript') && header.name === 'Content-Type'
        );
      case ResourceType.CSS:
        return resource.request.url.includes('.css');
      case ResourceType.FONT:
        return (
          resource.response.headers.some(
              header =>
                header.value.includes('font') && header.name === 'Content-Type'
          ) ||
          resource.request.url.includes('.ttf') ||
          resource.request.url.includes('.otf') ||
          resource.request.url.includes('.woff') ||
          resource.request.url.includes('.woff2')
        );
      case ResourceType.IMG:
        return (
          resource.response.headers.some(
              header =>
                header.value.includes('image') && header.name === 'Content-Type'
          ) ||
            resource.request.url.includes('.svg') ||
            resource.request.url.includes('.jpeg') ||
            resource.request.url.includes('.png') ||
            resource.request.url.includes('.gif')
        );
    }

    return true;
  };

  const { renderedEntries } = React.useMemo(() => {
    const renderedEntries = networkModel.resources
        .filter(entry => canBeDisplayed(entry))
        .map(entry => renderEntry(entry, boundaries));

    if (sorting) sort(renderedEntries, sorting);
    return { renderedEntries };
  }, [networkModel.resources, sorting, boundaries, filter]);

  const { filters } = React.useMemo(() => {
    const filters = (
      <div className="filters">
        {Object.keys(ResourceType).map(key => {
          const type = ResourceType[key as keyof typeof ResourceType];
          return (
            <span
              className={`filter ${type === filter ? 'enabled' : ''}`}
              onClick={() =>
                setFilter(type)
              }
            >
              {type}
            </span>
          );
        })}
      </div>
    );

    return { filters };
  }, [filter]);

  if (!networkModel.resources.length)
    return <PlaceholderPanel text="No network calls" />;

  const grid = (
    <NetworkGridView
      name="network"
      items={renderedEntries}
      selectedItem={selectedEntry}
      onSelected={item => setSelectedEntry(item)}
      onHighlighted={item => onEntryHovered(item?.resource)}
      columns={
        selectedEntry
          ? ['name']
          : [
            'name',
            'method',
            'status',
            'contentType',
            'duration',
            'size',
            'start',
            'route',
          ]
      }
      columnTitle={columnTitle}
      columnWidth={column => (column === 'name' ? 200 : 100)}
      render={(item, column) => renderCell(item, column)}
      sorting={sorting}
      setSorting={setSorting}
    />
  );
  return (
    <>
      {!selectedEntry && (
        <SplitView
          sidebarSize={30}
          minSidebarSize={30}
          sidebarIsFirst={true}
          orientation="vertical"
          sidebarHidden={false}
        >
          {filters}
          {grid}
        </SplitView>
      )}
      {selectedEntry && (
        <SplitView
          sidebarSize={200}
          sidebarIsFirst={true}
          orientation="horizontal"
        >
          <NetworkResourceDetails
            resource={selectedEntry.resource}
            onClose={() => setSelectedEntry(undefined)}
          />
          {grid}
        </SplitView>
      )}
    </>
  );
};

const columnTitle = (column: ColumnName) => {
  if (column === 'name') return 'Name';
  if (column === 'method') return 'Method';
  if (column === 'status') return 'Status';
  if (column === 'contentType') return 'Content Type';
  if (column === 'duration') return 'Duration';
  if (column === 'size') return 'Size';
  if (column === 'start') return 'Start';
  if (column === 'route') return 'Route';
  return '';
};

const renderCell = (entry: RenderedEntry, column: ColumnName) => {
  if (column === 'name')
    return <span title={entry.name.url}>{entry.name.name}</span>;
  if (column === 'method') return <span>{entry.method}</span>;
  if (column === 'status') {
    return (
      <span className={entry.status.className} title={entry.status.text}>
        {entry.status.code > 0 ? entry.status.code : ''}
      </span>
    );
  }
  if (column === 'contentType') return <span>{entry.contentType}</span>;
  if (column === 'duration') return <span>{msToString(entry.duration)}</span>;
  if (column === 'size') return <span>{bytesToString(entry.size)}</span>;
  if (column === 'start') return <span>{msToString(entry.start)}</span>;
  if (column === 'route') {
    return (
      entry.route && (
        <span className={`status-route ${entry.route}`}>{entry.route}</span>
      )
    );
  }
};

const renderEntry = (
  resource: Entry,
  boundaries: Boundaries
): RenderedEntry => {
  const routeStatus = formatRouteStatus(resource);
  let resourceName: string;
  try {
    const url = new URL(resource.request.url);
    resourceName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
    if (!resourceName) resourceName = url.host;
  } catch {
    resourceName = resource.request.url;
  }
  let contentType = resource.response.content.mimeType;
  const charset = contentType.match(/^(.*);\s*charset=.*$/);
  if (charset) contentType = charset[1];

  return {
    name: { name: resourceName, url: resource.request.url },
    method: resource.request.method,
    status: {
      code: resource.response.status,
      text: resource.response.statusText,
      className: statusClassName(resource.response.status),
    },
    contentType: contentType,
    duration: resource.time,
    size:
      resource.response._transferSize! > 0
        ? resource.response._transferSize!
        : resource.response.bodySize,
    start: resource._monotonicTime! - boundaries.minimum,
    route: routeStatus,
    resource,
  };
};

function statusClassName(status: number): string {
  if (status >= 200 && status < 400) return 'status-success';
  if (status >= 400) return 'status-failure';
  return '';
}

function formatRouteStatus(request: Entry): string {
  if (request._wasAborted) return 'aborted';
  if (request._wasContinued) return 'continued';
  if (request._wasFulfilled) return 'fulfilled';
  if (request._apiRequest) return 'api';
  return '';
}

function sort(resources: RenderedEntry[], sorting: Sorting) {
  const c = comparator(sorting?.by);
  if (c) resources.sort(c);
  if (sorting.negate) resources.reverse();
}

function comparator(sortBy: ColumnName) {
  if (sortBy === 'start')
    return (a: RenderedEntry, b: RenderedEntry) => a.start - b.start;

  if (sortBy === 'duration')
    return (a: RenderedEntry, b: RenderedEntry) => a.duration - b.duration;

  if (sortBy === 'status') {
    return (a: RenderedEntry, b: RenderedEntry) =>
      a.status.code - b.status.code;
  }

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
}
