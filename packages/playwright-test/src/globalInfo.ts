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
import { GlobalInfo } from './types';
import { attach, getContainedPath } from './util';

export class GlobalInfoImpl implements GlobalInfo {
  private _outputDir: string;

  constructor(outputDir: string) {
    this._outputDir = outputDir;
  }

  attachments: { name: string; path?: string | undefined; body?: Buffer | undefined; contentType: string; }[] = [];
  async attach(name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}) {
    this.attachments.push(await attach((...segments: string[]) => this._outputPath(...segments), name, options));
  }

  private _outputPath(...pathSegments: string[]){
    fs.mkdirSync(this._outputDir, { recursive: true });
    const joinedPath = path.join(...pathSegments);
    const outputPath = getContainedPath(this._outputDir, joinedPath);
    if (outputPath)
      return outputPath;
    throw new Error(`The outputPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\toutputPath: ${joinedPath}`);
  }
}
