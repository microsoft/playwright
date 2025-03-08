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

import { Server } from './server';
import { navigate, wait, pressKey } from '../tools/common';
import { screenshot, moveMouse, click, drag, type } from '../tools/screenshot';

const server = new Server({
  name: 'Playwright screenshot-based browser server',
  version: '0.0.1',
  tools: [
    navigate,
    screenshot,
    moveMouse,
    click,
    drag,
    type,
    pressKey,
    wait,
  ]
});
server.start();
