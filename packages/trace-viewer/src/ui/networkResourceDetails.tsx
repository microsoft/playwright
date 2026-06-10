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
import { isJsonMimeType, isXmlMimeType } from '@isomorphic/mimeType';
import { useAsyncMemo, useSetting } from '@web/uiUtils';
import { bytesToString, msToString } from '@isomorphic/formatUtils';
import type { Entry, WebSocketMessage } from '@trace/har';
import { useTraceModel } from './traceModelContext';
import { Expandable } from '@web/components/expandable';
import { ListView } from '@web/components/listView';
import { SplitView } from '@web/components/splitView';
import { Toolbar } from '@web/components/toolbar';
import { PlaceholderPanel } from './placeholderPanel';

type RequestBody = { text: string, mimeType?: string } | null;
type ResponseBody = { dataUrl?: string, text?: string, mimeType?: string, font?: BufferSource } | null;
type FormattableBody = { text?: string, mimeType?: string } | null;
type IndexedWebSocketMessage = WebSocketMessage & { index: number, byteLength: number };


export const NetworkResourceDetails: React.FunctionComponent<{
  resource: ResourceSnapshot;
  sdkLanguage: Language;
  startTimeOffset: number;
  onClose: () => void;
}> = ({ resource, sdkLanguage, startTimeOffset, onClose }) => {
  const [selectedTab, setSelectedTab] = React.useState('headers');
  const model = useTraceModel();

  const requestBody = useAsyncMemo<RequestBody>(async () => {
    if (model && resource.request.postData) {
      const requestContentTypeHeader = resource.request.headers.find(q => q.name.toLowerCase() === 'content-type');
      const requestContentType = requestContentTypeHeader ? requestContentTypeHeader.value : '';
      if (resource.request.postData._sha1) {
        const response = await fetch(model.createRelativeUrl(`sha1/${resource.request.postData._sha1}`));
        return { text: await response.text(), mimeType: requestContentType };
      } else {
        return { text: resource.request.postData.text, mimeType: requestContentType };
      }
    } else {
      return null;
    }
  }, [resource], null);

  return <TabbedPane
    leftToolbar={[<ToolbarButton key='close' icon='close' title='Close' onClick={onClose} />]}
    rightToolbar={[<CopyDropdown key='dropdown' requestBody={requestBody} resource={resource} sdkLanguage={sdkLanguage} />]}
    tabs={[
      {
        id: 'headers',
        title: 'Headers',
        render: () => <HeadersTab resource={resource} startTimeOffset={startTimeOffset} />,
      },
      {
        id: 'payload',
        title: 'Payload',
        render: () => <PayloadTab resource={resource} requestBody={requestBody} />,
      },
      {
        id: 'response',
        title: 'Response',
        render: () => <ResponseTab resource={resource} />,
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
  const model = useTraceModel();
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
        <CopyToClipboardTextButton description='Copy as cURL' copiedDescription={copiedDescription} value={() => generateCurlCommand(model, resource)}/>
        <CopyToClipboardTextButton description='Copy as Fetch' copiedDescription={copiedDescription} value={() => generateFetchCall(model, resource)}/>
        <CopyToClipboardTextButton description='Copy as Playwright' copiedDescription={copiedDescription} value={copyAsPlaywright}/>
      </div>
    </div>
  );
};

const FormatToggleButton: React.FC<{
  toggled: boolean;
  error?: boolean;
  onToggle: () => void;
}> = ({ toggled, error, onToggle }) => {
  return <ToolbarButton icon='json' title='Pretty print' toggled={toggled} errorBadge={error ? 'Formatting failed' : undefined} onClick={e => {
    e.stopPropagation();
    onToggle();
  }}/>;
};

const ExpandableSection: React.FC<{
  title: string;
  showCount?: boolean,
  data?: { name: string, value: React.ReactNode }[],
  children?: React.ReactNode
  titleChildren?: React.ReactNode;
  className?: string;
}> = ({ title, data, showCount, children, titleChildren, className }) => {
  const [expanded, setExpanded] = useSetting(`trace-viewer-network-details-${title.replaceAll(' ', '-')}`, true);
  return <Expandable
    expanded={expanded}
    setExpanded={setExpanded}
    expandOnTitleClick
    title={
      <>
        <span className='network-request-details-header'>{title}
          {showCount && <span className='network-request-details-header-count'> × {data?.length ?? 0}</span>}
        </span>
        { titleChildren }
      </>
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

const HeadersTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
  startTimeOffset: number;
}> = ({ resource, startTimeOffset }) => {
  const generalData = React.useMemo(() =>
    Object.entries({
      'URL': resource.request.url,
      'Method': resource.request.method,
      'Status Code': resource.response.status === -1 ? 'canceled' : resource.response.status > 0 && <span className={statusClass(resource.response.status)}> {resource.response.status} {resource.response.statusText}</span>,
      'Start': msToString(startTimeOffset),
      'Duration': msToString(resource.time),
    }).map(([name, value]) => ({ name, value })),
  [resource, startTimeOffset]);

  return <div className='vbox network-request-details-tab'>
    <ExpandableSection title='General' data={generalData} />
    <ExpandableSection title='Request Headers' showCount data={resource.request.headers} />
    <ExpandableSection title='Response Headers' showCount data={resource.response.headers} />
  </div>;
};

const PayloadTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
  requestBody: RequestBody,
}> = ({ resource, requestBody }) => {
  const [showFormatted, setShowFormatted] = useSetting('trace-viewer-network-details-show-formatted-payload', true);
  const hasQueryString = resource.request.queryString.length > 0;
  const hasRequestBody = !!(requestBody || resource.request.postData);
  const formatResult = useFormattedBody(requestBody, showFormatted);

  return <div className='vbox network-request-details-tab'>
    {!hasQueryString && !hasRequestBody && <em className='network-request-no-payload'>No payload for this request.</em>}
    {hasQueryString && <ExpandableSection title='Query String Parameters' showCount data={resource.request.queryString}/>}
    {requestBody && <ExpandableSection title='Request Body' className='network-request-request-body' titleChildren={
      <>
        <div style={{ margin: 'auto' }}></div>
        <FormatToggleButton toggled={showFormatted} error={formatResult.error} onToggle={() => setShowFormatted(!showFormatted)} />
      </>
    }>
      <CodeMirrorWrapper text={formatResult.text} mimeType={requestBody.mimeType} readOnly lineNumbers={true}/>
    </ExpandableSection>}
  </div>;
};

const ResponseTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
}> = ({ resource }) => {
  const model = useTraceModel();
  const [responseBody, setResponseBody] = React.useState<ResponseBody>(null);

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
          setResponseBody({ text: await response.text(), mimeType: resource.response.content.mimeType });
        }
      } else {
        setResponseBody(null);
      }
    };

    readResources();
  }, [resource, model]);

  const [showFormattedResponse, setShowFormattedResponse] = useSetting('trace-viewer-network-details-show-formatted-response', true);
  const formatResult = useFormattedBody(responseBody, showFormattedResponse);

  return <div className='vbox network-request-details-tab'>
    {!resource.response.content._sha1 && <div>Response body is not available for this request.</div>}
    {responseBody && responseBody.font && <FontPreview font={responseBody.font} />}
    {responseBody && responseBody.dataUrl && <div><img draggable='false' src={responseBody.dataUrl} /></div>}
    {responseBody && responseBody.text !== undefined && <div className='vbox network-response-body'>
      <CodeMirrorWrapper text={formatResult.text} mimeType={responseBody.mimeType} readOnly lineNumbers={true}/>
      <Toolbar noShadow={true} noMinHeight={true} className='network-response-toolbar'>
        <div style={{ margin: 'auto' }}></div>
        <FormatToggleButton toggled={showFormattedResponse} error={formatResult.error} onToggle={() => setShowFormattedResponse(!showFormattedResponse)} />
      </Toolbar>
    </div>}
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

