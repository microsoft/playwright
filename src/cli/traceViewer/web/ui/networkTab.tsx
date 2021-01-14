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

import { ActionEntry } from '../../traceModel';
import './networkTab.css';
import * as React from 'react';
import { Expandable } from './helpers';
import { NetworkResourceTraceEvent } from '../../../../trace/traceTypes';

export const NetworkTab: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
}> = ({ actionEntry }) => {
  return <div className='network-tab'>{
    (actionEntry ? actionEntry.resources : []).map((resource, index) => {
      return <NetworkResourceDetails resource={resource} key={index}/>;
    })
  }</div>;
};


export const NetworkResourceDetails: React.FunctionComponent<{
  resource: NetworkResourceTraceEvent,
}> = ({ resource }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [requestBody, setRequestBody] = React.useState<String | null>(null);
  const [responseBody, setResponseBody] = React.useState<String | null>(null);

  React.useEffect(() => {
    const readResources = async  () => {
      if (resource.requestSha1 !== 'none') {
        const requestResource = await window.readResource(resource.requestSha1);
        setRequestBody(requestResource);
      }

      if (resource.sha1 !== 'none') {
        const responseResource = await window.readResource(resource.sha1);
        setResponseBody(responseResource);
      }
    };

    readResources();
  }, [expanded, resource.sha1, resource.requestSha1]);

  function formatBody(body, contentType) {
    if (body === null)
      return 'Loading...';

    if (contentType.includes('application/json')) {
      try {
        return JSON.stringify(JSON.parse(atob(body)), null, 2);
      } catch (err) {
        return atob(body);
      }
    }

    if (contentType.includes('application/x-www-form-urlencoded'))
      return decodeURIComponent(atob(body));

    return atob(body);
  }

  const requestContentTypeHeader = resource.requestHeaders.find(q => q.name === 'Content-Type');
  const requestContentType = requestContentTypeHeader && requestContentTypeHeader.value;

  return <div
    className='network-request'>
    <Expandable expanded={expanded} setExpanded={setExpanded} style={{ width: '100%' }} title={
      <div className='network-request-title'>
        <div className='network-request-title-method'>{resource.method}: &nbsp;</div>
        <div className='network-request-title-url'>{resource.url}</div>
        <div className='network-request-title-content-type'>{resource.contentType}</div>
      </div>
    } body={
      <div className='network-request-details'>
        <h4>URL</h4>
        <div className='network-request-details-url'>{resource.url}</div>
        <h4>Request Headers</h4>
        <div className='network-request-headers'>{resource.requestHeaders.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
        <h4>Response Headers</h4>
        <div className='network-request-headers'>{resource.responseHeaders.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
        {resource.requestSha1 !== 'none' ? <h3>Request Body</h3> : ''}
        {resource.requestSha1 !== 'none' ? <div className='network-request-body'>{formatBody(requestBody, requestContentType)}</div> : ''}
        <h4>Response Body</h4>
        {resource.sha1 !== 'none' && responseBody !== null && resource.contentType.includes('image') ? <img src={`data:${resource.contentType};base64,${responseBody}`} /> : ''}
        {resource.sha1 !== 'none' && responseBody !== null && !resource.contentType.includes('image') ? <div className='network-request-response-body'>{formatBody(responseBody, resource.contentType)}</div> : ''}
      </div>
    }/>
  </div>;
};