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

import { createGuid, debugLogger } from '../utils';
import { renderTitleForCall } from '../utils';
import { Page } from './page';

import type { CallMetadata, InstrumentationListener, SdkObject } from './instrumentation';

export class Overlay implements InstrumentationListener {
  private readonly _page: Page;
  private _options: { actionDelay?: number; actionStyle?: string; locatorStyle?: string; } | undefined;
  private _overlays = new Map<string, string>();

  constructor(page: Page) {
    this._page = page;
    this._page.instrumentation.addListener(this, page.browserContext);
    this._page.on(Page.Events.InternalFrameNavigatedToNewDocument, () => {
      for (const [id, html] of this._overlays)
        this._doAdd(id, html).catch(e => debugLogger.log('error', e));
    });
  }

  dispose() {
    this._page.instrumentation.removeListener(this);
  }

  async add(html: string, timeout?: number): Promise<string> {
    const id = createGuid();
    this._overlays.set(id, html);
    // We must return id even if this call fails.
    await this._doAdd(id, html).catch(e => debugLogger.log('error', e));
    if (timeout) {
      await new Promise(f => setTimeout(f, timeout));
      await this.remove(id);
    }
    return id;
  }

  private async _doAdd(id: string, html: string) {
    const utility = await this._page.mainFrame()._utilityContext();
    await utility.evaluate(({ injected, html, id }) => {
      return injected.addUserOverlay(id, html);
    }, { injected: await utility.injectedScript(), html, id });
  }

  async remove(id: string): Promise<void> {
    this._overlays.delete(id);
    const utility = await this._page.mainFrame()._utilityContext();
    await utility.evaluate(({ injected, id }) => {
      injected.removeUserOverlay(id);
    }, { injected: await utility.injectedScript(), id }).catch(e => debugLogger.log('error', e));
  }

  async hide(): Promise<void> {
    const utility = await this._page.mainFrame()._utilityContext();
    await utility.evaluate(({ injected }) => {
      injected.hideUserOverlays();
    }, { injected: await utility.injectedScript() }).catch(e => debugLogger.log('error', e));
  }

  async show(): Promise<void> {
    const utility = await this._page.mainFrame()._utilityContext();
    await utility.evaluate(({ injected }) => {
      injected.showUserOverlays();
    }, { injected: await utility.injectedScript() }).catch(e => debugLogger.log('error', e));
  }

  async configure(options: { actionDelay?: number; actionStyle?: string; locatorStyle?: string }): Promise<void> {
    this._options = options;
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata, parentId?: string): Promise<void> {
    if (!this._options?.actionDelay)
      return;
    metadata.annotate = true;
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (!this._options?.actionDelay)
      return;

    const page = sdkObject.attribution.page;
    if (!page)
      return;

    const actionTitle = renderTitleForCall(metadata);
    const utility = await page.mainFrame()._utilityContext();

    // Run this outside of the progress timer.
    await utility.evaluate(async options => {
      const { injected, delay } = options;
      injected.setScreencastAnnotation(options);
      await new Promise(f => injected.utils.builtins.setTimeout(f, delay));
      injected.setScreencastAnnotation(null);
    }, {
      injected: await utility.injectedScript(),
      delay: this._options?.actionDelay,
      point: metadata.point,
      box: metadata.box,
      actionTitle,
      actionStyle: this._options?.actionStyle,
      locatorStyle: this._options?.locatorStyle,
    }).catch(e => debugLogger.log('error', e));
  }

}