export const WebSocketResourceDetails: React.FunctionComponent<{
  resource: ResourceSnapshot;
  startTimeOffset: number;
  onClose: () => void;
}> = ({ resource, startTimeOffset, onClose }) => {
  const [selectedTab, setSelectedTab] = React.useState<string>('messages');

  return <TabbedPane
    leftToolbar={[<ToolbarButton key='close' icon='close' title='Close' onClick={onClose} />]}
    tabs={[
      {
        id: 'headers',
        title: 'Headers',
        render: () => <HeadersTab resource={resource} startTimeOffset={startTimeOffset} />,
      },
      {
        id: 'messages',
        title: 'Messages',
        render: () => <WebSocketMessagesTab resource={resource} />,
      },
    ]}
    selectedTab={selectedTab}
    setSelectedTab={setSelectedTab} />;
};

const WebSocketMessagesTab: React.FunctionComponent<{
  resource: ResourceSnapshot;
}> = ({ resource }) => {
  const model = useTraceModel();

  const indexedMessages = useAsyncMemo<IndexedWebSocketMessage[] | undefined>(async () => {
    if (resource._webSocketMessages)
      return resource._webSocketMessages.map((m, index) => ({ ...m, index, byteLength: messageByteLength(m) }));
    if (model && resource.response.content._sha1) {
      try {
        const response = await fetch(model.createRelativeUrl(`sha1/${resource.response.content._sha1}`));
        if (!response.ok)
          return [];
        const text = await response.text();
        const messages = text.split('\n').filter(Boolean).map(line => JSON.parse(line) as WebSocketMessage);
        return messages.map((m, index) => ({ ...m, index, byteLength: messageByteLength(m) }));
      } catch {
        return [];
      }
    }
    return [];
  }, [resource, model], undefined);

  const [selectedIndex, setSelectedIndex] = React.useState<number | undefined>(undefined);
  const selectedMessage = selectedIndex !== undefined ? indexedMessages?.[selectedIndex] : undefined;
  const baseTimeMs = React.useMemo(() => {
    if (!indexedMessages)
      return undefined;
    for (const f of indexedMessages) {
      if (f.time > 0)
        return f.time;
    }
    return undefined;
  }, [indexedMessages]);

  if (indexedMessages === undefined)
    return <PlaceholderPanel text='Loading...' />;

  if (indexedMessages.length === 0)
    return <PlaceholderPanel text='No messages captured' />;

  const list = <WebSocketMessagesListView
    name='network-websocket-messages'
    ariaLabel='WebSocket messages'
    items={indexedMessages}
    id={indexedMessage => String(indexedMessage.index)}
    selectedItem={selectedMessage}
    onSelected={indexedMessage => setSelectedIndex(indexedMessage.index)}
    render={indexedMessage => renderMessageRow(indexedMessage, baseTimeMs)}
  />;

  if (!selectedMessage)
    return list;

  return <SplitView
    sidebarSize={200}
    orientation='vertical'
    sidebarIsFirst={false}
    settingName='networkWebSocketMessageDetails'
    main={list}
    sidebar={<WebSocketMessageDetail message={selectedMessage} />}
  />;
};

