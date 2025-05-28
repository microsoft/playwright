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
import * as React from 'react';
import './networkResourceDetails.css';
import { TabbedPane } from '@web/components/tabbedPane';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import { ToolbarButton } from '@web/components/toolbarButton';
import { generateCurlCommand, generateFetchCall } from '../third_party/devtools';
import { CopyToClipboardTextButton } from './copyToClipboard';
import { getAPIRequestCodeGen } from './codegen';
import type { Language } from '@isomorphic/locatorGenerators';
import { msToString, useAsyncMemo } from '@web/uiUtils';
import type { Entry } from '@trace/har';

type RequestBody = { text: string, mimeType?: string } | null;


export const NetworkResourceDetails: React.FunctionComponent<{
  resource: ResourceSnapshot;
  sdkLanguage: Language;
  startTimeOffset: number;
  onClose: () => void;
}> = ({ resource, sdkLanguage, startTimeOffset, onClose }) => {
  const [selectedTab, setSelectedTab] = React.useState('request');

  const requestBody = useAsyncMemo<RequestBody>(async () => {
    if (resource.request.postData) {
      const requestContentTypeHeader = resource.request.headers.find(q => q.name.toLowerCase() === 'content-type');
      const requestContentType = requestContentTypeHeader ? requestContentTypeHeader.value : '';
      if (resource.request.postData._sha1) {
        const response = await fetch(`sha1/${resource.request.postData._sha1}`);
        return { text: formatBody(await response.text(), requestContentType), mimeType: requestContentType };
      } else {
        return { text: formatBody(resource.request.postData.text, requestContentType), mimeType: requestContentType };
      }
    } else {
      return null;
    }
  }, [resource], null);

  return <TabbedPane
    dataTestId='network-request-details'
    leftToolbar={[<ToolbarButton key='close' icon='close' title='Close' onClick={onClose} />]}
    rightToolbar={[<CopyDropdown key='dropdown' requestBody={requestBody} resource={resource} sdkLanguage={sdkLanguage} />]}
    tabs={[
      {
        id: 'request',
        title: 'Request',
        render: () => <RequestTab resource={resource} startTimeOffset={startTimeOffset} requestBody={requestBody} />,
      },
      {
        id: 'response',
        title: 'Response',
        render: () => <ResponseTab resource={resource}/>,
      },
      {
        id: 'body',
        title: 'Body',
        render: () => <BodyTab resource={resource}/>,
      },
    ]}
    selectedTab={selectedTab}
    setSelectedTab={setSelectedTab} />;
};


const CopyDropdown: React.FC<{
  resource: Entry,
  sdkLanguage: Language,
  requestBody: RequestBody,
}> = ({ resource, sdkLanguage, requestBody }) => {
  const copiedDescription = <><span className='codicon codicon-check' style={{ marginRight: '5px' }} /> Copied </>;
  const copyAsPlaywright = async () => getAPIRequestCodeGen(sdkLanguage).generatePlaywrightRequestCall(resource.request, requestBody?.text);
  return (
    <div className='copy-request-dropdown'>
      <ToolbarButton className='copy-request-dropdown-toggle'>
        <span className='codicon codicon-copy' style={{ marginRight: '5px' }}/>
        Copy request
        <span className='codicon codicon-chevron-down' style={{ marginLeft: '5px' }}/>
      </ToolbarButton>

      <div className='copy-request-dropdown-menu'>
        <CopyToClipboardTextButton description='Copy as cURL' copiedDescription={copiedDescription} value={() => generateCurlCommand(resource)}/>
        <CopyToClipboardTextButton description='Copy as Fetch' copiedDescription={copiedDescription} value={() => generateFetchCall(resource)}/>
        <CopyToClipboardTextButton description='Copy as Playwright' copiedDescription={copiedDescription} value={copyAsPlaywright}/>
      </div>
    </div>
  );
};

const RequestTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
  startTimeOffset: number;
  requestBody: RequestBody,
}> = ({ resource, startTimeOffset, requestBody }) => {
  return <div className='network-request-details-tab'>
    <div className='network-request-details-header'>General</div>
    <div className='network-request-details-url'>{`URL: ${resource.request.url}`}</div>
    <div className='network-request-details-general'>{`Method: ${resource.request.method}`}</div>
    {resource.response.status !== -1 && <div className='network-request-details-general' style={{ display: 'flex' }}>
      Status Code: <span className={statusClass(resource.response.status)} style={{ display: 'inline-flex' }}>
        {`${resource.response.status} ${resource.response.statusText}`}
      </span></div>}
    {resource.request.queryString.length ? <>
      <div className='network-request-details-header'>Query String Parameters</div>
      <div className='network-request-details-headers'>
        {resource.request.queryString.map(param => `${param.name}: ${param.value}`).join('\n')}
      </div>
    </> : null}
    <div className='network-request-details-header'>Request Headers</div>
    <div className='network-request-details-headers'>{resource.request.headers.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
    <div className='network-request-details-header'>Time</div>
    <div className='network-request-details-general'>{`Start: ${msToString(startTimeOffset)}`}</div>
    <div className='network-request-details-general'>{`Duration: ${msToString(resource.time)}`}</div>

    {requestBody && <div className='network-request-details-header'>Request Body</div>}
    {requestBody && <CodeMirrorWrapper text={requestBody.text} mimeType={requestBody.mimeType} readOnly lineNumbers={true}/>}
  </div>;
};

const ResponseTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
}> = ({ resource }) => {
  return <div className='network-request-details-tab'>
    <div className='network-request-details-header'>Response Headers</div>
    <div className='network-request-details-headers'>{resource.response.headers.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
  </div>;
};

const BodyTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
}> = ({ resource }) => {
  const [responseBody, setResponseBody] = React.useState<{ dataUrl?: string, text?: string, mimeType?: string, font?: BufferSource } | null>(null);

  React.useEffect(() => {
    const readResources = async  () => {
      if (resource.response.content._sha1) {
        const useBase64 = resource.response.content.mimeType.includes('image');
        const isFont = resource.response.content.mimeType.includes('font');
        const response = await fetch(`sha1/${resource.response.content._sha1}`);
        if (useBase64) {
          const blob = await response.blob();
          const reader = new FileReader();
          const eventPromise = new Promise<any>(f => reader.onload = f);
          reader.readAsDataURL(blob);
          setResponseBody({ dataUrl: (await eventPromise).target.result });
        } else if (isFont) {
          const font = await response.arrayBuffer();
          setResponseBody({ font });
        } else {
          const formattedBody = formatBody(await response.text(), resource.response.content.mimeType);
          setResponseBody({ text: formattedBody, mimeType: resource.response.content.mimeType });
        }
      } else {
        setResponseBody(null);
      }
    };

    readResources();
  }, [resource]);

  return <div className='network-request-details-tab'>
    {!resource.response.content._sha1 && <div>Response body is not available for this request.</div>}
    {responseBody && responseBody.font && <FontPreview font={responseBody.font} />}
    {responseBody && responseBody.dataUrl && <img draggable='false' src={responseBody.dataUrl} />}
    {responseBody && responseBody.text && <CodeMirrorWrapper text={responseBody.text} mimeType={responseBody.mimeType} readOnly lineNumbers={true}/>}
  </div>;
};

const FontPreview: React.FunctionComponent<{
  font: BufferSource;
}> = ({ font }) => {
  const [isError, setIsError] = React.useState(false);

  React.useEffect(() => {
    let fontFace: FontFace;
    try {
      // note: constant font family name will lead to bugs
      // when displaying two font previews.
      fontFace = new FontFace('font-preview', font);
      if (fontFace.status === 'loaded')
        document.fonts.add(fontFace);
      if (fontFace.status === 'error')
        setIsError(true);
    } catch {
      setIsError(true);
    }

    return () => {
      document.fonts.delete(fontFace);
    };
  }, [font]);

  if (isError)
    return <div className='network-font-preview-error'>Could not load font preview</div>;

  return <div className='network-font-preview'>
    ABCDEFGHIJKLM<br />
    NOPQRSTUVWXYZ<br />
    abcdefghijklm<br />
    nopqrstuvwxyz<br />
    1234567890
  </div>;
};

function statusClass(statusCode: number): string {
  if (statusCode < 300 || statusCode === 304)
    return 'green-circle';
  if (statusCode < 400)
    return 'yellow-circle';
  return 'red-circle';
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
