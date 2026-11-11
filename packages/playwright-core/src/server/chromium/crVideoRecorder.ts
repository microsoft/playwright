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
import { kDefaultFps } from '../videoRecorder';

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
  readonly started = new ManualPromise<void>();
  private _crPage: CRPage;
  private _stopRequested = new ManualPromise<void>();
  private _result: Promise<Error | undefined>;

  constructor(crPage: CRPage, options: { fileName?: string, size?: types.Size, fps?: number }) {
    this._crPage = crPage;
    const browserContext = crPage._browserContext;
    const outputFile = options.fileName ?? path.join(browserContext._browser.options.artifactsDir, createGuid() + '.mp4');
    this.artifact = new Artifact(browserContext, outputFile);
    crPage._videoRecorders.add(this);
    this.started.catch(() => {});
    this._result = this._record(options).then(() => undefined, e => {
      this.started.reject(e);
      return e;
    });
  }

  async stop() {
    this._stopRequested.resolve();
    const error = await this._result;
    this._crPage._videoRecorders.delete(this);
    await this.artifact.reportFinished(error);
  }

  private async _record(options: { size?: types.Size, fps?: number }) {
    // Chromium does not allow recording and screencast in the same session.
    const session = await this._crPage._browserContext.newCDPSession(this._crPage._page);
    try {
      const params: Protocol.Page.startScreenRecordingParameters = {
        maxWidth: options.size?.width ?? 800,
        maxHeight: options.size?.height ?? 800,
        frameRate: options.fps ?? kDefaultFps,
      };
      const { stream } = await session.send(nullProgress, 'Page.startScreenRecording', params) as Protocol.Page.startScreenRecordingReturnValue;
      this.started.resolve();
      await this._saveRecording(session, stream);
    } finally {
      await session.detach(nullProgress).catch(() => {});
    }
  }

  // Chromium appends a fragment of the video to the stream every few seconds.
  // Copies the fragments to the file during the recording, so that stop() only reads the last one.
  private async _saveRecording(session: CDPSession, stream: string) {
    await mkdirIfNeeded(this.artifact.localPath());
    const file = await fs.promises.open(this.artifact.localPath(), 'w');
    try {
      let stopped = false;
      while (true) {
        const response: Protocol.IO.readReturnValue = await session.send(nullProgress, 'IO.read', { handle: stream }).catch(e => {
          // The read fails until Chromium writes the first fragment.
          if (stopped || isSessionClosedError(e))
            throw e;
          return { data: '', eof: true };
        });
        if (response.data)
          await file.write(Buffer.from(response.data, response.base64Encoded ? 'base64' : undefined));
        if (!response.eof)
          continue;
        // After the stop all data is in the stream, so "eof" is the end of the video.
        if (stopped)
          break;
        let timer: NodeJS.Timeout;
        await Promise.race([this._stopRequested, new Promise(f => timer = setTimeout(f, kPollIntervalMs))]);
        clearTimeout(timer!);
        if (this._stopRequested.isDone()) {
          // Fails when the page is closed, the next read reports the error then.
          await session.send(nullProgress, 'Page.stopScreenRecording').catch(() => {});
          stopped = true;
        }
      }
    } finally {
      await file.close();
      await session.send(nullProgress, 'IO.close', { handle: stream }).catch(() => {});
    }
  }
}
