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

import { createGuid } from '@utils/crypto';
import { mkdirIfNeeded } from '@utils/fileUtils';
import { Artifact } from '../artifact';
import { nullProgress } from '../progress';

import type { CDPSession } from './crConnection';
import type { CRPage } from './crPage';
import type * as types from '../types';
import type { Protocol } from './protocol';

// Records the page into an mp4 file with AV1 video. Chromium captures and encodes
// the frames itself, so this does not use the screencast frames or ffmpeg.
export class CRVideoRecorder {
  readonly artifact: Artifact;
  private _session: CDPSession;
  private _stopped = false;

  static async start(crPage: CRPage, options: { size?: types.Size, fps?: number }): Promise<CRVideoRecorder> {
    const browserContext = crPage._browserContext;
    // Chromium does not allow recording and screencast in the same session.
    const rootSession = await browserContext._browser._clientRootSession();
    const session = await rootSession.attachToTarget(crPage._targetId);
    try {
      const params: Protocol.Page.startScreenRecordingParameters = {
        maxWidth: options.size?.width ?? 800,
        maxHeight: options.size?.height ?? 800,
        frameRate: options.fps ?? 25,
      };
      await session.send(nullProgress, 'Page.startScreenRecording', params);
    } catch (e) {
      await session.detach(nullProgress).catch(() => {});
      throw e;
    }
    const outputFile = path.join(browserContext._browser.options.artifactsDir, createGuid() + '.mp4');
    return new CRVideoRecorder(session, new Artifact(browserContext, outputFile));
  }

  private constructor(session: CDPSession, artifact: Artifact) {
    this._session = session;
    this.artifact = artifact;
  }

  async stop() {
    if (this._stopped)
      return;
    this._stopped = true;
    // Fails when the page is closed, the artifact reports that error.
    const error = await this._saveRecording().then(() => undefined, e => e);
    await this._session.detach(nullProgress).catch(() => {});
    await this.artifact.reportFinished(error);
  }

  private async _saveRecording() {
    const { stream } = await this._session.send(nullProgress, 'Page.stopScreenRecording') as Protocol.Page.stopScreenRecordingReturnValue;
    await mkdirIfNeeded(this.artifact.localPath());
    const file = await fs.promises.open(this.artifact.localPath(), 'w');
    try {
      let eof = false;
      while (!eof) {
        const response = await this._session.send(nullProgress, 'IO.read', { handle: stream }) as Protocol.IO.readReturnValue;
        eof = response.eof;
        await file.write(Buffer.from(response.data, response.base64Encoded ? 'base64' : undefined));
      }
    } finally {
      await file.close();
      await this._session.send(nullProgress, 'IO.close', { handle: stream }).catch(() => {});
    }
  }
}
