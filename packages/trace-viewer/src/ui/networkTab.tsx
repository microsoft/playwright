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
import type * as modelUtil from './modelUtil';
import './networkTab.css';
import { NetworkResourceDetails } from './networkResourceDetails';
import { bytesToString, msToString } from '@web/uiUtils';

const NetworkListView = ListView<Entry>;

type Filter = 'status' | 'method' | 'file' | 'time' | 'size' | 'content-type';

export const NetworkTab: React.FunctionComponent<{
  model: modelUtil.MultiTraceModel | undefined,
  selectedTime: Boundaries | undefined,
  onEntryHovered: (entry: Entry | undefined) => void,
}> = ({ model, selectedTime, onEntryHovered }) => {
  const [resource, setResource] = React.useState<Entry | undefined>();
  const [filter, setFilter] = React.useState<Filter | undefined>(undefined);
  const [negateFilter, setNegateFilter] = React.useState<boolean>(false);

  const resources = React.useMemo(() => {
    const resources = model?.resources || [];
    const filtered = resources.filter(resource => {
      if (!selectedTime)
        return true;
      return !!resource._monotonicTime && (resource._monotonicTime >= selectedTime.minimum && resource._monotonicTime <= selectedTime.maximum);
    });
    if (filter)
      sort(filtered, filter, negateFilter);
    return filtered;
  }, [filter, model, negateFilter, selectedTime]);

  const toggleFilter = React.useCallback((f: Filter) => {
    if (filter === f) {
      setNegateFilter(!negateFilter);
    } else {
      setNegateFilter(false);
      setFilter(f);
    }
  }, [filter, negateFilter]);

  return <>
    {!resource && <div className='vbox'>
      <NetworkHeader filter={filter} negateFilter={negateFilter} toggleFilter={toggleFilter} />
      <NetworkListView
        dataTestId='network-request-list'
        items={resources}
        render={entry => <NetworkResource resource={entry}></NetworkResource>}
        onSelected={setResource}
        onHighlighted={onEntryHovered}
      />
    </div>}
    {resource && <NetworkResourceDetails resource={resource} onClose={() => setResource(undefined)} />}
  </>;
};

const NetworkHeader: React.FunctionComponent<{
  filter: Filter | undefined,
  negateFilter: boolean,
  toggleFilter: (filter: Filter) => void,
}> = ({ toggleFilter, filter, negateFilter }) => {
  return <div className={'hbox network-request-header' + (filter ? ' filter-' + filter : '') + (negateFilter ? ' negative' : ' positive')}>
    <div className='network-request-status' onClick={() => toggleFilter('status') }>
      &nbsp;Status
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-method' onClick={() => toggleFilter('method') }>
      Method
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-file' onClick={() => toggleFilter('file') }>
      Request
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-content-type' onClick={() => toggleFilter('content-type') }>
      Content Type
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-time' onClick={() => toggleFilter('time') }>
      Time
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-size' onClick={() => toggleFilter('size') }>
      Size
      <span className='codicon codicon-triangle-up' />
      <span className='codicon codicon-triangle-down' />
    </div>
    <div className='network-request-route'>Route</div>
  </div>;
};

const NetworkResource: React.FunctionComponent<{
  resource: Entry,
}> = ({ resource }) => {
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
    <div className='network-request-time'>{msToString(resource.time)}</div>
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

function sort(resources: Entry[], filter: Filter | undefined, negate: boolean) {
  const c = comparator(filter);
  if (c)
    resources.sort(c);
  if (negate)
    resources.reverse();
}

function comparator(filter: Filter | undefined) {
  if (filter === 'time')
    return (a: Entry, b: Entry) => a.time - b.time;

  if (filter === 'status')
    return (a: Entry, b: Entry) => a.response.status - b.response.status;

  if (filter === 'method') {
    return (a: Entry, b: Entry) => {
      const valueA = a.request.method;
      const valueB = b.request.method;
      return valueA.localeCompare(valueB);
    };
  }

  if (filter === 'size') {
    return (a: Entry, b: Entry) => {
      const sizeA = a.response._transferSize! > 0 ? a.response._transferSize! : a.response.bodySize;
      const sizeB = b.response._transferSize! > 0 ? b.response._transferSize! : b.response.bodySize;
      return sizeA - sizeB;
    };
  }

  if (filter === 'content-type') {
    return (a: Entry, b: Entry) => {
      const valueA = a.response.content.mimeType;
      const valueB = b.response.content.mimeType;
      return valueA.localeCompare(valueB);
    };
  }

  if (filter === 'file') {
    return (a: Entry, b: Entry) => {
      const nameA = a.request.url.substring(a.request.url.lastIndexOf('/'));
      const nameB = b.request.url.substring(b.request.url.lastIndexOf('/'));
      return nameA.localeCompare(nameB);
    };
  }
}
