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

// Note: this is the only file outside of src/server which can import external dependencies.
// All dependencies must be listed in web.webpack.config.js to avoid bundling them.
import * as nodeEvents from 'events';
import * as nodeFS from 'fs';
import * as nodePath from 'path';
import * as nodeDebug from 'debug';
import * as nodeBuffer from 'buffer';
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

export type Listener = (...args: any[]) => void;
export const EventEmitter: typeof nodeEvents.EventEmitter = isNode ? nodeEvents.EventEmitter : (
  class EventEmitterImpl {
    private _deliveryQueue?: {listener: Listener, args: any[]}[];
    private _listeners = new Map<string | symbol, Set<Listener>>();

    on(event: string | symbol, listener: Listener): this {
      let set = this._listeners.get(event);
      if (!set) {
        set = new Set();
        this._listeners.set(event, set);
      }
      set.add(listener);
      return this;
    }

    addListener(event: string | symbol, listener: Listener): this {
      return this.on(event, listener);
    }

    once(event: string | symbol, listener: Listener): this {
      const wrapped = (...args: any[]) => {
        this.removeListener(event, wrapped);
        listener(...args);
      };
      return this.addListener(event, wrapped);
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

export function getMimeType(file: string): string {
  const extension = file.substring(file.lastIndexOf('.') + 1);
  return extensionToMime[extension] || 'application/octet-stream';
}

export function urlMatches(urlString: string, match: types.URLMatch | undefined): boolean {
  if (match === undefined || match === '')
    return true;
  if (helper.isString(match))
    match = helper.globToRegex(match);
  if (helper.isRegExp(match))
    return match.test(urlString);
  if (typeof match === 'string' && match === urlString)
    return true;
  const url = new URL(urlString);
  if (typeof match === 'string')
    return url.pathname === match;

  assert(typeof match === 'function', 'url parameter should be string, RegExp or function');
  return match(url);
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

// See https://joel.tools/microtasks/
export function makeWaitForNextTask() {
  assert(isNode, 'Waitng for the next task is only supported in nodejs');
  if (parseInt(process.versions.node, 10) >= 11)
    return setImmediate;

  // Unlike Node 11, Node 10 and less have a bug with Task and MicroTask execution order:
  // - https://github.com/nodejs/node/issues/22257
  //
  // So we can't simply run setImmediate to dispatch code in a following task.
  // However, we can run setImmediate from-inside setImmediate to make sure we're getting
  // in the following task.

  let spinning = false;
  const callbacks: (() => void)[] = [];
  const loop = () => {
    const callback = callbacks.shift();
    if (!callback) {
      spinning = false;
      return;
    }
    setImmediate(loop);
    // Make sure to call callback() as the last thing since it's
    // untrusted code that might throw.
    callback();
  };

  return (callback: () => void) => {
    callbacks.push(callback);
    if (!spinning) {
      spinning = true;
      setImmediate(loop);
    }
  };
}

export class WebSocketTransport implements ConnectionTransport {
  private _ws: WebSocket;

  onmessage?: (message: string) => void;
  onclose?: () => void;
  private _connectPromise: Promise<(Error|null)>;

  constructor(url: string) {
    this._ws = (isNode ? new NodeWebSocket(url, [], {
      perMessageDeflate: false,
      maxPayload: 256 * 1024 * 1024, // 256Mb
    }) : new WebSocket(url)) as WebSocket;
    this._connectPromise = new Promise(fulfill => {
      this._ws.addEventListener('open', () => fulfill(null));
      this._ws.addEventListener('error', event => fulfill(new Error('WebSocket error: ' + (event as ErrorEvent).message)));
    });
    // The 'ws' module in node sometimes sends us multiple messages in a single task.
    // In Web, all IO callbacks (e.g. WebSocket callbacks)
    // are dispatched into separate tasks, so there's no need
    // to do anything extra.
    const messageWrap: (cb: () => void) => void = isNode ? makeWaitForNextTask() : cb => cb();

    this._ws.addEventListener('message', event => {
      messageWrap(() => {
        if (this.onmessage)
          this.onmessage.call(null, event.data);
      });
    });

    this._ws.addEventListener('close', event => {
      if (this.onclose)
        this.onclose.call(null);
    });
    // Silently ignore all errors - we don't know what to do with them.
    this._ws.addEventListener('error', () => {});
  }

  async send(message: string) {
    const error = await this._connectPromise;
    if (error)
      throw error;
    this._ws.send(message);
  }

  close() {
    this._ws.close();
  }
}

const extensionToMime: { [key: string]: string } = {
  'ai': 'application/postscript',
  'apng': 'image/apng',
  'appcache': 'text/cache-manifest',
  'au': 'audio/basic',
  'bmp': 'image/bmp',
  'cer': 'application/pkix-cert',
  'cgm': 'image/cgm',
  'coffee': 'text/coffeescript',
  'conf': 'text/plain',
  'crl': 'application/pkix-crl',
  'css': 'text/css',
  'csv': 'text/csv',
  'def': 'text/plain',
  'doc': 'application/msword',
  'dot': 'application/msword',
  'drle': 'image/dicom-rle',
  'dtd': 'application/xml-dtd',
  'ear': 'application/java-archive',
  'emf': 'image/emf',
  'eps': 'application/postscript',
  'exr': 'image/aces',
  'fits': 'image/fits',
  'g3': 'image/g3fax',
  'gbr': 'application/rpki-ghostbusters',
  'gif': 'image/gif',
  'glb': 'model/gltf-binary',
  'gltf': 'model/gltf+json',
  'gz': 'application/gzip',
  'h261': 'video/h261',
  'h263': 'video/h263',
  'h264': 'video/h264',
  'heic': 'image/heic',
  'heics': 'image/heic-sequence',
  'heif': 'image/heif',
  'heifs': 'image/heif-sequence',
  'htm': 'text/html',
  'html': 'text/html',
  'ics': 'text/calendar',
  'ief': 'image/ief',
  'ifb': 'text/calendar',
  'iges': 'model/iges',
  'igs': 'model/iges',
  'in': 'text/plain',
  'ini': 'text/plain',
  'jade': 'text/jade',
  'jar': 'application/java-archive',
  'jls': 'image/jls',
  'jp2': 'image/jp2',
  'jpe': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'jpf': 'image/jpx',
  'jpg': 'image/jpeg',
  'jpg2': 'image/jp2',
  'jpgm': 'video/jpm',
  'jpgv': 'video/jpeg',
  'jpm': 'image/jpm',
  'jpx': 'image/jpx',
  'js': 'application/javascript',
  'json': 'application/json',
  'json5': 'application/json5',
  'jsx': 'text/jsx',
  'jxr': 'image/jxr',
  'kar': 'audio/midi',
  'ktx': 'image/ktx',
  'less': 'text/less',
  'list': 'text/plain',
  'litcoffee': 'text/coffeescript',
  'log': 'text/plain',
  'm1v': 'video/mpeg',
  'm21': 'application/mp21',
  'm2a': 'audio/mpeg',
  'm2v': 'video/mpeg',
  'm3a': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'm4p': 'application/mp4',
  'man': 'text/troff',
  'manifest': 'text/cache-manifest',
  'markdown': 'text/markdown',
  'mathml': 'application/mathml+xml',
  'md': 'text/markdown',
  'mdx': 'text/mdx',
  'me': 'text/troff',
  'mesh': 'model/mesh',
  'mft': 'application/rpki-manifest',
  'mid': 'audio/midi',
  'midi': 'audio/midi',
  'mj2': 'video/mj2',
  'mjp2': 'video/mj2',
  'mjs': 'application/javascript',
  'mml': 'text/mathml',
  'mov': 'video/quicktime',
  'mp2': 'audio/mpeg',
  'mp21': 'application/mp21',
  'mp2a': 'audio/mpeg',
  'mp3': 'audio/mpeg',
  'mp4': 'video/mp4',
  'mp4a': 'audio/mp4',
  'mp4s': 'application/mp4',
  'mp4v': 'video/mp4',
  'mpe': 'video/mpeg',
  'mpeg': 'video/mpeg',
  'mpg': 'video/mpeg',
  'mpg4': 'video/mp4',
  'mpga': 'audio/mpeg',
  'mrc': 'application/marc',
  'ms': 'text/troff',
  'msh': 'model/mesh',
  'n3': 'text/n3',
  'oga': 'audio/ogg',
  'ogg': 'audio/ogg',
  'ogv': 'video/ogg',
  'ogx': 'application/ogg',
  'otf': 'font/otf',
  'p10': 'application/pkcs10',
  'p7c': 'application/pkcs7-mime',
  'p7m': 'application/pkcs7-mime',
  'p7s': 'application/pkcs7-signature',
  'p8': 'application/pkcs8',
  'pdf': 'application/pdf',
  'pki': 'application/pkixcmp',
  'pkipath': 'application/pkix-pkipath',
  'png': 'image/png',
  'ps': 'application/postscript',
  'pskcxml': 'application/pskc+xml',
  'qt': 'video/quicktime',
  'rmi': 'audio/midi',
  'rng': 'application/xml',
  'roa': 'application/rpki-roa',
  'roff': 'text/troff',
  'rsd': 'application/rsd+xml',
  'rss': 'application/rss+xml',
  'rtf': 'application/rtf',
  'rtx': 'text/richtext',
  's3m': 'audio/s3m',
  'sgi': 'image/sgi',
  'sgm': 'text/sgml',
  'sgml': 'text/sgml',
  'shex': 'text/shex',
  'shtml': 'text/html',
  'sil': 'audio/silk',
  'silo': 'model/mesh',
  'slim': 'text/slim',
  'slm': 'text/slim',
  'snd': 'audio/basic',
  'spx': 'audio/ogg',
  'stl': 'model/stl',
  'styl': 'text/stylus',
  'stylus': 'text/stylus',
  'svg': 'image/svg+xml',
  'svgz': 'image/svg+xml',
  't': 'text/troff',
  't38': 'image/t38',
  'text': 'text/plain',
  'tfx': 'image/tiff-fx',
  'tif': 'image/tiff',
  'tiff': 'image/tiff',
  'tr': 'text/troff',
  'ts': 'video/mp2t',
  'tsv': 'text/tab-separated-values',
  'ttc': 'font/collection',
  'ttf': 'font/ttf',
  'ttl': 'text/turtle',
  'txt': 'text/plain',
  'uri': 'text/uri-list',
  'uris': 'text/uri-list',
  'urls': 'text/uri-list',
  'vcard': 'text/vcard',
  'vrml': 'model/vrml',
  'vtt': 'text/vtt',
  'war': 'application/java-archive',
  'wasm': 'application/wasm',
  'wav': 'audio/wav',
  'weba': 'audio/webm',
  'webm': 'video/webm',
  'webmanifest': 'application/manifest+json',
  'webp': 'image/webp',
  'wmf': 'image/wmf',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'wrl': 'model/vrml',
  'x3d': 'model/x3d+xml',
  'x3db': 'model/x3d+fastinfoset',
  'x3dbz': 'model/x3d+binary',
  'x3dv': 'model/x3d-vrml',
  'x3dvz': 'model/x3d+vrml',
  'x3dz': 'model/x3d+xml',
  'xaml': 'application/xaml+xml',
  'xht': 'application/xhtml+xml',
  'xhtml': 'application/xhtml+xml',
  'xm': 'audio/xm',
  'xml': 'text/xml',
  'xsd': 'application/xml',
  'xsl': 'application/xml',
  'xslt': 'application/xslt+xml',
  'yaml': 'text/yaml',
  'yml': 'text/yaml',
  'zip': 'application/zip'
};
