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

import './networkResourceDetails.css';
import * as React from 'react';
import { Expandable } from './helpers';
import type { ResourceSnapshot } from '../../../server/snapshot/snapshotTypes';

export const NetworkResourceDetails: React.FunctionComponent<{
  resource: ResourceSnapshot,
  index: number,
  selected: boolean,
  setSelected: React.Dispatch<React.SetStateAction<number>>,
}> = ({ resource, index, selected, setSelected }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [requestBody, setRequestBody] = React.useState<string | null>(null);
  const [responseBody, setResponseBody] = React.useState<{ dataUrl?: string, text?: string } | null>(null);

  React.useEffect(() => {
    setExpanded(false);
    setSelected(-1);
  }, [resource, setSelected]);

  React.useEffect(() => {
    const readResources = async  () => {
      if (resource.requestSha1) {
        const response = await fetch(`/sha1/${resource.requestSha1}`);
        const requestResource = await response.text();
        setRequestBody(requestResource);
      }

      if (resource.responseSha1) {
        const useBase64 = resource.contentType.includes('image');
        const response = await fetch(`/sha1/${resource.responseSha1}`);
        if (useBase64) {
          const blob = await response.blob();
          const reader = new FileReader();
          const eventPromise = new Promise<any>(f => reader.onload = f);
          reader.readAsDataURL(blob);
          setResponseBody({ dataUrl: (await eventPromise).target.result });
        } else {
          setResponseBody({ text: await response.text() });
        }
      }
    };

    readResources();
  }, [expanded, resource.responseSha1, resource.requestSha1, resource.contentType]);

  function formatBody(body: string | null, contentType: string): string {
    if (body === null)
      return 'Loading...';

    const bodyStr = body;

    if (bodyStr === '')
      return '<Empty>';

    if (contentType.includes('application/json')) {
      try {
        return JSON.stringify(JSON.parse(bodyStr), null, 2);
      } catch (err) {
        return bodyStr;
      }
    }

    if (contentType.includes('application/x-www-form-urlencoded'))
      return decodeURIComponent(bodyStr);

    return bodyStr;
  }

  function formatStatus(status: number): string {
    if (status >= 200 && status < 400)
      return 'status-success';

    if (status >= 400)
      return 'status-failure';

    return 'status-neutral';
  }

  const requestContentTypeHeader = resource.requestHeaders.find(q => q.name === 'Content-Type');
  const requestContentType = requestContentTypeHeader ? requestContentTypeHeader.value : '';
  const resourceName = resource.url.substring(resource.url.lastIndexOf('/') + 1);

  return <div
    className={'network-request ' + (selected ? 'selected' : '')} onClick={() => setSelected(index)}>
    <Expandable expanded={expanded} setExpanded={setExpanded} style={{ width: '100%' }} title={
      <div className='network-request-title'>
        <div className={'network-request-title-status ' + formatStatus(resource.status)}>{resource.status}</div>
        <div className='network-request-title-method'>{resource.method}</div>
        <div className='network-request-title-url'>{resourceName}</div>
        <div className='network-request-title-content-type'>{resource.type}</div>
      </div>
    } body={
      <div className='network-request-details'>
        <div className='network-request-details-header'>URL</div>
        <div className='network-request-details-url'>{resource.url}</div>
        <div className='network-request-details-header'>Request Headers</div>
        <div className='network-request-headers'>{resource.requestHeaders.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
        <div className='network-request-details-header'>Response Headers</div>
        <div className='network-request-headers'>{resource.responseHeaders.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
        {resource.requestSha1 ? <div className='network-request-details-header'>Request Body</div> : ''}
        {resource.requestSha1 ? <div className='network-request-body'>{formatBody(requestBody, requestContentType)}</div> : ''}
        <div className='network-request-details-header'>Response Body</div>
        {!resource.responseSha1 ? <div className='network-request-response-body'>Response body is not available for this request.</div> : ''}
        {responseBody !== null && responseBody.dataUrl ? <img src={responseBody.dataUrl} /> : ''}
        {responseBody !== null && responseBody.text ? <div className='network-request-response-body'>{formatBody(responseBody.text, resource.contentType)}</div> : ''}
      </div>
    }/>
  </div>;
};
