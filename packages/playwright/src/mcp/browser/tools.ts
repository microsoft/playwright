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

import common from './tools/common';
import config from './tools/config';
import console from './tools/console';
import cookies from './tools/cookies';
import dialogs from './tools/dialogs';
import evaluate from './tools/evaluate';
import files from './tools/files';
import form from './tools/form';
import install from './tools/install';
import keyboard from './tools/keyboard';
import mouse from './tools/mouse';
import navigate from './tools/navigate';
import network from './tools/network';
import pdf from './tools/pdf';
import route from './tools/route';
import runCode from './tools/runCode';
import snapshot from './tools/snapshot';
import screenshot from './tools/screenshot';
import storage from './tools/storage';
import tabs from './tools/tabs';
import tracing from './tools/tracing';
import verify from './tools/verify';
import video from './tools/video';
import wait from './tools/wait';
import webstorage from './tools/webstorage';

import type { Tool } from './tools/tool';
import type { FullConfig } from './config';

export const browserTools: Tool<any>[] = [
  ...common,
  ...config,
  ...console,
  ...cookies,
  ...dialogs,
  ...evaluate,
  ...files,
  ...form,
  ...install,
  ...keyboard,
  ...mouse,
  ...navigate,
  ...network,
  ...pdf,
  ...route,
  ...runCode,
  ...screenshot,
  ...snapshot,
  ...storage,
  ...tabs,
  ...tracing,
  ...verify,
  ...video,
  ...wait,
  ...webstorage,
];

export function filteredTools(config: FullConfig) {
  return browserTools.filter(tool => tool.capability.startsWith('core') || config.capabilities?.includes(tool.capability)).filter(tool => !tool.skillOnly);
}
