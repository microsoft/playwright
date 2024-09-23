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

import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';
import { ManualPromise } from './manualPromise';
import { assert } from './debug';
import { monotonicTime } from './time';

// Implementation(partial) of Happy Eyeballs 2 algorithm described in
// https://www.rfc-editor.org/rfc/rfc8305

// Same as in Chromium (https://source.chromium.org/chromium/chromium/src/+/5666ff4f5077a7e2f72902f3a95f5d553ea0d88d:net/socket/transport_connect_job.cc;l=102)
const connectionAttemptDelayMs = 300;

const kDNSLookupAt = Symbol('kDNSLookupAt')
const kTCPConnectionAt = Symbol('kTCPConnectionAt')

class HttpHappyEyeballsAgent extends http.Agent {
  createConnection(options: http.ClientRequestArgs, oncreate?: (err: Error | null, socket?: net.Socket) => void): net.Socket | undefined {
    // There is no ambiguity in case of IP address.
    if (net.isIP(clientRequestArgsToHostName(options)))
      return net.createConnection(options as net.NetConnectOpts);
    createConnectionAsync(options, oncreate, /* useTLS */ false).catch(err => oncreate?.(err));
  }
}

class HttpsHappyEyeballsAgent extends https.Agent {
  createConnection(options: http.ClientRequestArgs, oncreate?: (err: Error | null, socket?: net.Socket) => void): net.Socket | undefined {
    // There is no ambiguity in case of IP address.
    if (net.isIP(clientRequestArgsToHostName(options)))
      return tls.connect(options as tls.ConnectionOptions);
    createConnectionAsync(options, oncreate, /* useTLS */ true).catch(err => oncreate?.(err));
  }
}

// These options are aligned with the default Node.js globalAgent options.
export const httpsHappyEyeballsAgent = new HttpsHappyEyeballsAgent({ keepAlive: true });
export const httpHappyEyeballsAgent = new HttpHappyEyeballsAgent({ keepAlive: true });

export async function createSocket(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    if (net.isIP(host)) {
      const socket = net.createConnection({ host, port });
      socket.on('connect', () => resolve(socket));
      socket.on('error', error => reject(error));
    } else {
      createConnectionAsync({ host, port }, (err, socket) => {
        if (err)
          reject(err);
        if (socket)
          resolve(socket);
      }, /* useTLS */ false).catch(err => reject(err));
    }
  });
}

export async function createTLSSocket(options: tls.ConnectionOptions): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    assert(options.host, 'host is required');
    if (net.isIP(options.host)) {
      const socket = tls.connect(options)
      socket.on('secureConnect', () => resolve(socket));
      socket.on('error', error => reject(error));
    } else {
      createConnectionAsync(options, (err, socket) => {
        if (err)
          reject(err);
        if (socket) {
          socket.on('secureConnect', () => resolve(socket));
          socket.on('error', error => reject(error));
        }
      }, true).catch(err => reject(err));
    }
  });
}

export async function createConnectionAsync(
  options: http.ClientRequestArgs, 
  oncreate: ((err: Error | null, socket?: tls.TLSSocket) => void) | undefined, 
  useTLS: true
): Promise<void>;

export async function createConnectionAsync(
  options: http.ClientRequestArgs, 
  oncreate: ((err: Error | null, socket?: net.Socket) => void) | undefined, 
  useTLS: false
): Promise<void>;

export async function createConnectionAsync(
  options: http.ClientRequestArgs, 
  oncreate: ((err: Error | null, socket?: any) => void) | undefined, 
  useTLS: boolean
): Promise<void> {
  const lookup = (options as any).__testHookLookup || lookupAddresses;
  const hostname = clientRequestArgsToHostName(options);
  const addresses = await lookup(hostname);
  const dnsLookupAt = monotonicTime();
  const sockets = new Set<net.Socket>();
  let firstError;
  let errorCount = 0;
  const handleError = (socket: net.Socket, err: Error) => {
    if (!sockets.delete(socket))
      return;
    ++errorCount;
    firstError ??= err;
    if (errorCount === addresses.length)
      oncreate?.(firstError);
  };

  const connected = new ManualPromise();
  for (const { address } of addresses) {
    const socket = useTLS ?
      tls.connect({
        ...(options as tls.ConnectionOptions),
        port: options.port as number,
        host: address,
        servername: hostname }) :
      net.createConnection({
        ...options,
        port: options.port as number,
        host: address });

    (socket as any)[kDNSLookupAt] = dnsLookupAt;

    // Each socket may fire only one of 'connect', 'timeout' or 'error' events.
    // None of these events are fired after socket.destroy() is called.
    socket.on('connect', () => {
      (socket as any)[kTCPConnectionAt] = monotonicTime();

      connected.resolve();
      oncreate?.(null, socket);
      // TODO: Cache the result?
      // Close other outstanding sockets.
      sockets.delete(socket);
      for (const s of sockets)
        s.destroy();
      sockets.clear();
    });
    socket.on('timeout', () => {
      // Timeout is not an error, so we have to manually close the socket.
      socket.destroy();
      handleError(socket, new Error('Connection timeout'));
    });
    socket.on('error', e => handleError(socket, e));
    sockets.add(socket);
    await Promise.race([
      connected,
      new Promise(f => setTimeout(f, connectionAttemptDelayMs))
    ]);
    if (connected.isDone())
      break;
  }
}

async function lookupAddresses(hostname: string): Promise<dns.LookupAddress[]> {
  const addresses = await dns.promises.lookup(hostname, { all: true, family: 0, verbatim: true });
  let firstFamily = addresses.filter(({ family }) => family === 6);
  let secondFamily = addresses.filter(({ family }) => family === 4);
  // Make sure first address in the list is the same as in the original order.
  if (firstFamily.length && firstFamily[0] !== addresses[0]) {
    const tmp = firstFamily;
    firstFamily = secondFamily;
    secondFamily = tmp;
  }
  const result = [];
  // Alternate ipv6 and ipv4 addresses.
  for (let i = 0; i < Math.max(firstFamily.length, secondFamily.length); i++) {
    if (firstFamily[i])
      result.push(firstFamily[i]);
    if (secondFamily[i])
      result.push(secondFamily[i]);
  }
  return result;
}

function clientRequestArgsToHostName(options: http.ClientRequestArgs): string {
  if (options.hostname)
    return options.hostname;
  if (options.host)
    return options.host;
  throw new Error('Either options.hostname or options.host must be provided');
}

export function timingForSocket(socket: net.Socket | tls.TLSSocket) {
  return {
    dnsLookupAt: (socket as any)[kDNSLookupAt] as number | undefined,
    tcpConnectionAt: (socket as any)[kTCPConnectionAt] as number | undefined,
  }
}