const WebSocketMessagesListView = ListView<IndexedWebSocketMessage>;

const WebSocketMessageDetail: React.FunctionComponent<{
  message: WebSocketMessage,
}> = ({ message }) => {
  const [showFormattedMessage, setShowFormattedMessage] = useSetting('trace-viewer-network-details-show-formatted-message', true);
  const messageBody = React.useMemo(() => {
    if (message.opcode === 1) {
      const text = message.data;
      let mimeType: string | undefined;
      try {
        JSON.parse(text);
        mimeType = 'application/json';
      } catch {
        mimeType = 'text/plain';
      }
      return { text, mimeType };
    }
    if (message.opcode === 8 || message.opcode === 9 || message.opcode === 10) {
      if (!message.data)
        return { text: '' };
      // Control messages may carry a small payload as base64.
      try {
        const text = decodeBase64ToText(message.data);
        return { text, mimeType: 'text/plain' };
      } catch {
        return { text: dumpHex(message.data) };
      }
    }
    return { text: dumpHex(message.data) };
  }, [message]);
  const formatResult = useFormattedBody(messageBody, showFormattedMessage);

  return <div className='vbox network-websocket-message-detail'>
    <Toolbar noShadow={true} noMinHeight={true} className='network-websocket-message-detail-toolbar'>
      <span className='network-websocket-message-detail-summary'>
        {message.type === 'send' ? 'Sent' : 'Received'} · {opcodeName(message.opcode)} · {bytesToString(messageByteLength(message))}
      </span>
      <div style={{ margin: 'auto' }}></div>
      <FormatToggleButton toggled={showFormattedMessage} error={formatResult.error} onToggle={() => setShowFormattedMessage(!showFormattedMessage)} />
    </Toolbar>
    <div className='vbox network-websocket-message-detail-body'>
      <CodeMirrorWrapper text={formatResult.text} mimeType={messageBody.mimeType} readOnly lineNumbers={true} />
    </div>
  </div>;
};

function renderMessageRow(message: IndexedWebSocketMessage, baseTimeMs: number | undefined): React.ReactNode {
  const directionIcon = message.type === 'send' ? 'codicon-arrow-up' : 'codicon-arrow-down';
  const directionLabel = message.type === 'send' ? 'Sent' : 'Received';
  const opcodeLabel = opcodeName(message.opcode);
  const relativeTime = (message.time > 0 && baseTimeMs !== undefined) ? msToString(message.time - baseTimeMs) : '-';
  const preview = messagePreview(message);

  return <div className='network-websocket-message-row'>
    <span className={`network-websocket-message-direction-${message.type} codicon ${directionIcon}`} title={directionLabel} />
    <span className='network-websocket-message-preview' title={preview}>{preview}</span>
    <span className='network-websocket-message-opcode' title={`Opcode ${message.opcode}`}>{opcodeLabel}</span>
    <span className='network-websocket-message-length' title={`${message.byteLength} bytes`}>{bytesToString(message.byteLength)}</span>
    <span className='network-websocket-message-time'>{relativeTime}</span>
  </div>;
}

