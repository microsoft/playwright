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

// @ts-ignore
const _impl = require('./utilsBundleImpl');

export const colors: typeof import('colors/safe') = _impl.colors;
export const debug: typeof import('debug') = _impl.debug;
export const diff: typeof import('diff') = _impl.diff;
export const dotenv: typeof import('dotenv') = _impl.dotenv;
export const ini: typeof import('ini') = _impl.ini;
export const getProxyForUrl: typeof import('proxy-from-env').getProxyForUrl = _impl.getProxyForUrl;
export const HttpsProxyAgent: typeof import('https-proxy-agent').HttpsProxyAgent = _impl.HttpsProxyAgent;
export const jpegjs: typeof import('jpeg-js') = _impl.jpegjs;
export const lockfile: typeof import('proper-lockfile') = _impl.lockfile;
export const mime: typeof import('mime') = _impl.mime;
export const minimatch: typeof import('minimatch') = _impl.minimatch;
export const open: typeof import('open') = _impl.open;
export const PNG: typeof import('pngjs').PNG = _impl.PNG;
export const program: typeof import('commander').program = _impl.program;
export const ProgramOption: typeof import('commander').Option = _impl.ProgramOption;
export const progress: typeof import('progress') = _impl.progress;
export const SocksProxyAgent: typeof import('socks-proxy-agent').SocksProxyAgent = _impl.SocksProxyAgent;
export const ws: typeof import('ws') = _impl.ws;
export const wsServer: typeof import('ws').WebSocketServer = _impl.wsServer;
export const wsReceiver = _impl.wsReceiver;
export const wsSender = _impl.wsSender;
export const yaml: typeof import('yaml') = _impl.yaml;
export type { Range as YAMLRange, Scalar as YAMLScalar, YAMLError, YAMLMap, YAMLSeq } from 'yaml';
export const json5: typeof import('json5') = _impl.json5;
export const sourceMapSupport: typeof import('source-map-support') = _impl.sourceMapSupport;
export const stoppable: typeof import('stoppable') = _impl.stoppable;
export const enquirer: typeof import('enquirer') = _impl.enquirer;
export const chokidar: typeof import('chokidar') = _impl.chokidar;
export const getEastAsianWidth: typeof import('get-east-asian-width') = _impl.getEastAsianWidth;
export type { RawSourceMap } from 'source-map';
export type { Command } from 'commander';
export type { RawData as WebSocketRawData, WebSocket, WebSocketServer } from 'ws';
export type { EventEmitter as WebSocketEventEmitter } from 'events';

export const yazl: typeof import('yazl') = _impl.yazl;
export type { ZipFile } from 'yazl';
export const yauzl: typeof import('yauzl') = _impl.yauzl;
export type { Entry, ZipFile as UnzipFile } from 'yauzl';
export const extract: typeof import('../bundles/utils/src/third_party/extract-zip') = _impl.extract;

export const z: typeof import('zod') = _impl.z;
export const zodToJsonSchema: (schema: any, options?: any) => any = _impl.zodToJsonSchema;
export const Client: typeof import('@modelcontextprotocol/sdk/client/index.js').Client = _impl.Client;
export const Server: typeof import('@modelcontextprotocol/sdk/server/index.js').Server = _impl.Server;
export const SSEClientTransport: typeof import('@modelcontextprotocol/sdk/client/sse.js').SSEClientTransport = _impl.SSEClientTransport;
export const SSEServerTransport: typeof import('@modelcontextprotocol/sdk/server/sse.js').SSEServerTransport = _impl.SSEServerTransport;
export const StdioClientTransport: typeof import('@modelcontextprotocol/sdk/client/stdio.js').StdioClientTransport = _impl.StdioClientTransport;
export const StdioServerTransport: typeof import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport = _impl.StdioServerTransport;
export const StreamableHTTPServerTransport: typeof import('@modelcontextprotocol/sdk/server/streamableHttp.js').StreamableHTTPServerTransport = _impl.StreamableHTTPServerTransport;
export const StreamableHTTPClientTransport: typeof import('@modelcontextprotocol/sdk/client/streamableHttp.js').StreamableHTTPClientTransport = _impl.StreamableHTTPClientTransport;
export const CallToolRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema = _impl.CallToolRequestSchema;
export const ListRootsRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ListRootsRequestSchema = _impl.ListRootsRequestSchema;
export const ProgressNotificationSchema: typeof import('@modelcontextprotocol/sdk/types.js').ProgressNotificationSchema = _impl.ProgressNotificationSchema;
export const ListToolsRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ListToolsRequestSchema = _impl.ListToolsRequestSchema;
export const PingRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').PingRequestSchema = _impl.PingRequestSchema;
