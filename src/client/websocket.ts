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

import { EventEmitter } from 'events';
import { BrowserContext } from './browserContext';
import { Frame } from './frame';
import { Page } from './page';

type WSProtocols = string | string[] | undefined;
type WSCloseListener = ((this: WebSocket, ev: CloseEvent) => any) | null;
type WSErrorListener = ((this: WebSocket, ev: Event) => any) | null;
type WSMessageListener = ((this: WebSocket, ev: MessageEvent) => any) | null;
type WSOpenListener = ((this: WebSocket, ev: Event) => any) | null;

type WSData = { data: string, isBase64: boolean };
type OpenParams = { type: 'open', url: string, protocols: WSProtocols };
type OpenResult = { id: string, url: string };
type SendParams = { type: 'send', id: string, data: WSData };
type SendResult = { send: WSData } | { respond: WSData };
type ReceiveParams = { type: 'receive', id: string, data: WSData };
type ReceiveResult = { data: WSData };
type ErrorParams = { type: 'error', id: string, error: string };
type ErrorResult = {};
type CloseParams = { type: 'close', id: string, code: number, reason: string, wasClean: boolean };
type CloseResult = {};
type BindingParams = OpenParams | SendParams | ReceiveParams | ErrorParams | CloseParams;
type BindingResult = OpenResult | SendResult | ReceiveResult | ErrorResult | CloseResult;

declare global {
  interface Window {
    __pw_websocket: (params: BindingParams) => Promise<BindingResult>;
  }
}

type WebSocketSendRouter = (data: Buffer) => Promise<{ data: Buffer } | { response: Buffer }>;
type WebSocketReceiveRouter = (data: Buffer) => Promise<Buffer>;
class WebSocketInterceptor extends EventEmitter {
  _id: string;
  _url: string;
  private _protocols: WSProtocols;
  private _originalUrl: string;
  private _frame: Frame;
  _sendRouter: WebSocketSendRouter | null = null;
  _receiveRouter: WebSocketReceiveRouter | null = null;

  constructor(id: string, frame: Frame, url: string, protocols: WSProtocols) {
    super();
    this._id = id;
    this._frame = frame;
    this._url = url;
    this._originalUrl = url;
    this._protocols = protocols;
  }

  originalUrl(): string {
    return this._originalUrl;
  }

  url(): string {
    return this._url;
  }

  protocols(): WSProtocols {
    return this._protocols;
  }

  frame(): Frame {
    return this._frame;
  }

  page(): Page {
    return this._frame.page();
  }

  routeSend(router: WebSocketSendRouter | null) {
    this._sendRouter = router;
  }

  routeReceive(router: WebSocketReceiveRouter | null) {
    this._receiveRouter = router;
  }
}
type WebSocketHandler = (ws: WebSocketInterceptor) => Promise<string>;

