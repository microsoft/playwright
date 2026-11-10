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
  // Rejects when Chromium fails to start the recording.
  readonly started: Promise<void>;
  private _session: CDPSession | undefined;
  private _saveResult: Promise<Error | undefined> | undefined;
  private _stopping = false;
  private _stopped = new ManualPromise<void>();

  constructor(crPage: CRPage, options: { fileName?: string, size?: types.Size, fps?: number }) {
    const browserContext = crPage._browserContext;
    const outputFile = options.fileName ?? path.join(browserContext._browser.options.artifactsDir, createGuid() + '.mp4');
    this.artifact = new Artifact(browserContext, outputFile);
    this.started = this._start(crPage, options);
    this.started.catch(() => {});
  }

  private async _start(crPage: CRPage, options: { size?: types.Size, fps?: number }) {
    // Chromium does not allow recording and screencast in the same session.
    const rootSession = await crPage._browserContext._browser._clientRootSession();
    const session = await rootSession.attachToTarget(crPage._targetId);
    try {
      const params: Protocol.Page.startScreenRecordingParameters = {
        maxWidth: options.size?.width ?? 800,
        maxHeight: options.size?.height ?? 800,
        frameRate: options.fps ?? 25,
      };
      const { stream } = await session.send(nullProgress, 'Page.startScreenRecording', params) as Protocol.Page.startScreenRecordingReturnValue;
      this._session = session;
      this._saveResult = this._saveRecording(session, stream).then(() => undefined, e => e);
    } catch (e) {
      await session.detach(nullProgress).catch(() => {});
      throw e;
    }
  }

  async stop() {
    if (this._stopping)
      return;
    this._stopping = true;
    let error = await this.started.then(() => undefined, e => e);
    if (this._session) {
      // Fails when the page is closed, the artifact reports the read error then.
      await this._session.send(nullProgress, 'Page.stopScreenRecording').catch(() => {});
      this._stopped.resolve();
      error = await this._saveResult;
      await this._session.detach(nullProgress).catch(() => {});
    }
    await this.artifact.reportFinished(error);
  }

  // Chromium appends a fragment of the video to the stream every few seconds.
  // Copies the fragments to the file during the recording, so that stop() only reads the last one.
  private async _saveRecording(session: CDPSession, stream: string) {
    await mkdirIfNeeded(this.artifact.localPath());
    const file = await fs.promises.open(this.artifact.localPath(), 'w');
    try {
      while (true) {
        const stopped = this._stopped.isDone();
        const response = await session.send(nullProgress, 'IO.read', { handle: stream }).catch(e => {
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
      await session.send(nullProgress, 'IO.close', { handle: stream }).catch(() => {});
    }
  }
}
