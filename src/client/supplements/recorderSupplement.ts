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

import * as path from 'path';

import { BrowserContext } from '../browserContext';
import { BrowserContextOptions, LaunchOptions } from '../types';

export class RecorderSupplement {
  constructor(context: BrowserContext,
    language: string,
    launchOptions: LaunchOptions,
    contextOptions: BrowserContextOptions,
    device: string | undefined,
    saveStorage: string | undefined,
    output: RecorderOutput) {

    if (process.env.PWTRACE)
      contextOptions._traceDir = path.join(process.cwd(), '.trace');

    context._channel.on('recorderSupplementPrintLn', event => output.printLn(event.text));
    context._channel.on('recorderSupplementPopLn', event => output.popLn(event.text));
    context.on('close', () => output.flush());
    context._channel.recorderSupplementEnable({
      language,
      launchOptions,
      contextOptions,
      device,
      saveStorage,
    }).catch(e => {});
  }
}

export interface RecorderOutput {
  printLn(text: string): void;
  popLn(text: string): void;
  flush(): void;
}
