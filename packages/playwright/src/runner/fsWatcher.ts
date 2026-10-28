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

import fs from 'fs';
import path from 'path';

export type FSWatcherParams = {
  // Watched recursively.
  dirs: string[];
  // Watched individually, unless inside one of the dirs.
  files: string[];
  // Never reported, never entered.
  ignoredFolders: string[];
};

// Node.js watches recursively with FSEvents on macOS and ReadDirectoryChangesW on Windows,
// a single handle per root. On other platforms it falls back to a JavaScript implementation
// that watches every single file and does not skip node_modules, so we walk the tree ourselves
// and watch each directory instead. Node 26 adds an `ignore` option to that fallback, so once
// it is the minimum supported version, the walker can go.
const kNativeRecursiveWatch = process.platform === 'darwin' || process.platform === 'win32';

export class FSWatcher {
  private _onChange: (files: string[]) => void;
  private _params: FSWatcherParams = { dirs: [], files: [], ignoredFolders: [] };
  private _watchedFiles = new Set<string>();
  private _watchers = new Map<string, fs.FSWatcher>();
  private _collector = new Set<string>();
  private _throttleTimer: NodeJS.Timeout | undefined;

  constructor(onChange: (files: string[]) => void) {
    this._onChange = onChange;
  }

  async update(params: FSWatcherParams, reportPending: boolean) {
    if (JSON.stringify(this._params) === JSON.stringify(params))
      return;

    if (reportPending)
      this._reportEventsIfAny();

    this._params = params;
    this._closeAll();
    this._collector.clear();
    clearTimeout(this._throttleTimer);
    this._throttleTimer = undefined;

    for (const dir of params.dirs) {
      if (kNativeRecursiveWatch)
        this._watch(dir, true, file => this._onDirEvent(file));
      else
        this._watchTree(dir);
    }

    // Files are watched through their parent directory, so that editors
    // that replace the file on save do not break the watcher.
    this._watchedFiles = new Set(params.files.filter(file => !params.dirs.some(dir => isInside(dir, file))));
    for (const dir of new Set([...this._watchedFiles].map(file => path.dirname(file))))
      this._watch(dir, false, file => this._onFileEvent(file));
  }

  async close() {
    this._closeAll();
    clearTimeout(this._throttleTimer);
    this._throttleTimer = undefined;
  }

  private _watch(dir: string, recursive: boolean, onEvent: (file: string) => void) {
    if (this._watchers.has(dir))
      return;
    try {
      const watcher = fs.watch(dir, { persistent: true, recursive }, (eventType, filename) => {
        onEvent(filename ? path.join(dir, filename) : dir);
      });
      watcher.on('error', () => this._close(dir));
      this._watchers.set(dir, watcher);
    } catch {
      // The directory does not exist, is not accessible, or we have run out of watches.
    }
  }

  private _watchTree(dir: string) {
    if (this._isIgnored(dir) || this._watchers.has(dir))
      return;
    this._watch(dir, false, file => this._onTreeEvent(file));
    if (!this._watchers.has(dir))
      return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
    }
    for (const entry of entries) {
      // Dirent.isDirectory() is false for symlinks, so they are not followed.
      if (entry.isDirectory())
        this._watchTree(path.join(dir, entry.name));
    }
  }

  private _onDirEvent(file: string) {
    if (!this._isIgnored(file))
      this._collect(file);
  }

  private _onTreeEvent(file: string) {
    if (this._isIgnored(file))
      return;
    this._collect(file);
    // A directory may have been added, removed or replaced.
    if (this._watchers.has(file)) {
      if (!isDirectory(file))
        this._closeTree(file);
    } else if (isDirectory(file)) {
      this._watchTree(file);
    }
  }

  private _onFileEvent(file: string) {
    if (this._watchedFiles.has(file))
      this._collect(file);
  }

  private _isIgnored(file: string) {
    if (file.split(path.sep).includes('node_modules'))
      return true;
    return this._params.ignoredFolders.some(folder => file === folder || isInside(folder, file));
  }

  private _collect(file: string) {
    this._collector.add(file);
    clearTimeout(this._throttleTimer);
    this._throttleTimer = setTimeout(() => this._reportEventsIfAny(), 250);
  }

  private _reportEventsIfAny() {
    if (this._collector.size)
      this._onChange([...this._collector]);
    this._collector.clear();
  }

  private _close(dir: string) {
    this._watchers.get(dir)?.close();
    this._watchers.delete(dir);
  }

  private _closeTree(dir: string) {
    for (const watched of [...this._watchers.keys()]) {
      if (watched === dir || isInside(dir, watched))
        this._close(watched);
    }
  }

  private _closeAll() {
    for (const watcher of this._watchers.values())
      watcher.close();
    this._watchers.clear();
  }
}

function isInside(dir: string, file: string) {
  return file.startsWith(dir + path.sep);
}

function isDirectory(file: string) {
  try {
    return fs.lstatSync(file).isDirectory();
  } catch {
    return false;
  }
}
