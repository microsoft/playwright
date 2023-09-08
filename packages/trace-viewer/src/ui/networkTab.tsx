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
import { ListView } from '@web/components/listView';
import * as React from 'react';
import type { Boundaries } from '../geometry';
import './networkTab.css';
import { NetworkResourceDetails } from './networkResourceDetails';
import { bytesToString, msToString } from '@web/uiUtils';
import { PlaceholderPanel } from './placeholderPanel';
import type { MultiTraceModel } from './modelUtil';

const NetworkListView = ListView<Entry>;

type SortBy = 'start' | 'status' | 'method' | 'file' | 'duration' | 'size' | 'content-type';
type Sorting = { by: SortBy, negate: boolean};
type NetworkTabModel = {
  resources: Entry[],
};

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
  onEntryHovered: (entry: Entry | undefined) => void,
}> = ({ boundaries, networkModel, onEntryHovered }) => {
  const [resource, setResource] = React.useState<Entry | undefined>();
  const [sorting, setSorting] = React.useState<Sorting | undefined>(undefined);

  React.useMemo(() => {
    if (sorting)
      sort(networkModel.resources, sorting);
  }, [networkModel.resources, sorting]);

  const toggleSorting = React.useCallback((f: SortBy) => {
    setSorting({ by: f, negate: sorting?.by === f ? !sorting.negate : false });
  }, [sorting]);

  if (!networkModel.resources.length)
    return <PlaceholderPanel text='No network calls' />;

  return <>
    {!resource && <div className='vbox'>
      <NetworkHeader sorting={sorting} toggleSorting={toggleSorting} />
      <NetworkListView
        name='network'
        items={networkModel.resources}
        render={entry => <NetworkResource boundaries={boundaries} resource={entry}></NetworkResource>}
        onSelected={setResource}
        onHighlighted={onEntryHovered}
      />
    </div>}
    {resource && <NetworkResourceDetails resource={resource} onClose={() => setResource(undefined)} />}
  </>;
};

const NetworkHeader: React.FunctionComponent<{
  sorting: Sorting | undefined,
  toggleSorting: (sortBy: SortBy) => void,
}> = ({ toggleSorting: toggleSortBy, sorting }) => {
  return <div className={'hbox network-request-header' + (sorting ? ' filter-' + sorting.by + (sorting.negate ? ' negative' : ' positive') : '')}>
    <div className='network-request-start' onClick={() => toggleSortBy('start') }>
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-status' onClick={() => toggleSortBy('status') }>
      &nbsp;Status
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-method' onClick={() => toggleSortBy('method') }>
      Method
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-file' onClick={() => toggleSortBy('file') }>
      Request
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-content-type' onClick={() => toggleSortBy('content-type') }>
      Content Type
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-duration' onClick={() => toggleSortBy('duration') }>
      Duration
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-size' onClick={() => toggleSortBy('size') }>
      Size
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-route'>Route</div>
  </div>;
};

const NetworkResource: React.FunctionComponent<{
  resource: Entry,
  boundaries: Boundaries,
}> = ({ resource, boundaries }) => {
  const { routeStatus, resourceName, contentType } = React.useMemo(() => {
    const routeStatus = formatRouteStatus(resource);
    const resourceName = resource.request.url.substring(resource.request.url.lastIndexOf('/'));
    let contentType = resource.response.content.mimeType;
    const charset = contentType.match(/^(.*);\s*charset=.*$/);
    if (charset)
      contentType = charset[1];
    return { routeStatus, resourceName, contentType };
  }, [resource]);

  return <div className='hbox'>
    <div className='hbox network-request-start'>
      <div>{msToString(resource._monotonicTime! - boundaries.minimum)}</div>
    </div>
    <div className='hbox network-request-status'>
      <div className={formatStatus(resource.response.status)} title={resource.response.statusText}>{resource.response.status}</div>
    </div>
    <div className='hbox network-request-method'>
      <div>{resource.request.method}</div>
    </div>
    <div className='network-request-file'>
      <div className='network-request-file-url' title={resource.request.url}>{resourceName}</div>
    </div>
    <div className='network-request-content-type' title={contentType}>{contentType}</div>
    <div className='network-request-duration'>{msToString(resource.time)}</div>
    <div className='network-request-size'>{bytesToString(resource.response._transferSize! > 0 ? resource.response._transferSize! : resource.response.bodySize)}</div>
    <div className='network-request-route'>
      {routeStatus && <div className={`status-route ${routeStatus}`}>{routeStatus}</div>}
    </div>
  </div>;
};

function formatStatus(status: number): string {
  if (status >= 200 && status < 400)
    return 'status-success';
  if (status >= 400)
    return 'status-failure';
  return '';
}

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

function sort(resources: Entry[], sorting: Sorting) {
  const c = comparator(sorting?.by);
  if (c)
    resources.sort(c);
  if (sorting.negate)
    resources.reverse();
}

function comparator(sortBy: SortBy) {
  if (sortBy === 'start')
    return (a: Entry, b: Entry) => a._monotonicTime! - b._monotonicTime!;

  if (sortBy === 'duration')
    return (a: Entry, b: Entry) => a.time - b.time;

  if (sortBy === 'status')
    return (a: Entry, b: Entry) => a.response.status - b.response.status;

  if (sortBy === 'method') {
    return (a: Entry, b: Entry) => {
      const valueA = a.request.method;
      const valueB = b.request.method;
      return valueA.localeCompare(valueB);
    };
  }

  if (sortBy === 'size') {
    return (a: Entry, b: Entry) => {
      const sizeA = a.response._transferSize! > 0 ? a.response._transferSize! : a.response.bodySize;
      const sizeB = b.response._transferSize! > 0 ? b.response._transferSize! : b.response.bodySize;
      return sizeA - sizeB;
    };
  }

  if (sortBy === 'content-type') {
    return (a: Entry, b: Entry) => {
      const valueA = a.response.content.mimeType;
      const valueB = b.response.content.mimeType;
      return valueA.localeCompare(valueB);
    };
  }

  if (sortBy === 'file') {
    return (a: Entry, b: Entry) => {
      const nameA = a.request.url.substring(a.request.url.lastIndexOf('/'));
      const nameB = b.request.url.substring(b.request.url.lastIndexOf('/'));
      return nameA.localeCompare(nameB);
    };
  }
}
