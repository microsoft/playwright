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

import { createGuid, debugLogger, escapeHTML } from '../utils';
import { Page } from './page';

export class Overlay {
  private readonly _page: Page;
  private _overlays = new Map<string, string>();

  constructor(page: Page) {
    this._page = page;
    this._page.on(Page.Events.InternalFrameNavigatedToNewDocument, frame => {
      if (frame.parentFrame())
        return;
      for (const [id, html] of this._overlays)
        this._doAdd(id, html).catch(e => debugLogger.log('error', e));
    });
  }

  dispose() {
  }

  async show(html: string, duration?: number): Promise<string> {
    const id = createGuid();
    this._overlays.set(id, html);
    // We must return id even if this call fails.
    await this._doAdd(id, html).catch(e => debugLogger.log('error', e));
    if (duration) {
      await new Promise(f => setTimeout(f, duration));
      await this.remove(id);
    }
    return id;
  }

  private async _doAdd(id: string, html: string) {
    const utility = await this._page.mainFrame().utilityContext();
    await utility.evaluate(({ injected, html, id }) => {
      return injected.addUserOverlay(id, html);
    }, { injected: await utility.injectedScript(), html, id });
  }

  async remove(id: string): Promise<void> {
    this._overlays.delete(id);
    const utility = await this._page.mainFrame().utilityContext();
    await utility.evaluate(({ injected, id }) => {
      injected.removeUserOverlay(id);
    }, { injected: await utility.injectedScript(), id }).catch(e => debugLogger.log('error', e));
  }

  async chapter(options: { title: string, description?: string, duration?: number }): Promise<void> {
    const fadeDuration = 300;
    const descriptionHtml = options.description ? `<div id="description">${escapeHTML(options.description)}</div>` : '';
    const styleSheet = `
      @keyframes pw-chapter-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes pw-chapter-fade-out {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      #background {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(2px);
        animation: pw-chapter-fade-in ${fadeDuration}ms ease-out forwards;
      }
      #background.fade-out {
        animation: pw-chapter-fade-out ${fadeDuration}ms ease-in forwards;
      }
      #content {
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 40px 56px;
        max-width: 560px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }
      #title {
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 28px;
        font-weight: 600;
        line-height: 1.3;
        text-align: center;
        letter-spacing: -0.01em;
      }
      #description {
        color: rgba(255, 255, 255, 0.7);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 15px;
        line-height: 1.5;
        margin-top: 12px;
        text-align: center;
      }
    `;
    const duration = options.duration ?? 2000;
    const html = `<style>${styleSheet}</style><div id="background"><div id="content"><div id="title">${escapeHTML(options.title)}</div>${descriptionHtml}</div></div>`;
    const id = await this.show(html);
    await new Promise(f => setTimeout(f, duration));
    // Trigger fade-out, then remove after animation completes.
    const utility = await this._page.mainFrame().utilityContext();
    await utility.evaluate(({ injected, id, fadeDuration }) => {
      const overlay = injected.getUserOverlay(id);
      const bg = overlay?.querySelector('#background');
      if (bg)
        bg.classList.add('fade-out');
      return new Promise(f => injected.utils.builtins.setTimeout(f, fadeDuration));
    }, { injected: await utility.injectedScript(), id, fadeDuration }).catch(e => debugLogger.log('error', e));
    await this.remove(id);
  }

  async setVisible(visible: boolean): Promise<void> {
    if (!this._overlays.size)
      return;
    const utility = await this._page.mainFrame().utilityContext();
    await utility.evaluate(({ injected, visible }) => {
      injected.setUserOverlaysVisible(visible);
    }, { injected: await utility.injectedScript(), visible }).catch(e => debugLogger.log('error', e));
  }
}
