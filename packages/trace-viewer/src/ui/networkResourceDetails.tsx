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
import type { Entry } from '@trace/har';
import { msToString } from '@web/uiUtils';
import { TabbedPane } from '@web/components/tabbedPane';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import type { Language } from '@web/components/codeMirrorWrapper';

export const NetworkResource: React.FunctionComponent<{
  resource: Entry,
}> = ({ resource }) => {
  const [expanded, setExpanded] = React.useState(false);

  const { routeStatus, resourceName, contentType } = React.useMemo(() => {
    const routeStatus = formatRouteStatus(resource);
    const resourceName = resource.request.url.substring(resource.request.url.lastIndexOf('/'));
    let contentType = resource.response.content.mimeType;
    const charset = contentType.match(/^(.*);\s*charset=.*$/);
    if (charset)
      contentType = charset[1];
    return { routeStatus, resourceName, contentType };
  }, [resource]);

  const renderTitle = React.useCallback(() => {
    return <div className='network-request-title'>
      {routeStatus && <div className={`network-request-title-status status-route ${routeStatus}`}>{routeStatus}</div> }
      {resource.response._failureText && <div className={'network-request-title-status status-failure'}>{resource.response._failureText}</div>}
      {!resource.response._failureText && <div className={'network-request-title-status ' + formatStatus(resource.response.status)}>{resource.response.status}</div>}
      <div className='network-request-title-status'>{resource.request.method}</div>
      <div className='network-request-title-url'>{resourceName}</div>
      <div className='network-request-title-content-type'>{contentType}</div>
    </div>;
  }, [contentType, resource, resourceName, routeStatus]);

  return <div className='network-request'>
    <Expandable expanded={expanded} setExpanded={setExpanded} title={renderTitle()} expandOnTitleClick={true}>
      {expanded && <NetworkResourceDetails resource={resource} />}
    </Expandable>
  </div>;
};

const NetworkResourceDetails: React.FunctionComponent<{
  resource: ResourceSnapshot,
}> = ({ resource }) => {
  const [requestBody, setRequestBody] = React.useState<{ text: string, language?: Language } | null>(null);
  const [responseBody, setResponseBody] = React.useState<{ dataUrl?: string, text?: string, language?: Language } | null>(null);
  const [selectedTab, setSelectedTab] = React.useState('request');

  React.useEffect(() => {
    const readResources = async  () => {
      if (resource.request.postData) {
        const requestContentTypeHeader = resource.request.headers.find(q => q.name === 'Content-Type');
        const requestContentType = requestContentTypeHeader ? requestContentTypeHeader.value : '';
        const language = mimeTypeToHighlighter(requestContentType);
        if (resource.request.postData._sha1) {
          const response = await fetch(`sha1/${resource.request.postData._sha1}`);
          setRequestBody({ text: formatBody(await response.text(), requestContentType), language });
        } else {
          setRequestBody({ text: formatBody(resource.request.postData.text, requestContentType), language });
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
          const formattedBody = formatBody(await response.text(), resource.response.content.mimeType);
          const language = mimeTypeToHighlighter(resource.response.content.mimeType);
          setResponseBody({ text: formattedBody, language });
        }
      }
    };

    readResources();
  }, [resource]);

  return <TabbedPane tabs={[
    {
      id: 'request',
      title: 'Request',
      render: () => <div className='network-request-details'>
        <div className='network-request-details-header'>URL</div>
        <div className='network-request-details-url'>{resource.request.url}</div>
        <div className='network-request-details-header'>Request Headers</div>
        <div className='network-request-headers'>{resource.request.headers.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
        {requestBody && <div className='network-request-details-header'>Request Body</div>}
        {requestBody && <CodeMirrorWrapper text={requestBody.text} language={requestBody.language} />}
      </div>,
    },
    {
      id: 'response',
      title: 'Response',
      render: () => <div className='network-request-details'>
        <div className='network-request-details-time'>{msToString(resource.time)}</div>
        <div className='network-request-details-header'>Response Headers</div>
        <div className='network-request-headers'>{resource.response.headers.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
      </div>,
    },
    {
      id: 'body',
      title: 'Body',
      render: () => <div className='network-request-details'>
        {!resource.response.content._sha1 && <div>Response body is not available for this request.</div>}
        {responseBody && responseBody.dataUrl && <img draggable='false' src={responseBody.dataUrl} />}
        {responseBody && responseBody.text && <CodeMirrorWrapper text={responseBody.text} language={responseBody.language} />}
      </div>,
    },
  ]} selectedTab={selectedTab} setSelectedTab={setSelectedTab}/>;
};

function formatStatus(status: number): string {
  if (status >= 200 && status < 400)
    return 'status-success';
  if (status >= 400)
    return 'status-failure';
  return '';
}

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

function mimeTypeToHighlighter(mimeType: string): Language | undefined {
  if (mimeType.includes('javascript') || mimeType.includes('json'))
    return 'javascript';
  if (mimeType.includes('html'))
    return 'html';
  if (mimeType.includes('css'))
    return 'css';
}