function opcodeName(opcode: number): string {
  switch (opcode) {
    case 0: return 'Continuation';
    case 1: return 'Text';
    case 2: return 'Binary';
    case 8: return 'Close';
    case 9: return 'Ping';
    case 10: return 'Pong';
    default: return `Opcode ${opcode}`;
  }
}

function messageByteLength(message: WebSocketMessage): number {
  return (message.opcode === 1) ? (new TextEncoder()).encode(message.data).length : base64ByteLength(message.data);
}

function messagePreview(message: WebSocketMessage): string {
  if (message.opcode === 1) {
    const trimmed = message.data.replace(/\s+/g, ' ');
    return trimmed.length > 200 ? trimmed.substring(0, 200) + '…' : trimmed;
  }
  if (message.opcode === 8)
    return '(close)';
  if (message.opcode === 9)
    return '(ping)';
  if (message.opcode === 10)
    return '(pong)';
  return `(binary, ${bytesToString(base64ByteLength(message.data))})`;
}

function statusClass(statusCode: number): string {
  if (statusCode < 300 || statusCode === 304)
    return 'green-circle';
  if (statusCode < 400)
    return 'yellow-circle';
  return 'red-circle';
}

const kInlineTagPattern = /<[^>]+>[^<]*<\//;

function formatXml(xml: string, indent = '  ') {
  let depth = 0;
  const lines: string[] = [];
  const tokens = xml.replace(/>\s*</g, '>\n<').split('\n');

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed)
      continue;

    if (trimmed.startsWith('</')) {
      depth = Math.max(depth - 1, 0);
      lines.push(indent.repeat(depth) + trimmed);
    } else if (trimmed.endsWith('/>') || trimmed.startsWith('<?') || kInlineTagPattern.test(trimmed)) {
      lines.push(indent.repeat(depth) + trimmed);
    } else if (trimmed.startsWith('<')) {
      lines.push(indent.repeat(depth) + trimmed);
      depth++;
    } else {
      lines.push(indent.repeat(depth) + trimmed);
    }
  }

  return lines.join('\n');
}

function formatBody(body: string, contentType?: string): string {
  if (!body.trim() || !contentType)
    return body;

  if (isJsonMimeType(contentType))
    return JSON.stringify(JSON.parse(body), null, 2);

  if (isXmlMimeType(contentType))
    return formatXml(body);

  if (contentType.includes('application/x-www-form-urlencoded'))
    return decodeURIComponent(body);

  return body;
}

const useFormattedBody = (body: FormattableBody, showFormatted: boolean) => {
  return React.useMemo(() => {
    if (body?.text === undefined)
      return { text: '' };

    if (!showFormatted)
      return { text: body.text };

    try {
      return { text: formatBody(body.text, body.mimeType) };
    } catch {
      return { text: body.text, error: true };
    }
  }, [body, showFormatted]);
};

function base64ByteLength(data: string): number {
  if (!data)
    return 0;
  const padding = (data[data.length - 2] === '=') ? 2 : ((data[data.length - 1] === '=') ? 1 : 0);
  return Math.max(0, Math.floor(data.length * 3 / 4) - padding);
}

function decodeBase64ToText(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; ++i)
    bytes[i] = binary.charCodeAt(i);
  return (new TextDecoder('utf-8', { fatal: false })).decode(bytes);
}

function dumpHex(base64: string): string {
  if (!base64)
    return '';
  const binary = atob(base64);
  const lines: string[] = [];
  for (let offset = 0; offset < binary.length; offset += 16) {
    const chunkLength = Math.min(16, binary.length - offset);
    const hex: string[] = [];
    const ascii: string[] = [];
    for (let i = 0; i < 16; ++i) {
      if (i < chunkLength) {
        const code = binary.charCodeAt(offset + i);
        hex.push(code.toString(16).padStart(2, '0'));
        ascii.push((code >= 0x20 && code < 0x7f) ? binary[offset + i] : '.');
      } else {
        hex.push('  ');
      }
      if (i === 7)
        hex.push('');
    }
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.join(' ')}  ${ascii.join('')}`);
  }
  return lines.join('\n');
}
