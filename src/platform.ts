// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Note: this is the only file outside of src/server which can import external dependencies.
// All dependencies must be listed in web.webpack.config.js to avoid bundling them.
import * as nodeEvents from 'events';
import * as nodeFS from 'fs';
import * as nodePath from 'path';
import * as nodeDebug from 'debug';
import * as nodeBuffer from 'buffer';
import * as mime from 'mime';
import * as jpeg from 'jpeg-js';
import * as png from 'pngjs';
import * as http from 'http';
import * as https from 'https';
import * as NodeWebSocket from 'ws';

import { assert, helper } from './helper';
import * as types from './types';
import { ConnectionTransport } from './transport';

export const isNode = typeof process === 'object' && !!process && typeof process.versions === 'object' && !!process.versions && !!process.versions.node;

export function promisify(nodeFunction: Function): Function {
  assert(isNode);
  function promisified(...args: any[]) {
    return new Promise((resolve, reject) => {
      function callback(err: any, ...result: any[]) {
        if (err)
          return reject(err);
        if (result.length === 1)
          return resolve(result[0]);
        return resolve(result);
      }
      nodeFunction.call(null, ...args, callback);
    });
  }
  return promisified;
}

type Listener = (...args: any[]) => void;
export const EventEmitter: typeof nodeEvents.EventEmitter = isNode ? nodeEvents.EventEmitter : (
  class EventEmitterImpl {
    private _deliveryQueue?: {listener: Listener, args: any[]}[];
    private _listeners = new Map<string | symbol, Set<Listener>>();

    addListener(event: string | symbol, listener: Listener): this {
      let set = this._listeners.get(event);
      if (!set) {
        set = new Set();
        this._listeners.set(event, set);
      }
      set.add(listener);
      return this;
    }

    on(event: string | symbol, listener: Listener): this {
      return this.addListener(event, listener);
    }

    once(event: string | symbol, listener: Listener): this {
      const wrapped = (...args: any[]) => {
        this.removeListener(event, wrapped);
        listener(...args);
      };
      return this.on(event, wrapped);
    }

    removeListener(event: string | symbol, listener: Listener): this {
      const set = this._listeners.get(event);
      if (set)
        set.delete(listener);
      return this;
    }

    emit(event: string | symbol, ...args: any[]): boolean {
      const set = this._listeners.get(event);
      if (!set || !set.size)
        return true;
      const dispatch = !this._deliveryQueue;
      if (!this._deliveryQueue)
        this._deliveryQueue = [];
      for (const listener of set)
        this._deliveryQueue.push({ listener, args });
      if (!dispatch)
        return true;
      for (let index = 0; index < this._deliveryQueue.length; index++) {
        const { listener, args } = this._deliveryQueue[index];
        listener(...args);
      }
      this._deliveryQueue = undefined;
      return true;
    }

    listenerCount(event: string | symbol): number {
      const set = this._listeners.get(event);
      return set ? set.size : 0;
    }
  }
) as any as typeof nodeEvents.EventEmitter;
export type EventEmitterType = nodeEvents.EventEmitter;

type DebugType = typeof nodeDebug;
export const debug: DebugType = isNode ? nodeDebug : (
  function debug(namespace: string) {
    return () => {};
  }
) as any as DebugType;

export const Buffer: typeof nodeBuffer.Buffer = isNode ? nodeBuffer.Buffer : (
  class BufferImpl {
    readonly data: ArrayBuffer;

    static from(data: string | ArrayBuffer, encoding: string = 'utf8'): BufferImpl {
      return new BufferImpl(data, encoding);
    }

    static byteLength(buffer: BufferImpl | string, encoding: string = 'utf8'): number {
      if (helper.isString(buffer))
        buffer = new BufferImpl(buffer, encoding);
      return buffer.data.byteLength;
    }

    static concat(buffers: BufferImpl[]): BufferImpl {
      if (!buffers.length)
        return new BufferImpl(new ArrayBuffer(0));
      if (buffers.length === 1)
        return buffers[0];
      const view = new Uint8Array(buffers.reduce((a, b) => a + b.data.byteLength, 0));
      let offset = 0;
      for (const buffer of buffers) {
        view.set(new Uint8Array(buffer.data), offset);
        offset += buffer.data.byteLength;
      }
      return new BufferImpl(view.buffer);
    }

    constructor(data: string | ArrayBuffer, encoding: string = 'utf8') {
      if (data instanceof ArrayBuffer) {
        this.data = data;
      } else {
        if (encoding === 'base64') {
          const binary = atob(data);
          this.data = new ArrayBuffer(binary.length * 2);
          const view = new Uint16Array(this.data);
          for (let i = 0; i < binary.length; i++)
            view[i] = binary.charCodeAt(i);
        } else if (encoding === 'utf8') {
          const encoder = new TextEncoder();
          this.data = encoder.encode(data).buffer;
        } else {
          throw new Error('Unsupported encoding "' + encoding + '"');
        }
      }
    }

    toString(encoding: string = 'utf8'): string {
      if (encoding === 'base64') {
        const binary = String.fromCharCode(...new Uint16Array(this.data));
        return btoa(binary);
      }
      const decoder = new TextDecoder(encoding, { fatal: true });
      return decoder.decode(this.data);
    }
  }
) as any as typeof nodeBuffer.Buffer;
export type BufferType = Buffer;

