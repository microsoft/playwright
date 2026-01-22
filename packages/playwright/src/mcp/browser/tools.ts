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
import console from './tools/console';
import dialogs from './tools/dialogs';
import evaluate from './tools/evaluate';
import files from './tools/files';
import form from './tools/form';
import install from './tools/install';
import keyboard from './tools/keyboard';
import mouse from './tools/mouse';
import navigate from './tools/navigate';
import network from './tools/network';
import open from './tools/open';
import pdf from './tools/pdf';
import runCode from './tools/runCode';
import snapshot from './tools/snapshot';
import screenshot from './tools/screenshot';
import tabs from './tools/tabs';
import tracing from './tools/tracing';
import wait from './tools/wait';
import verify from './tools/verify';

import type { Tool } from './tools/tool';
import type { FullConfig } from './config';

export const browserTools: Tool<any>[] = [
  ...common,
  ...console,
  ...dialogs,
  ...evaluate,
  ...files,
  ...form,
  ...install,
  ...keyboard,
  ...mouse,
  ...navigate,
  ...network,
  ...open,
  ...pdf,
  ...runCode,
  ...screenshot,
  ...snapshot,
  ...tabs,
  ...tracing,
  ...wait,
  ...verify,
];

export function filteredTools(config: FullConfig) {
  return browserTools.filter(tool => tool.capability.startsWith('core') || config.capabilities?.includes(tool.capability));
}
