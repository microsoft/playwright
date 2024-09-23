/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type WebSocketMessage = string | ArrayBufferLike | Blob | ArrayBufferView;
export type WSData = { data: string, isBase64: boolean };

export type OnCreatePayload = { type: 'onCreate', id: string, url: string };
export type OnMessageFromPagePayload = { type: 'onMessageFromPage', id: string, data: WSData };
export type OnClosePayload = { type: 'onClose', id: string, code: number | undefined, reason: string | undefined, wasClean: boolean };
export type OnMessageFromServerPayload = { type: 'onMessageFromServer', id: string, data: WSData };
export type BindingPayload = OnCreatePayload | OnMessageFromPagePayload | OnMessageFromServerPayload | OnClosePayload;

export type ConnectRequest = { type: 'connect', id: string };
export type PassthroughRequest = { type: 'passthrough', id: string };
export type EnsureOpenedRequest = { type: 'ensureOpened', id: string };
export type SendToPageRequest = { type: 'sendToPage', id: string, data: WSData };
export type SendToServerRequest = { type: 'sendToServer', id: string, data: WSData };
export type CloseRequest = { type: 'close', id: string, code: number | undefined, reason: string | undefined, wasClean: boolean };
export type APIRequest = ConnectRequest | PassthroughRequest | EnsureOpenedRequest | SendToPageRequest | SendToServerRequest | CloseRequest;

// eslint-disable-next-line no-restricted-globals
type GlobalThis = typeof globalThis;

