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

import { chokidar } from './utilsBundle';

import type { FSWatcher } from 'chokidar';

export type FSEvent = { event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', file: string };

export class Watcher {
  private _onChange: (events: FSEvent[]) => void;
  private _watchedPaths: string[] = [];
  private _ignoredFolders: string[] = [];
  private _collector: FSEvent[] = [];
  private _fsWatcher: FSWatcher | undefined;
  private _throttleTimer: NodeJS.Timeout | undefined;

  constructor(onChange: (events: FSEvent[]) => void) {
    this._onChange = onChange;
  }

  async update(watchedPaths: string[], ignoredFolders: string[], reportPending: boolean) {
    if (JSON.stringify([this._watchedPaths, this._ignoredFolders]) === JSON.stringify([watchedPaths, ignoredFolders]))
      return;

    if (reportPending)
      this._reportEventsIfAny();

    this._watchedPaths = watchedPaths;
    this._ignoredFolders = ignoredFolders;
    void this._fsWatcher?.close();
    this._fsWatcher = undefined;
    this._collector.length = 0;
    clearTimeout(this._throttleTimer);
    this._throttleTimer = undefined;

    if (!this._watchedPaths.length)
      return;

    const ignored = [...this._ignoredFolders, '**/node_modules/**'];
    this._fsWatcher = chokidar.watch(watchedPaths, { ignoreInitial: true, ignored }).on('all', async (event, file) => {
      if (this._throttleTimer)
        clearTimeout(this._throttleTimer);
      this._collector.push({ event, file });
      this._throttleTimer = setTimeout(() => this._reportEventsIfAny(), 250);
    });

    await new Promise((resolve, reject) => this._fsWatcher!.once('ready', resolve).once('error', reject));
  }

  async close() {
    await this._fsWatcher?.close();
  }

  private _reportEventsIfAny() {
    if (this._collector.length)
      this._onChange(this._collector.slice());
    this._collector.length = 0;
  }
}
