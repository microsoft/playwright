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
import { msToString, useSetting } from '@web/uiUtils';
import type { Entry, QueryParameter } from '@trace/har';


type RequestBody = { text: string, mimeType?: string } | null;
type ResponseBody = { dataUrl?: string, text?: string, mimeType?: string, font?: BufferSource } | null;

export const NetworkResourceDetails: React.FC<{
  resource: ResourceSnapshot;
  sdkLanguage: Language;
  startTimeOffset: number;
  onClose: () => void;
}> = ({ resource, sdkLanguage, startTimeOffset, onClose }) => {
  const [selectedTab, setSelectedTab] = React.useState('headers');

  const [requestBody, setRequestBody] = React.useState<RequestBody>(null);
  const [responseBody, setResponseBody] = React.useState<ResponseBody>(null);

  React.useEffect(() => {
    const readRequest = async () => {
      if (!resource.request.postData) {
        setRequestBody(null);
        return;
      }

      const requestContentTypeHeader = resource.request.headers.find(({ name }) => name.toLowerCase() === 'content-type');
      const requestContentType = requestContentTypeHeader ? requestContentTypeHeader.value : '';
      if (resource.request.postData._sha1) {
        const response = await fetch(`sha1/${resource.request.postData._sha1}`);
        setRequestBody({ text: formatBody(await response.text(), requestContentType), mimeType: requestContentType });
      } else {
        setRequestBody({ text: formatBody(resource.request.postData.text, requestContentType), mimeType: requestContentType });
      }
    };

    const readResponse = async () => {
      if (!resource.response.content._sha1) {
        setResponseBody(null);
        return;
      }

      const mimeType = resource.response.content.mimeType;
      const useBase64 = mimeType.includes('image');
      const response = await fetch(`sha1/${resource.response.content._sha1}`);
      if (useBase64) {
        const blob = await response.blob();
        const reader = new FileReader();
        const eventPromise = new Promise<any>(f => reader.onload = f);
        reader.readAsDataURL(blob);
        setResponseBody({ dataUrl: (await eventPromise).target.result });
        return;
      }

      const isFont = mimeType.includes('font');
      if (isFont) {
        const font = await response.arrayBuffer();
        setResponseBody({ font });
      } else {
        const formattedBody = formatBody(await response.text(), mimeType);
        setResponseBody({ text: formattedBody, mimeType: mimeType });
      }
    };

    readRequest();
    readResponse();
  }, [resource]);

  return <TabbedPane
    dataTestId='network-request-details'
    leftToolbar={[<ToolbarButton key='close' icon='close' title='Close' onClick={onClose}/>]}
    rightToolbar={[<CopyDropdown key='dropdown' requestBody={requestBody} resource={resource} sdkLanguage={sdkLanguage}/>]}
    tabs={[
      {
        id: 'headers',
        title: 'Headers',
        render: () => <HeadersTab resource={resource} startTimeOffset={startTimeOffset}/>,
      },
      {
        id: 'payload',
        title: 'Payload',
        render: () => <PayloadTab queryString={resource.request.queryString} requestBody={requestBody}/>,
      },
      {
        id: 'response',
        title: 'Response',
        render: () => <ResponseTab responseBody={responseBody}/>,
      },
    ]}
    selectedTab={selectedTab}
    setSelectedTab={setSelectedTab}/>;
};

const HeadersTab: React.FC<{
  resource: ResourceSnapshot;
  startTimeOffset: number;
}> = ({ resource, startTimeOffset }) => {
  return <div className='network-request-details-tab'>
    <DetailsSection title='General' data={Object.entries({
      'URL': resource.request.url,
      'Method': resource.request.method,
      'Status Code': resource.response.status !== -1 ? <span className={statusClass(resource.response.status)}> {resource.response.status} {resource.response.statusText} </span> : null,
      'Start': msToString(startTimeOffset),
      'Duration': msToString(resource.time)
    }).map(([name, value]) => ({ name, value }))}/>

    <DetailsSection title='Request Headers' showCountWhenCollapsed data={resource.request.headers}/>

    <DetailsSection title='Response Headers' showCountWhenCollapsed data={resource.response.headers}/>
  </div>;
};


