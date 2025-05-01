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

import path from 'path';

import { Page } from './page';
import { assert } from '../utils';
import { Artifact } from './artifact';

export class Download {
  readonly artifact: Artifact;
  readonly url: string;
  private _page: Page;
  private _suggestedFilename: string | undefined;

  constructor(page: Page, downloadsPath: string, uuid: string, url: string, suggestedFilename?: string) {
    const unaccessibleErrorMessage = page.browserContext._options.acceptDownloads === 'deny' ? 'Pass { acceptDownloads: true } when you are creating your browser context.' : undefined;
    this.artifact = new Artifact(page, path.join(downloadsPath, uuid), unaccessibleErrorMessage, () => {
      return this._page.browserContext.cancelDownload(uuid);
    });
    this._page = page;
    this.url = url;
    this._suggestedFilename = suggestedFilename;
    page.browserContext._downloads.add(this);
    if (suggestedFilename !== undefined)
      this._fireDownloadEvent();
  }

  page(): Page {
    return this._page;
  }

  _filenameSuggested(suggestedFilename: string) {
    assert(this._suggestedFilename === undefined);
    this._suggestedFilename = suggestedFilename;
    this._fireDownloadEvent();
  }

  suggestedFilename(): string {
    return this._suggestedFilename!;
  }

  private _fireDownloadEvent() {
    this._page.instrumentation.onDownload(this._page, this);
    this._page.emit(Page.Events.Download, this);
  }
}
