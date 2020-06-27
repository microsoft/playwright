/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import { Transport } from './transport';
import { DispatcherScope } from './dispatcher';
import { Playwright } from '../server/playwright';
import { BrowserTypeDispatcher } from './server/browserTypeDispatcher';

const dispatcherScope = new DispatcherScope();
const transport = new Transport(process.stdout, process.stdin);
transport.onmessage = message => dispatcherScope.send(message);
dispatcherScope.onmessage = message => transport.send(message);

const playwright = new Playwright(__dirname, require('../../browsers.json')['browsers']);
BrowserTypeDispatcher.from(dispatcherScope, playwright.chromium!);
BrowserTypeDispatcher.from(dispatcherScope, playwright.firefox!);
BrowserTypeDispatcher.from(dispatcherScope, playwright.webkit!);