const CopyDropdown: React.FC<{
  resource: Entry,
  sdkLanguage: Language,
  requestBody: RequestBody,
}> = ({ resource, sdkLanguage, requestBody }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const copiedDescription = <><span className='codicon codicon-check' style={{ marginRight: '5px' }}/> Copied </>;

  return (
    <div className='copy-request-dropdown' onMouseLeave={() => setIsOpen(false)} onMouseEnter={() => setIsOpen(true)}>
      <ToolbarButton className='copy-request-dropdown-toggle'>
        <span className='codicon codicon-copy' style={{ marginRight: '5px' }}/>
        Copy request
        <span className='codicon codicon-chevron-down' style={{ marginLeft: '5px' }}/>
      </ToolbarButton>

      {isOpen && (
        <div className='copy-request-dropdown-menu'>
          <CopyToClipboardTextButton description='Copy as cURL' copiedDescription={copiedDescription}
            value={() => generateCurlCommand(resource)}/>
          <CopyToClipboardTextButton description='Copy as Fetch' copiedDescription={copiedDescription}
            value={() => generateFetchCall(resource)}/>
          <CopyToClipboardTextButton description='Copy as Playwright' copiedDescription={copiedDescription}
            value={async () => getAPIRequestCodeGen(sdkLanguage).generatePlaywrightRequestCall(resource.request, requestBody?.text)}/>
        </div>
      )}
    </div>
  );
};

const DetailsSection: React.FC<{
  title: string;
  data?: { name: string, value: React.ReactNode }[],
  showCountWhenCollapsed?: boolean,
  children?: React.ReactElement
}> = ({ title, data = [], showCountWhenCollapsed, children }) => {
  const [isOpen, setIsOpen] = useSetting(`trace-viewer-network-details-${title.replaceAll(' ', '-')}`, true);

  return (
    <details className='network-details' open={isOpen} aria-label={title}>
      <summary onClick={event => {
        event.preventDefault();
        setIsOpen(!isOpen);
      }}>
        {title} {!isOpen && showCountWhenCollapsed && `(${Object.keys(data).length})`}
      </summary>

      <table>
        <tbody>
          {data.map(({ name, value }, index) => (
            <tr key={index}>
              <td>{name}:</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {children}
    </details>
  );
};

const PayloadTab: React.FC<{
  queryString: QueryParameter[];
  requestBody: RequestBody,
}> = ({ queryString, requestBody }) => {
  return <div className='network-request-details-tab'>
    {!queryString.length && !requestBody && <em>No payload for this request</em>}

    {!!queryString.length && <DetailsSection title='Query String Parameters' data={queryString} showCountWhenCollapsed/>}

    {requestBody && <DetailsSection title='Request Body'>
      <CodeMirrorWrapper text={requestBody.text} mimeType={requestBody.mimeType} readOnly lineNumbers={true}/>
    </DetailsSection>}
  </div>;
};

const ResponseTab: React.FC<{
  responseBody: ResponseBody
}> = ({ responseBody }) => {
  return <div className='network-request-details-tab'>
    {!responseBody && <em>Response body is not available for this request</em>}
    {responseBody?.font && <FontPreview font={responseBody.font}/>}
    {responseBody?.dataUrl && <img draggable='false' src={responseBody.dataUrl}/>}
    {responseBody?.text &&
      <CodeMirrorWrapper text={responseBody.text} mimeType={responseBody.mimeType} readOnly lineNumbers={true}/>}
  </div>;
};

const FontPreview: React.FC<{
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
  if ((statusCode >= 100 && statusCode < 300) || statusCode === 304)
    return 'green-circle';
  if (statusCode >= 300 && statusCode < 400)
    return 'yellow-circle';
  return 'red-circle';
}

function formatBody(body: string | null, contentType: string): string {
  if (body === null)
    return 'Loading...';

  if (body === '')
    return '<Empty>';

  if (contentType.includes('application/json')) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch (err) {
      return body;
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded'))
    return decodeURIComponent(body);

  return body;
}
