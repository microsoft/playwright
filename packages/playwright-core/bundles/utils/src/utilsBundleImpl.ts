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

/* eslint-disable import/order */

import colorsLibrary from 'colors/safe';
export const colors = colorsLibrary;

import debugLibrary from 'debug';
export const debug = debugLibrary;

import * as iniLibrary from 'ini';
export const ini = iniLibrary;

import * as diffLibrary from 'diff';
export const diff = diffLibrary;

import dotenvLibrary from 'dotenv';
export const dotenv = dotenvLibrary;

export { getProxyForUrl } from 'proxy-from-env';

export { HttpsProxyAgent } from 'https-proxy-agent';

import jpegLibrary from 'jpeg-js';
export const jpegjs = jpegLibrary;

const lockfileLibrary = require('./third_party/lockfile');
export const lockfile = lockfileLibrary;

import mimeLibrary from 'mime';
export const mime = mimeLibrary;

import minimatchLibrary from 'minimatch';
export const minimatch = minimatchLibrary;

import openLibrary from 'open';
export const open = openLibrary;

export { PNG } from 'pngjs';

export { program } from 'commander';
export { Option as ProgramOption } from 'commander';

import progressLibrary from 'progress';
export const progress = progressLibrary;

export { SocksProxyAgent } from 'socks-proxy-agent';

// @ts-ignore
import wsLibrary, { WebSocketServer, Receiver, Sender } from 'ws';
export const ws = wsLibrary;
export const wsServer = WebSocketServer;
export const wsReceiver = Receiver;
export const wsSender = Sender;

import yamlLibrary from 'yaml';
export const yaml = yamlLibrary;

import json5Library from 'json5';
export const json5 = json5Library;

import sourceMapSupportLibrary from 'source-map-support';
export const sourceMapSupport = sourceMapSupportLibrary;

import stoppableLibrary from 'stoppable';
export const stoppable = stoppableLibrary;

import enquirerLibrary from 'enquirer';
export const enquirer = enquirerLibrary;

import chokidarLibrary from 'chokidar';
export const chokidar = chokidarLibrary;

import * as getEastAsianWidthLibrary from 'get-east-asian-width';
export const getEastAsianWidth = getEastAsianWidthLibrary;

export * as yazl from 'yazl';
export * as yauzl from 'yauzl';
const extractZip = require('./third_party/extract-zip');
export const extract = extractZip;

export * as z from 'zod';

export { Client } from '@modelcontextprotocol/sdk/client/index.js';
export { Server } from '@modelcontextprotocol/sdk/server/index.js';
export { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
export { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
export { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
export { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
export { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
export { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
export { CallToolRequestSchema, ListRootsRequestSchema, ListToolsRequestSchema, PingRequestSchema, ProgressNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
export { zodToJsonSchema } from 'zod-to-json-schema';
