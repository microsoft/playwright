/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as rawClipboardSource from '../generated/clipboardSource';
import { nullProgress } from './progress';

import type { BrowserContext } from './browserContext';
import type { Progress } from './progress';
import type { BindingPayload, ClipboardEntry } from '@injected/clipboard';

const kBindingName = '__pwClipboardBinding';

export class Clipboard {
  private _browserContext: BrowserContext;
  private _installPromise: Promise<void> | undefined;
  private _items: ClipboardEntry[] = [];

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  install(progress: Progress): Promise<void> {
    // Memoize so that concurrent operations don't race to register the binding twice.
    if (!this._installPromise) {
      this._installPromise = this._doInstall().catch(error => {
        this._installPromise = undefined;
        throw error;
      });
    }
    return progress.race(this._installPromise);
  }

  async readText(progress: Progress): Promise<string> {
    if (this._installPromise)
      await progress.race(this._installPromise);
    return this._items.find(item => item.type === 'text/plain')?.value ?? '';
  }

  async writeText(progress: Progress, text: string): Promise<void> {
    await this.install(progress);
    this._items = [{ type: 'text/plain', value: text }];
    await progress.race(this._broadcast());
  }

  async read(progress: Progress): Promise<{ mimeType: string, buffer: Buffer }[]> {
    if (this._installPromise)
      await progress.race(this._installPromise);
    return this._items.map(item => ({
      mimeType: item.type,
      buffer: Buffer.from(item.value, item.base64 ? 'base64' : 'utf-8'),
    }));
  }

  async write(progress: Progress, items: { mimeType: string, buffer: Buffer }[]): Promise<void> {
    await this.install(progress);
    this._items = items.map(item => {
      if (item.mimeType.startsWith('text/'))
        return { type: item.mimeType, value: item.buffer.toString('utf-8') };
      return { type: item.mimeType, value: item.buffer.toString('base64'), base64: true };
    });
    await progress.race(this._broadcast());
  }

  async resetForReuse(progress: Progress): Promise<void> {
    // Reused contexts start empty.  The binding and init script are idempotent and kept, freed with the context.
    this._items = [];
    if (this._installPromise)
      await progress.race(this._broadcast());
  }

  private async _doInstall(): Promise<void> {
    const params = {
      browserName: this._browserContext._browser.options.name,
      // Native shortcuts are generated relative to the driver platform, so `ControlOrMeta` is `Meta` on macOS.
      isMac: process.platform === 'darwin',
    };
    const script = `(() => {
      const module = {};
      ${rawClipboardSource.source}
      module.exports.inject()(globalThis, ${JSON.stringify(params)});
    })();`;
    const binding = await this._browserContext.exposeBinding(nullProgress, kBindingName, async (_source, payload: BindingPayload) => {
      if (payload.action === 'write') {
        this._items = payload.items;
        await this._broadcast();
      }
      return this._items;
    });
    try {
      // `addInitScript` runs at document-start (unlike `extendInjectedScript`), so `navigator.clipboard` is redirected before a page's first script.
      await this._browserContext.addInitScript(nullProgress, script);
    } catch (error) {
      await binding.dispose().catch(() => {});
      throw error;
    }
    // `addInitScript` only covers future documents, so also inject into already-loaded frames (idempotent via the in-page guard).
    await this._browserContext.safeNonStallingEvaluateInAllFrames(script, 'main', { throwOnJSErrors: false }).catch(() => {});
  }

  // Synchronous handlers (native Ctrl+V, execCommand) can't await, so push the store into each frame's mirror.
  private async _broadcast(): Promise<void> {
    const script = `globalThis.__pwClipboardSet(${JSON.stringify(this._items)})`;
    await this._browserContext.safeNonStallingEvaluateInAllFrames(script, 'main', { throwOnJSErrors: false });
  }
}
