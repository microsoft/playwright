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

import { BrowserContext, ContextListener } from '../browserContext';
import { isDebugMode } from '../../utils/utils';
import { RecorderSupplement } from './recorderSupplement';

export class InspectorController implements ContextListener {
  async onContextCreated(context: BrowserContext): Promise<void> {
    if (isDebugMode()) {
      RecorderSupplement.getOrCreate(context, {
        language: process.env.PW_CLI_TARGET_LANG || 'javascript',
        terminal: true,
      });
    }
  }
  async onContextWillDestroy(context: BrowserContext): Promise<void> {}
  async onContextDidDestroy(context: BrowserContext): Promise<void> {}
}
