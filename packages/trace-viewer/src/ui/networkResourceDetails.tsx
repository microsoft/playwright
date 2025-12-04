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

import type { ResourceSnapshot, WebSocketSnapshot, WebSocketFrame } from '@trace/snapshot';
import * as React from 'react';
import './networkResourceDetails.css';
import { TabbedPane } from '@web/components/tabbedPane';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import { ToolbarButton } from '@web/components/toolbarButton';
import { generateCurlCommand, generateFetchCall } from '../third_party/devtools';
import { CopyToClipboardTextButton } from './copyToClipboard';
import { getAPIRequestCodeGen } from './codegen';
import type { Language } from '@isomorphic/locatorGenerators';
import { msToString, useAsyncMemo, useSetting } from '@web/uiUtils';
import type { Entry } from '@trace/har';
import { useTraceModel } from './traceModelContext';
import { Expandable } from '@web/components/expandable';

type RequestBody = { text: string, mimeType?: string } | null;


export const NetworkResourceDetails: React.FunctionComponent<{
  resource: ResourceSnapshot;
  sdkLanguage: Language;
  startTimeOffset: number;
  onClose: () => void;
}> = ({ resource, sdkLanguage, startTimeOffset, onClose }) => {
  const [selectedTab, setSelectedTab] = React.useState('request');
  const model = useTraceModel();

  const requestBody = useAsyncMemo<RequestBody>(async () => {
    if (model && resource.request.postData) {
      const requestContentTypeHeader = resource.request.headers.find(q => q.name.toLowerCase() === 'content-type');
      const requestContentType = requestContentTypeHeader ? requestContentTypeHeader.value : '';
      if (resource.request.postData._sha1) {
        const response = await fetch(model.createRelativeUrl(`sha1/${resource.request.postData._sha1}`));
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

const ExpandableSection: React.FC<{
  title: string;
  showCount?: boolean,
  data?: { name: string, value: React.ReactNode }[],
  children?: React.ReactNode
  className?: string;
}> = ({ title, data, showCount, children, className }) => {
  const [expanded, setExpanded] = useSetting(`trace-viewer-network-details-${title.replaceAll(' ', '-')}`, true);
  return <Expandable
    expanded={expanded}
    setExpanded={setExpanded}
    expandOnTitleClick
    title={
      <span className='network-request-details-header'>{title}
        {showCount && <span className='network-request-details-header-count'> × {data?.length ?? 0}</span>}
      </span>
    }
    className={className}
  >
    {data && <table className='network-request-details-table'>
      <tbody>
        {data.map(({ name, value }, index) => (
          value !== null &&
          (<tr key={index}>
            <td>{name}</td>
            <td>{value}</td>
          </tr>)
        ))}
      </tbody>
    </table>}
    {children}
  </Expandable>;
};

const RequestTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
  startTimeOffset: number;
  requestBody: RequestBody,
}> = ({ resource, startTimeOffset, requestBody }) => {
  const generalData = React.useMemo(() =>
    Object.entries({
      'URL': resource.request.url,
      'Method': resource.request.method,
      'Status Code': resource.response.status !== -1 && <span className={statusClass(resource.response.status)}> {resource.response.status} {resource.response.statusText}</span>,
    }).map(([name, value]) => ({ name, value })),
  [resource]);

  const timeData = React.useMemo(() =>
    Object.entries({
      'Start': msToString(startTimeOffset),
      'Duration': msToString(resource.time),
    }).map(([name, value]) => ({ name, value })),
  [startTimeOffset, resource]);

  return <div className='vbox network-request-details-tab'>
    <ExpandableSection title='General' data={generalData}/>
    {resource.request.queryString.length > 0 && <ExpandableSection title='Query String Parameters' showCount data={resource.request.queryString}/>}
    <ExpandableSection title='Request Headers' showCount data={resource.request.headers}/>
    <ExpandableSection title='Time' data={timeData}/>
    {requestBody && <ExpandableSection title='Request Body' className='network-request-request-body'>
      <CodeMirrorWrapper text={requestBody.text} mimeType={requestBody.mimeType} readOnly lineNumbers={true}/>
    </ExpandableSection>}
  </div>;
};

const ResponseTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
}> = ({ resource }) => {
  return <div className='vbox network-request-details-tab'>
    <ExpandableSection title='Response Headers' showCount data={resource.response.headers} />
  </div>;
};

const BodyTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
}> = ({ resource }) => {
  const model = useTraceModel();
  const [responseBody, setResponseBody] = React.useState<{ dataUrl?: string, text?: string, mimeType?: string, font?: BufferSource } | null>(null);

  React.useEffect(() => {
    const readResources = async  () => {
      if (model && resource.response.content._sha1) {
        const useBase64 = resource.response.content.mimeType.includes('image');
        const isFont = resource.response.content.mimeType.includes('font');
        const response = await fetch(model.createRelativeUrl(`sha1/${resource.response.content._sha1}`));
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
  }, [resource, model]);

  return <div className='vbox network-request-details-tab'>
    {!resource.response.content._sha1 && <div>Response body is not available for this request.</div>}
    {responseBody && responseBody.font && <FontPreview font={responseBody.font} />}
    {responseBody && responseBody.dataUrl && <div><img draggable='false' src={responseBody.dataUrl} /></div>}
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

// WebSocket Details Component
export const WebSocketDetails: React.FunctionComponent<{
  websocket: WebSocketSnapshot;
  startTimeOffset: number;
  onClose: () => void;
}> = ({ websocket, startTimeOffset, onClose }) => {
  const [selectedTab, setSelectedTab] = React.useState('info');

  return <TabbedPane
    dataTestId='websocket-details'
    leftToolbar={[<ToolbarButton key='close' icon='close' title='Close' onClick={onClose} />]}
    tabs={[
      {
        id: 'info',
        title: 'Info',
        render: () => <WebSocketInfoTab websocket={websocket} startTimeOffset={startTimeOffset} />,
      },
      {
        id: 'frames',
        title: `Frames (${websocket.frames.length})`,
        render: () => <WebSocketFramesTab websocket={websocket} />,
      },
    ]}
    selectedTab={selectedTab}
    setSelectedTab={setSelectedTab} />;
};

const WebSocketInfoTab: React.FunctionComponent<{
  websocket: WebSocketSnapshot;
  startTimeOffset: number;
}> = ({ websocket, startTimeOffset }) => {
  const duration = websocket.closedTimestamp ? websocket.closedTimestamp - websocket.createdTimestamp : 0;
  const status = websocket.error ? 'Error' : (websocket.closedTimestamp ? 'Closed' : 'Open');

  const generalData = React.useMemo(() =>
    Object.entries({
      'URL': websocket.url,
      'Status': status,
      'Protocol': 'WebSocket',
    }).map(([name, value]) => ({ name, value })),
  [websocket, status]);

  const timeData = React.useMemo(() =>
    Object.entries({
      'Start': msToString(startTimeOffset),
      'Duration': duration > 0 ? msToString(duration) : 'N/A (still open)',
    }).map(([name, value]) => ({ name, value })),
  [startTimeOffset, duration]);

  const statsData = React.useMemo(() => {
    const sentFrames = websocket.frames.filter(f => f.direction === 'sent');
    const receivedFrames = websocket.frames.filter(f => f.direction === 'received');
    const sentBytes = sentFrames.reduce((sum, f) => sum + (f.opcode === 2 ? Math.ceil(f.data.length * 3 / 4) : f.data.length), 0);
    const receivedBytes = receivedFrames.reduce((sum, f) => sum + (f.opcode === 2 ? Math.ceil(f.data.length * 3 / 4) : f.data.length), 0);

    return Object.entries({
      'Total Frames': String(websocket.frames.length),
      'Frames Sent': String(sentFrames.length),
      'Frames Received': String(receivedFrames.length),
      'Bytes Sent': `${sentBytes} bytes`,
      'Bytes Received': `${receivedBytes} bytes`,
    }).map(([name, value]) => ({ name, value }));
  }, [websocket]);

  return <div className='vbox network-request-details-tab'>
    <ExpandableSection title='General' data={generalData}/>
    <ExpandableSection title='Time' data={timeData}/>
    <ExpandableSection title='Statistics' data={statsData}/>
    {websocket.error && <ExpandableSection title='Error'>
      <div className='network-request-error'>{websocket.error}</div>
    </ExpandableSection>}
  </div>;
};

const WebSocketFramesTab: React.FunctionComponent<{
  websocket: WebSocketSnapshot;
}> = ({ websocket }) => {
  const [selectedFrame, setSelectedFrame] = React.useState<WebSocketFrame | undefined>(undefined);

  if (websocket.frames.length === 0)
    return <div className='network-request-details-tab'>No frames recorded</div>;

  return <div className='vbox network-request-details-tab websocket-frames-tab'>
    <div className='websocket-frames-list'>
      <table className='websocket-frames-table'>
        <thead>
          <tr>
            <th>Direction</th>
            <th>Type</th>
            <th>Time</th>
            <th>Size</th>
            <th>Preview</th>
          </tr>
        </thead>
        <tbody>
          {websocket.frames.map((frame, index) => {
            const isText = frame.opcode === 1;
            const size = isText ? frame.data.length : Math.ceil(frame.data.length * 3 / 4);
            const preview = isText ? frame.data.substring(0, 100) : `[Binary: ${size} bytes]`;
            const relativeTime = frame.timestamp - websocket.createdTimestamp;

            return (
              <tr
                key={index}
                className={`websocket-frame-row ${frame.direction} ${selectedFrame === frame ? 'selected' : ''}`}
                onClick={() => setSelectedFrame(frame)}
              >
                <td className='websocket-frame-direction'>
                  <span className={`codicon codicon-arrow-${frame.direction === 'sent' ? 'up' : 'down'}`} />
                  {frame.direction === 'sent' ? 'Sent' : 'Received'}
                </td>
                <td>{isText ? 'Text' : 'Binary'}</td>
                <td>{msToString(relativeTime)}</td>
                <td>{size} B</td>
                <td className='websocket-frame-preview'>{preview}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {selectedFrame && <div className='websocket-frame-detail'>
      <ExpandableSection title={`Frame Data (${selectedFrame.direction === 'sent' ? 'Sent' : 'Received'})`}>
        <CodeMirrorWrapper
          text={formatWebSocketFrameData(selectedFrame)}
          mimeType={selectedFrame.opcode === 1 ? 'application/json' : 'text/plain'}
          readOnly
          lineNumbers={true}
        />
      </ExpandableSection>
    </div>}
  </div>;
};

function formatWebSocketFrameData(frame: WebSocketFrame): string {
  if (frame.opcode === 2) {
    // Binary data - show as base64
    return `[Binary data - base64 encoded]\n${frame.data}`;
  }

  // Try to parse as JSON for pretty formatting
  try {
    const parsed = JSON.parse(frame.data);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return frame.data;
  }
}
