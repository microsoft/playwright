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
import { isDebugMode, isUnderTest } from '../../utils/utils';

export class InspectorController implements InstrumentationListener {
  private _recorders = new Map<BrowserContext, Promise<RecorderSupplement>>();

  async onContextCreated(context: BrowserContext): Promise<void> {
    if (isDebugMode())
      this._recorders.set(context, RecorderSupplement.getOrCreate(context));
  }

  async onContextDidDestroy(context: BrowserContext): Promise<void> {
    this._recorders.delete(context);
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    const context = sdkObject.attribution.context;
    if (!context)
      return;

    if (metadata.method === 'pause') {
      // Force create recorder on pause.
      if (!context._browser.options.headful && !isUnderTest())
        return;
      this._recorders.set(context, RecorderSupplement.getOrCreate(context));
    }

    const recorder = await this._recorders.get(context);
    await recorder?.onBeforeCall(sdkObject, metadata);
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (!sdkObject.attribution.context)
      return;
    const recorder = await this._recorders.get(sdkObject.attribution.context!);
    await recorder?.onAfterCall(metadata);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (!sdkObject.attribution.page)
      return;
    const recorder = await this._recorders.get(sdkObject.attribution.context!);
    await recorder?.onBeforeInputAction(metadata);
  }

  async onCallLog(logName: string, message: string, sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    debugLogger.log(logName as any, message);
    if (!sdkObject.attribution.page)
      return;
    const recorder = await this._recorders.get(sdkObject.attribution.context!);
    await recorder?.updateCallLog([metadata]);
  }
}
