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

import { BrowserContext } from '../browserContext';
import { RecorderSupplement } from './recorderSupplement';
import { debugLogger } from '../../utils/debugLogger';
import { CallMetadata, InstrumentationListener, SdkObject } from '../instrumentation';
import { ContextDebugger } from './debugger';

export class InspectorController implements InstrumentationListener {
  async onContextCreated(context: BrowserContext): Promise<void> {
    const contextDebugger = ContextDebugger.lookup(context)!;
    if (contextDebugger.isPaused())
      RecorderSupplement.show(context, {}).catch(() => {});
    contextDebugger.on(ContextDebugger.Events.PausedStateChanged, () => {
      RecorderSupplement.show(context, {}).catch(() => {});
    });
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    const recorder = await RecorderSupplement.lookup(sdkObject.attribution.context);
    recorder?.onBeforeCall(sdkObject, metadata);
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    const recorder = await RecorderSupplement.lookup(sdkObject.attribution.context);
    recorder?.onAfterCall(sdkObject, metadata);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    const recorder = await RecorderSupplement.lookup(sdkObject.attribution.context);
    recorder?.onBeforeInputAction(sdkObject, metadata);
  }

  async onCallLog(logName: string, message: string, sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    debugLogger.log(logName as any, message);
    const recorder = await RecorderSupplement.lookup(sdkObject.attribution.context);
    recorder?.updateCallLog([metadata]);
  }
}