export async function instrumentWebSockets(pageOrContext: BrowserContext | Page, handler: WebSocketHandler) {
  let lastId = 0;
  const interceptors = new Map<string, WebSocketInterceptor>();

  await pageOrContext.exposeBinding('__pw_websocket', async (source, data: BindingParams) => {
    if (data.type === 'open') {
      const id = String(++lastId);
      const interceptor = new WebSocketInterceptor(id, source.frame, data.url, data.protocols);
      interceptors.set(id, interceptor);
      const url = await handler(interceptor);
      interceptor._url = url;
      const result: OpenResult = { id, url };
      return result;
    }

    if (data.type === 'send') {
      let result: SendResult = { send: data.data };
      const interceptor = interceptors.get(data.id);
      if (!interceptor)
        return result;
      const buffer = Buffer.from(data.data.data, data.data.isBase64 ? 'base64' : 'utf8');
      interceptor.emit('send', buffer);
      if (interceptor._sendRouter) {
        const routed = await interceptor._sendRouter(buffer);
        if ('data' in routed)
          result = { send: { data: routed.data.toString('base64'), isBase64: true } };
        else
          result = { respond: { data: routed.response.toString('base64'), isBase64: true } };
      }
      return result;
    }

    if (data.type === 'receive') {
      let result: ReceiveResult = { data: data.data };
      const interceptor = interceptors.get(data.id);
      if (!interceptor)
        return result;
      const buffer = Buffer.from(data.data.data, data.data.isBase64 ? 'base64' : 'utf8');
      interceptor.emit('receive', buffer);
      if (interceptor._receiveRouter) {
        const routed = await interceptor._receiveRouter(buffer);
        result = { data: { data: routed.toString('base64'), isBase64: true } };
      }
      return result;
    }

    if (data.type === 'error') {
      const interceptor = interceptors.get(data.id);
      if (interceptor)
        interceptor.emit('socketerror', { error: data.error });
      interceptors.delete(data.id);
      const result: ErrorResult = {};
      return result;
    }

    if (data.type === 'close') {
      const interceptor = interceptors.get(data.id);
      if (interceptor)
        interceptor.emit('close', { code: data.code, reason: data.reason, wasClean: data.wasClean });
      interceptors.delete(data.id);
      const result: CloseResult = {};
      return result;
    }
  });

  await pageOrContext.addInitScript(() => {
    const ws = window.WebSocket;

    class WebSocketImpl {
      static CONNECTING = ws.CONNECTING;
      static OPEN = ws.OPEN;
      static CLOSING = ws.CLOSING;
      static CLOSED = ws.CLOSED;

      CONNECTING = ws.CONNECTING;
      OPEN = ws.OPEN;
      CLOSING = ws.CLOSING;
      CLOSED = ws.CLOSED;
      onclose: WSCloseListener = null;
      onerror: WSErrorListener = null;
      onmessage: WSMessageListener = null;
      onopen: WSOpenListener = null;

      private _ws?: WebSocket;
      private _id?: string;
      private _url: string;
      private _protocols: string | string[] | undefined;
      private _callCloseBeforeOpen?: { code?: number, reason?: string };
      private _listeners = new Map<any, any[]>();
      private _binaryType: BinaryType = 'blob';

      constructor(url: string, protocols?: string | string[]) {
        this._url = url;
        this._protocols = protocols;
        this._init();
      }

      private async _init() {
        const result = await window.__pw_websocket({ type: 'open', url: this._url, protocols: this._protocols });
        const { url, id } = result as OpenResult;
        this._id = id;
        this._ws = new ws(url, this._protocols);
        this._ws.binaryType = this._binaryType;
        this._ws.onopen = e => this.dispatchEvent(e);
        this._ws.onclose = e => this._oncloseAsync(e);
        this._ws.onmessage = e => this._onmessageAsync(e);
        this._ws.onerror = e => this._onerrorAsync(e);
        if (this._callCloseBeforeOpen)
          this._ws.close(this._callCloseBeforeOpen.code, this._callCloseBeforeOpen.reason);
      }

      get binaryType(): BinaryType {
        return this._ws ? this._ws.binaryType : this._binaryType;
      }
      set binaryType(binaryType: BinaryType) {
        if (this._ws)
          this._ws.binaryType = binaryType;
        else
          this._binaryType = binaryType;
      }
      get bufferedAmount(): number {
        return this._ws ? this._ws.bufferedAmount : 0;
      }
      get extensions(): string {
        return this._ws ? this._ws.extensions : '';
      }
      get protocol(): string {
        return this._ws ? this._ws.protocol : '';
      }
      get readyState(): number {
        return this._ws ? this._ws.readyState : ws.CONNECTING;
      }
      get url(): string {
        return this._url;
      }

      close(code?: number, reason?: string): void {
        if (this._ws) {
          this._ws.close(code, reason);
        } else {
          this._callCloseBeforeOpen = { code, reason };
        }
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        if (!this._ws)
          throw new DOMException(`Failed to execute 'send' on 'WebSocket': Still in CONNECTING state.`);
        this._sendAsync(data);
      }

      private _emulateReceive(data: WSData) {
        const message = data.isBase64 ? window.atob(data.data) : data.data;
        const event = new MessageEvent('message', { data: message });
        this.dispatchEvent(event);
      }

      private async _sendAsync(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        const stringData = await dataToString(data);
        const result = (await window.__pw_websocket({ type: 'send', id: this._id!, data: stringData })) as SendResult;
        if ('send' in result) {
          this._ws!.send(result.send.isBase64 ? window.atob(result.send.data) : result.send.data);
        } else {
          this._emulateReceive(result.respond);
        }
      }

      private async _onmessageAsync(e: MessageEvent) {
        if (!this._id) {
          this.dispatchEvent(e);
          return;
        }
        const data = e.data as string;
        const result = (await window.__pw_websocket({ type: 'receive', id: this._id, data: { data, isBase64: false } })) as ReceiveResult;
        this._emulateReceive(result.data);
      }

      private async _onerrorAsync(e: Event) {
        this.dispatchEvent(e);
        if (!this._id)
          return;
        window.__pw_websocket({ type: 'error', id: this._id, error: String(e) });
      }

      private async _oncloseAsync(e: CloseEvent) {
        this.dispatchEvent(e);
        if (!this._id)
          return;
        window.__pw_websocket({ type: 'close', id: this._id, code: e.code, reason: e.reason, wasClean: e.wasClean });
      }

      addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
      addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
        if (!this._listeners.has(type))
          this._listeners.set(type, []);
        this._listeners.get(type)!.push(listener);
      }

      removeEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
      removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
        if (!this._listeners.has(type))
          return;
        const stack = this._listeners.get(type)!;
        const index = stack.indexOf(callback);
        if (index !== -1)
          stack.splice(index, 1);
      }

      dispatchEvent(event: Event): boolean {
        let listeners = this._listeners.get(event.type) || [];
        if (event.type === 'error' && this.onerror)
          listeners = [this.onerror, ...listeners];
        if (event.type === 'close' && this.onclose)
          listeners = [this.onclose, ...listeners];
        if (event.type === 'message' && this.onmessage)
          listeners = [this.onmessage, ...listeners];
        if (event.type === 'open' && this.onopen)
          listeners = [this.onopen, ...listeners];
        for (const listener of listeners)
          listener.call(this, event);
        return !event.defaultPrevented;
      }
    }

    async function bufferToString(b: Uint8Array): Promise<WSData> {
      let binary = '';
      for (let i = 0; i < b.length; i++) {
        binary += String.fromCharCode(b[i]);
      }
      return { data: window.btoa(binary), isBase64: true };
    }

    async function dataToString(data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<WSData> {
      if (data instanceof Blob) {
        const buffer = await data.arrayBuffer();
        return bufferToString(new Uint8Array(buffer));
      }
      if (typeof data === 'string') {
        return { data, isBase64: false };
      }
      if (ArrayBuffer.isView(data))
        return bufferToString(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      return bufferToString(new Uint8Array(data));
    }

    window.WebSocket = WebSocketImpl;
  });
}
