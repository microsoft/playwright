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

import { Readable } from 'stream';
import * as api from '../../types/types';
import { Artifact } from './artifact';

export class Download implements api.Download {
  private _url: string;
  private _suggestedFilename: string;
  private _artifact: Artifact;

  constructor(url: string, suggestedFilename: string, artifact: Artifact) {
    this._url = url;
    this._suggestedFilename = suggestedFilename;
    this._artifact = artifact;
  }

  url(): string {
    return this._url;
  }

  suggestedFilename(): string {
    return this._suggestedFilename;
  }

  async path(): Promise<string | null> {
    return this._artifact.pathAfterFinished();
  }

  async saveAs(path: string): Promise<void> {
    return this._artifact.saveAs(path);
  }

  async failure(): Promise<string | null> {
    return this._artifact.failure();
  }

  async createReadStream(): Promise<Readable | null> {
    return this._artifact.createReadStream();
  }

  async cancel(): Promise<void> {
    return this._artifact.cancel();
  }

  async delete(): Promise<void> {
    return this._artifact.delete();
  }
}
