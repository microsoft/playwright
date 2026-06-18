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

import { webColors } from './colors';

import type * as fs from 'fs';
import type * as path from 'path';
import type { Readable, Writable } from 'stream';
import type { Colors } from '@isomorphic/colors';

export type Zone = {
  push(data: unknown): Zone;
  pop(): Zone;
  run<R>(func: () => R): R;
  data<T>(): T | undefined;
};

export type StreamChannel = {
  read(params: { size?: number }, signal: AbortSignal | undefined): Promise<{ binary: Buffer }>;
  close(params: {}, signal: AbortSignal | undefined): Promise<any>;
};

export type WritableStreamChannel = {
  write(params: { binary: Buffer }, signal: AbortSignal | undefined): Promise<any>;
  close(params: {}, signal: AbortSignal | undefined): Promise<any>;
};

const noopZone: Zone = {
  push: () => noopZone,
  pop: () => noopZone,
  run: func => func(),
  data: () => undefined,
};

export type Platform = {
  name: 'node' | 'web' | 'empty';

  boxedStackPrefixes: () => string[];
  calculateSha1: (text: string) => Promise<string>;
  colors: Colors;
  coreDir?: string;
  createGuid: () => string;
  defaultMaxListeners: () => number;
  env: Record<string, string | undefined>;
  fs: () => typeof fs;
  inspectCustom: symbol | undefined;
  isDebugMode: () => boolean;
  isJSDebuggerAttached: () => boolean;
  isLogEnabled: (name: 'api' | 'channel') => boolean;
  isUnderTest: () => boolean,
  log: (name: 'api' | 'channel', message: string | Error | object) => void;
  path: () => typeof path;
  pathSeparator: string;
  showInternalStackFrames: () => boolean,
  streamFile: (path: string, writable: Writable) => Promise<void>,
  streamReadable: (channel: StreamChannel) => Readable,
  streamWritable: (channel: WritableStreamChannel) => Writable,
  zones: { empty: Zone, current: () => Zone; };
};

export const emptyPlatform: Platform = {
  name: 'empty',

  boxedStackPrefixes: () => [],

  calculateSha1: async () => {
    throw new Error('Not implemented');
  },

  colors: webColors,

  createGuid: () => {
    throw new Error('Not implemented');
  },

  defaultMaxListeners: () => 10,

  env: {},

  fs: () => {
    throw new Error('Not implemented');
  },

  inspectCustom: undefined,

  isDebugMode: () => false,

  isJSDebuggerAttached: () => false,

  isLogEnabled(name: 'api' | 'channel') {
    return false;
  },

  isUnderTest: () => false,

  log(name: 'api' | 'channel', message: string | Error | object) { },

  path: () => {
    throw new Error('Function not implemented.');
  },

  pathSeparator: '/',

  showInternalStackFrames: () => false,

  streamFile(path: string, writable: Writable): Promise<void> {
    throw new Error('Streams are not available');
  },

  streamReadable: (channel: StreamChannel) => {
    throw new Error('Streams are not available');
  },

  streamWritable: (channel: WritableStreamChannel) => {
    throw new Error('Streams are not available');
  },

  zones: { empty: noopZone, current: () => noopZone },
};
