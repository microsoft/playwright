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

import { ManualPromise } from '@isomorphic/manualPromise';
import { createGuid } from '@utils/crypto';
import { mkdirIfNeeded } from '@utils/fileUtils';
import { Artifact } from '../artifact';
import { nullProgress } from '../progress';
import { isSessionClosedError } from '../protocolError';

import type { CDPSession } from './crConnection';
import type { CRPage } from './crPage';
import type * as types from '../types';
import type { Protocol } from './protocol';

const kPollIntervalMs = 1000;

// Records the page into an mp4 file with AV1 video. Chromium captures and encodes
// the frames itself, so this does not use the screencast frames or ffmpeg.
export class CRVideoRecorder {
  readonly artifact: Artifact;
  private _session: CDPSession;
  private _stream: string;
  private _stopping = false;
  private _stopped = new ManualPromise<void>();
  private _saveResult: Promise<Error | undefined>;

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
      const { stream } = await session.send(nullProgress, 'Page.startScreenRecording', params) as Protocol.Page.startScreenRecordingReturnValue;
      const outputFile = path.join(browserContext._browser.options.artifactsDir, createGuid() + '.mp4');
      return new CRVideoRecorder(session, stream, new Artifact(browserContext, outputFile));
    } catch (e) {
      await session.detach(nullProgress).catch(() => {});
      throw e;
    }
  }

  private constructor(session: CDPSession, stream: string, artifact: Artifact) {
    this._session = session;
    this._stream = stream;
    this.artifact = artifact;
    this._saveResult = this._saveRecording().then(() => undefined, e => e);
  }

  async stop() {
    if (this._stopping)
      return;
    this._stopping = true;
    // Fails when the page is closed, the artifact reports the read error then.
    await this._session.send(nullProgress, 'Page.stopScreenRecording').catch(() => {});
    this._stopped.resolve();
    const error = await this._saveResult;
    await this._session.detach(nullProgress).catch(() => {});
    await this.artifact.reportFinished(error);
  }

  // Chromium appends a fragment of the video to the stream every few seconds.
  // Copies the fragments to the file during the recording, so that stop() only reads the last one.
  private async _saveRecording() {
    await mkdirIfNeeded(this.artifact.localPath());
    const file = await fs.promises.open(this.artifact.localPath(), 'w');
    try {
      while (true) {
        const stopped = this._stopped.isDone();
        const response = await this._session.send(nullProgress, 'IO.read', { handle: this._stream }).catch(e => {
          // The read fails until Chromium writes the first fragment.
          if (stopped || isSessionClosedError(e))
            throw e;
        }) as Protocol.IO.readReturnValue | undefined;
        if (response?.data)
          await file.write(Buffer.from(response.data, response.base64Encoded ? 'base64' : undefined));
        if (response && !response.eof)
          continue;
        // After the stop all data is in the stream, so "eof" is the end of the video.
        if (stopped)
          break;
        let timer: NodeJS.Timeout;
        await Promise.race([this._stopped, new Promise(f => timer = setTimeout(f, kPollIntervalMs))]);
        clearTimeout(timer!);
      }
    } finally {
      await file.close();
      await this._session.send(nullProgress, 'IO.close', { handle: this._stream }).catch(() => {});
    }
  }
}
