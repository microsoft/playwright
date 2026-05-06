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

import { ArtifactDispatcher } from './artifactDispatcher';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { DebuggerDispatcher } from './debuggerDispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { APIRequestContextDispatcher, RequestDispatcher, ResponseDispatcher } from './networkDispatchers';
import { PageDispatcher } from './pageDispatcher';
import { TracingDispatcher } from './tracingDispatcher';

import type { Artifact } from '../artifact';
import type { BrowserContext } from '../browserContext';
import type { Debugger } from '../debugger';
import type { ElementHandle } from '../dom';
import type { Frame } from '../frames';
import type { APIRequestContext } from '../fetch';
import type { Request, Response } from '../network';
import type { Page } from '../page';
import type { Tracing } from '../trace/recorder/tracing';
import type { DispatcherConnection } from './dispatcher';

export function populateBuiltinDispatcherFactories(connection: DispatcherConnection) {
  connection.registerDispatcherFactories({
    Artifact: (scope, obj) => ArtifactDispatcher.from(scope, obj as Artifact),
    BrowserContext: (scope, obj) => BrowserContextDispatcher.from(scope, obj as BrowserContext),
    Debugger: (scope, obj) => DebuggerDispatcher.from(scope as BrowserContextDispatcher, obj as Debugger),
    ElementHandle: (scope, obj) => ElementHandleDispatcher.from(scope as FrameDispatcher, obj as ElementHandle),
    Frame: (scope, obj) => FrameDispatcher.from(scope as BrowserContextDispatcher, obj as Frame),
    APIRequestContext: (scope, obj) => APIRequestContextDispatcher.from(scope as BrowserContextDispatcher, obj as APIRequestContext),
    Request: (scope, obj) => RequestDispatcher.from(scope as BrowserContextDispatcher, obj as Request),
    Response: (scope, obj) => ResponseDispatcher.from(scope as BrowserContextDispatcher, obj as Response),
    Page: (scope, obj) => PageDispatcher.from(scope as BrowserContextDispatcher, obj as Page),
    Tracing: (scope, obj) => TracingDispatcher.from(scope as BrowserContextDispatcher, obj as Tracing),
  });
}