export function inject(globalThis: GlobalThis) {
  if ((globalThis as any).__pwWebSocketDispatch)
    return;

  function generateId() {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const hex = '0123456789abcdef';
    return [...bytes].map(value => {
      const high = Math.floor(value / 16);
      const low = value % 16;
      return hex[high] + hex[low];
    }).join('');
  }

  function bufferToData(b: Uint8Array): WSData {
    let s = '';
    for (let i = 0; i < b.length; i++)
      s += String.fromCharCode(b[i]);
    return { data: globalThis.btoa(s), isBase64: true };
  }

  function stringToBuffer(s: string): ArrayBuffer {
    s = globalThis.atob(s);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++)
      b[i] = s.charCodeAt(i);
    return b.buffer;
  }

  // Note: this function tries to be synchronous when it can to preserve the ability to send
  // multiple messages synchronously in the same order and then synchronously close.
  function messageToData(message: WebSocketMessage, cb: (data: WSData) => any) {
    if (message instanceof globalThis.Blob)
      return message.arrayBuffer().then(buffer => cb(bufferToData(new Uint8Array(buffer))));
    if (typeof message === 'string')
      return cb({ data: message, isBase64: false });
    if (ArrayBuffer.isView(message))
      return cb(bufferToData(new Uint8Array(message.buffer, message.byteOffset, message.byteLength)));
    return cb(bufferToData(new Uint8Array(message)));
  }

  function dataToMessage(data: WSData, binaryType: 'blob' | 'arraybuffer'): WebSocketMessage {
    if (!data.isBase64)
      return data.data;
    const buffer = stringToBuffer(data.data);
    return binaryType === 'arraybuffer' ? buffer : new Blob([buffer]);
  }

  const binding = (globalThis as any).__pwWebSocketBinding as (message: BindingPayload) => void;
  const NativeWebSocket: typeof WebSocket = globalThis.WebSocket;
  const idToWebSocket = new Map<string, WebSocketMock>();
  (globalThis as any).__pwWebSocketDispatch = (request: APIRequest) => {
    const ws = idToWebSocket.get(request.id);
    if (!ws)
      return;
    if (request.type === 'connect')
      ws._apiConnect();
    if (request.type === 'passthrough')
      ws._apiPassThrough();
    if (request.type === 'ensureOpened')
      ws._apiEnsureOpened();
    if (request.type === 'sendToPage')
      ws._apiSendToPage(dataToMessage(request.data, ws.binaryType));
    if (request.type === 'close')
      ws._apiClose(request.code, request.reason, request.wasClean);
    if (request.type === 'sendToServer')
      ws._apiSendToServer(dataToMessage(request.data, ws.binaryType));
  };

  class WebSocketMock extends EventTarget {
    static readonly CONNECTING: 0 = 0; // WebSocket.CONNECTING
    static readonly OPEN: 1 = 1; // WebSocket.OPEN
    static readonly CLOSING: 2 = 2; // WebSocket.CLOSING
    static readonly CLOSED: 3 = 3; // WebSocket.CLOSED

    CONNECTING: 0 = 0; // WebSocket.CONNECTING
    OPEN: 1 = 1; // WebSocket.OPEN
    CLOSING: 2 = 2; // WebSocket.CLOSING
    CLOSED: 3 = 3; // WebSocket.CLOSED

    private _oncloseListener: WebSocket['onclose'] = null;
    private _onerrorListener: WebSocket['onerror'] = null;
    private _onmessageListener: WebSocket['onmessage'] = null;
    private _onopenListener: WebSocket['onopen'] = null;

    bufferedAmount: number = 0;
    extensions: string = '';
    protocol: string = '';
    readyState: number = 0;
    readonly url: string;

    private _id: string;
    private _origin: string = '';
    private _protocols?: string | string[];
    private _ws?: WebSocket;
    private _passthrough = false;
    private _wsBufferedMessages: WebSocketMessage[] = [];
    private _binaryType: BinaryType = 'blob';

    constructor(url: string | URL, protocols?: string | string[]) {
      super();

      this.url = typeof url === 'string' ? url : url.href;
      try {
        this._origin = new URL(url).origin;
      } catch {
      }
      this._protocols = protocols;

      this._id = generateId();
      idToWebSocket.set(this._id, this);
      binding({ type: 'onCreate', id: this._id, url: this.url });
    }

    // --- native WebSocket implementation ---

    get binaryType() {
      return this._binaryType;
    }

    set binaryType(type) {
      this._binaryType = type;
      if (this._ws)
        this._ws.binaryType = type;
    }

    get onclose() {
      return this._oncloseListener;
    }

    set onclose(listener) {
      if (this._oncloseListener)
        this.removeEventListener('close', this._oncloseListener as any);
      this._oncloseListener = listener;
      if (this._oncloseListener)
        this.addEventListener('close', this._oncloseListener as any);
    }

    get onerror() {
      return this._onerrorListener;
    }

    set onerror(listener) {
      if (this._onerrorListener)
        this.removeEventListener('error', this._onerrorListener);
      this._onerrorListener = listener;
      if (this._onerrorListener)
        this.addEventListener('error', this._onerrorListener);
    }

    get onopen() {
      return this._onopenListener;
    }

    set onopen(listener) {
      if (this._onopenListener)
        this.removeEventListener('open', this._onopenListener);
      this._onopenListener = listener;
      if (this._onopenListener)
        this.addEventListener('open', this._onopenListener);
    }

    get onmessage() {
      return this._onmessageListener;
    }

    set onmessage(listener) {
      if (this._onmessageListener)
        this.removeEventListener('message', this._onmessageListener as any);
      this._onmessageListener = listener;
      if (this._onmessageListener)
        this.addEventListener('message', this._onmessageListener as any);
    }

    send(message: WebSocketMessage): void {
      if (this.readyState === WebSocketMock.CONNECTING)
        throw new DOMException(`Failed to execute 'send' on 'WebSocket': Still in CONNECTING state.`);
      if (this.readyState !== WebSocketMock.OPEN)
        throw new DOMException(`WebSocket is already in CLOSING or CLOSED state.`);
      if (this._passthrough)
        this._apiSendToServer(message);
      else
        messageToData(message, data => binding({ type: 'onMessageFromPage', id: this._id, data }));
    }

    close(code?: number, reason?: string): void {
      if (code !== undefined && code !== 1000 && (code < 3000 || code > 4999))
        throw new DOMException(`Failed to execute 'close' on 'WebSocket': The close code must be either 1000, or between 3000 and 4999. ${code} is neither.`);
      if (this.readyState === WebSocketMock.OPEN || this.readyState === WebSocketMock.CONNECTING)
        this.readyState = WebSocketMock.CLOSING;
      if (this._ws)
        this._ws.close(code, reason);
      else
        this._onWSClose(code, reason, true);
    }

    // --- methods called from the routing API ---

    _apiEnsureOpened() {
      // This is called at the end of the route handler. If we did not connect to the server,
      // assume that websocket will be fully mocked. In this case, pretend that server
      // connection is established right away.
      if (!this._ws)
        this._ensureOpened();
    }

    _apiSendToPage(message: WebSocketMessage) {
      // Calling "sendToPage()" from the route handler. Allow this for easier testing.
      this._ensureOpened();
      if (this.readyState !== WebSocketMock.OPEN)
        throw new DOMException(`WebSocket is already in CLOSING or CLOSED state.`);
      this.dispatchEvent(new MessageEvent('message', { data: message, origin: this._origin, cancelable: true }));
    }

    _apiSendToServer(message: WebSocketMessage) {
      if (!this._ws)
        throw new Error('Cannot send a message before connecting to the server');
      if (this._ws.readyState === WebSocketMock.CONNECTING)
        this._wsBufferedMessages.push(message);
      else
        this._ws.send(message);
    }

    _apiConnect() {
      if (this._ws)
        throw new Error('Can only connect to the server once');

      this._ws = new NativeWebSocket(this.url, this._protocols);
      this._ws.binaryType = this._binaryType;

      this._ws.onopen = () => {
        for (const message of this._wsBufferedMessages)
          this._ws!.send(message);
        this._wsBufferedMessages = [];
        this._ensureOpened();
      };

      this._ws.onclose = event => {
        this._onWSClose(event.code, event.reason, event.wasClean);
      };

      this._ws.onmessage = event => {
        if (this._passthrough)
          this._apiSendToPage(event.data);
        else
          messageToData(event.data, data => binding({ type: 'onMessageFromServer', id: this._id, data }));
      };

      this._ws.onerror = () => {
        // We do not expose errors in the API, so short-curcuit the error event.
        const event = new Event('error', { cancelable: true });
        this.dispatchEvent(event);
      };
    }

    // This method connects to the server, and passes all messages through,
    // as if WebSocketMock was not engaged.
    _apiPassThrough() {
      this._passthrough = true;
      this._apiConnect();
    }

    _apiClose(code: number | undefined, reason: string | undefined, wasClean: boolean) {
      if (this.readyState !== WebSocketMock.CLOSED) {
        this.readyState = WebSocketMock.CLOSED;
        this.dispatchEvent(new CloseEvent('close', { code, reason, wasClean, cancelable: true }));
      }
      // Immediately close the real WS and imitate that it has closed.
      this._ws?.close(code, reason);
      this._cleanupWS();
      binding({ type: 'onClose', id: this._id, code, reason, wasClean });
      idToWebSocket.delete(this._id);
    }

    // --- internals ---

    _ensureOpened() {
      if (this.readyState !== WebSocketMock.CONNECTING)
        return;
      this.readyState = WebSocketMock.OPEN;
      this.dispatchEvent(new Event('open', { cancelable: true }));
    }

    private _onWSClose(code: number | undefined, reason: string | undefined, wasClean: boolean) {
      this._cleanupWS();
      if (this.readyState !== WebSocketMock.CLOSED) {
        this.readyState = WebSocketMock.CLOSED;
        this.dispatchEvent(new CloseEvent('close', { code, reason, wasClean, cancelable: true }));
      }
      binding({ type: 'onClose', id: this._id, code, reason, wasClean });
      idToWebSocket.delete(this._id);
    }

    private _cleanupWS() {
      if (!this._ws)
        return;
      this._ws.onopen = null;
      this._ws.onclose = null;
      this._ws.onmessage = null;
      this._ws.onerror = null;
      this._ws = undefined;
      this._wsBufferedMessages = [];
    }
  }
  globalThis.WebSocket = class WebSocket extends WebSocketMock {};
}
