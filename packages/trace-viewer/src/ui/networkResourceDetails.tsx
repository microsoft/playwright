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

import type { ResourceSnapshot } from '@trace/snapshot';
import { Expandable } from '@web/components/expandable';
import * as React from 'react';
import './networkResourceDetails.css';

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
      if (resource.request.postData) {
        if (resource.request.postData._sha1) {
          const response = await fetch(`sha1/${resource.request.postData._sha1}`);
          const requestResource = await response.text();
          setRequestBody(requestResource);
        } else {
          setRequestBody(resource.request.postData.text);
        }
      }

      if (resource.response.content._sha1) {
        const useBase64 = resource.response.content.mimeType.includes('image');
        const response = await fetch(`sha1/${resource.response.content._sha1}`);
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
  }, [expanded, resource]);

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

  const requestContentTypeHeader = resource.request.headers.find(q => q.name === 'Content-Type');
  const requestContentType = requestContentTypeHeader ? requestContentTypeHeader.value : '';
  const resourceName = resource.request.url.substring(resource.request.url.lastIndexOf('/') + 1);

  let contentType = resource.response.content.mimeType;
  const charset = contentType.match(/^(.*);\s*charset=.*$/);
  if (charset)
    contentType = charset[1];

  const renderTitle = () => {
    if (resource.response._failureText) {
      return <div className='network-request-title'>
        <div className={'network-request-title-status status-failure'}>{resource.response._failureText}</div>
        <div className='network-request-title-method'>{resource.request.method}</div>
        <div className='network-request-title-url'>{resource.request.url}</div>
      </div>;
    } else {
      return <div className='network-request-title'>
        <div className={'network-request-title-status ' + formatStatus(resource.response.status)}>{resource.response.status}</div>
        <div className='network-request-title-method'>{resource.request.method}</div>
        <div className='network-request-title-url'>{resourceName}</div>
        <div className='network-request-title-content-type'>{contentType}</div>
      </div>;
    }
  };

  return <div
    className={'network-request ' + (selected ? 'selected' : '')} onClick={() => setSelected(index)}>
    <Expandable expanded={expanded} setExpanded={setExpanded} style={{ width: '100%' }} title={ renderTitle() }>
      <div className='network-request-details'>
        <div className='network-request-details-time'>{resource.time}ms</div>
        <div className='network-request-details-header'>URL</div>
        <div className='network-request-details-url'>{resource.request.url}</div>
        <div className='network-request-details-header'>Request Headers</div>
        <div className='network-request-headers'>{resource.request.headers.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
        <div className='network-request-details-header'>Response Headers</div>
        <div className='network-request-headers'>{resource.response.headers.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
        {resource.request.postData ? <div className='network-request-details-header'>Request Body</div> : ''}
        {resource.request.postData ? <div className='network-request-body'>{formatBody(requestBody, requestContentType)}</div> : ''}
        <div className='network-request-details-header'>Response Body</div>
        {!resource.response.content._sha1 ? <div className='network-request-response-body'>Response body is not available for this request.</div> : ''}
        {responseBody !== null && responseBody.dataUrl ? <img src={responseBody.dataUrl} /> : ''}
        {responseBody !== null && responseBody.text ? <div className='network-request-response-body'>{formatBody(responseBody.text, resource.response.content.mimeType)}</div> : ''}
      </div>
    </Expandable>
  </div>;
};