function assertFileAccess() {
  assert(isNode, 'Working with filesystem using "path" is only supported in Node.js');
}

export async function readFileAsync(file: string, encoding: string): Promise<string> {
  assertFileAccess();
  return await promisify(nodeFS.readFile)(file, encoding);
}

export async function writeFileAsync(file: string, data: any) {
  assertFileAccess();
  return await promisify(nodeFS.writeFile)(file, data);
}

export function basename(file: string): string {
  assertFileAccess();
  return nodePath.basename(file);
}

export async function openFdAsync(file: string, flags: string): Promise<number> {
  assertFileAccess();
  return await promisify(nodeFS.open)(file, flags);
}

export async function writeFdAsync(fd: number, buffer: Buffer): Promise<void> {
  assertFileAccess();
  return await promisify(nodeFS.write)(fd, buffer);
}

export async function closeFdAsync(fd: number): Promise<void> {
  assertFileAccess();
  return await promisify(nodeFS.close)(fd);
}

export function getMimeType(file: string): string | null {
  assertFileAccess();
  return mime.getType(file);
}

export function urlMatches(urlString: string, match: types.URLMatch | undefined): boolean {
  if (match === undefined)
    return true;
  if (typeof match === 'string')
    return match === urlString;
  if (match instanceof RegExp)
    return match.test(urlString);
  assert(typeof match === 'function', 'url parameter should be string, RegExp or function');

  try {
    return match(new URL(urlString));
  } catch (e) {
  }
  return false;
}

export function pngToJpeg(buffer: Buffer): Buffer {
  assert(isNode, 'Converting from png to jpeg is only supported in Node.js');
  return jpeg.encode(png.PNG.sync.read(buffer)).data;
}

function nodeFetch(url: string): Promise<string> {
  let resolve: (url: string) => void;
  let reject: (e: Error) => void = () => {};
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });

  const endpointURL = new URL(url);
  const protocol = endpointURL.protocol === 'https:' ? https : http;
  const request = protocol.request(endpointURL, res => {
    let data = '';
    if (res.statusCode !== 200) {
      // Consume response data to free up memory.
      res.resume();
      reject(new Error('HTTP ' + res.statusCode));
      return;
    }
    res.setEncoding('utf8');
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve(data));
  });

  request.on('error', reject);
  request.end();

  return promise;
}

export function fetchUrl(url: string): Promise<string> {
  if (isNode)
    return nodeFetch(url);
  return fetch(url).then(response => {
    if (!response.ok)
      throw new Error('HTTP ' + response.status + ' ' + response.statusText);
    return response.text();
  });
}

class WebSocketTransport implements ConnectionTransport {
  private _ws: WebSocket;

  onmessage?: (message: string) => void;
  onclose?: () => void;

  constructor(ws: WebSocket) {
    this._ws = ws;
    this._ws.addEventListener('message', event => {
      if (this.onmessage)
        this.onmessage.call(null, event.data);
    });
    this._ws.addEventListener('close', event => {
      if (this.onclose)
        this.onclose.call(null);
    });
    // Silently ignore all errors - we don't know what to do with them.
    this._ws.addEventListener('error', () => {});
  }

  send(message: string) {
    this._ws.send(message);
  }

  close() {
    this._ws.close();
  }
}

export function createWebSocketTransport(url: string): Promise<ConnectionTransport> {
  return new Promise((resolve, reject) => {
    const ws = (isNode ? new NodeWebSocket(url, [], {
      perMessageDeflate: false,
      maxPayload: 256 * 1024 * 1024, // 256Mb
    }) : new WebSocket(url)) as WebSocket;
    ws.addEventListener('open', () => resolve(new WebSocketTransport(ws)));
    ws.addEventListener('error', reject);
  });
}
