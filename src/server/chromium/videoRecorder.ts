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

import { ChildProcess } from 'child_process';
import { ffmpegExecutable } from '../../utils/binaryPaths';
import { assert, monotonicTime } from '../../utils/utils';
import { launchProcess } from '../processLauncher';
import { Progress, ProgressController } from '../progress';
import * as types from '../types';

const fps = 25;

export class VideoRecorder {
  private _process: ChildProcess | null = null;
  private _gracefullyClose: (() => Promise<void>) | null = null;
  private _lastWritePromise: Promise<void> = Promise.resolve();
  private _lastFrameTimestamp: number = 0;
  private _lastFrameBuffer: Buffer | null = null;
  private _lastWriteTimestamp: number = 0;
  private readonly _progress: Progress;
  private _frameQueue: Buffer[] = [];
  private _isStopped = false;

  static async launch(options: types.PageScreencastOptions): Promise<VideoRecorder> {
    if (!options.outputFile.endsWith('.webm'))
      throw new Error('File must have .webm extension');

    const controller = new ProgressController();
    controller.setLogName('browser');
    return await controller.run(async progress => {
      const recorder = new VideoRecorder(progress);
      await recorder._launch(options);
      return recorder;
    });
  }

  private constructor(progress: Progress) {
    this._progress = progress;
  }

  private async _launch(options: types.PageScreencastOptions) {
    const w = options.width;
    const h = options.height;
    const args = `-loglevel error -f image2pipe -c:v mjpeg -i - -y -an -r ${fps} -c:v vp8 -qmin 0 -qmax 50 -crf 8 -b:v 1M -vf pad=${w}:${h}:0:0:gray,crop=${w}:${h}:0:0`.split(' ');
    args.push(options.outputFile);
    const progress = this._progress;

    const executablePath = ffmpegExecutable();
    if (!executablePath)
      throw new Error('ffmpeg executable was not found');
    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath,
      args,
      pipeStdin: true,
      progress,
      tempDirectories: [],
      attemptToGracefullyClose: async () => {
        progress.log('Closing stdin...');
        launchedProcess.stdin.end();
      },
      onExit: (exitCode, signal) => {
        progress.log(`ffmpeg onkill exitCode=${exitCode} signal=${signal}`);
      },
    });
    launchedProcess.stdin.on('finish', () => {
      progress.log('ffmpeg finished input.');
    });
    launchedProcess.stdin.on('error', () => {
      progress.log('ffmpeg error.');
    });
    this._process = launchedProcess;
    this._gracefullyClose = gracefullyClose;
  }

  writeFrame(frame: Buffer, timestamp: number) {
    assert(this._process);
    if (this._isStopped)
      return;
    this._progress.log(`writing frame ` + timestamp);

    if (this._lastFrameBuffer) {
      const durationSec = timestamp - this._lastFrameTimestamp;
      const repeatCount = Math.max(1, Math.round(fps * durationSec));
      for (let i = 0; i < repeatCount; ++i)
        this._frameQueue.push(this._lastFrameBuffer);
      this._lastWritePromise = this._lastWritePromise.then(() => this._sendFrames());
    }

    this._lastFrameBuffer = frame;
    this._lastFrameTimestamp = timestamp;
    this._lastWriteTimestamp = monotonicTime();
  }

  private async _sendFrames() {
    while (this._frameQueue.length)
      await this._sendFrame(this._frameQueue.shift()!);
  }

  private async _sendFrame(frame: Buffer) {
    return new Promise(f => this._process!.stdin.write(frame, f)).then(error => {
      if (error)
        this._progress.log(`ffmpeg failed to write: ${error}`);
    });
  }

  async stop() {
    if (this._isStopped)
      return;
    this.writeFrame(Buffer.from([]), this._lastFrameTimestamp + (monotonicTime() - this._lastWriteTimestamp) / 1000);
    this._isStopped = true;
    await this._lastWritePromise;
    await this._gracefullyClose!();
  }
}
