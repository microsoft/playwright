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

import { assert, debugLogger, mkdirIfNeeded, monotonicTime } from '../utils';
import { launchProcess } from './utils/processLauncher';
import { jpegjs } from '../utilsBundle';

import type * as types from './types';
import type { ChildProcess } from 'child_process';

const fps = 25;

export class VideoRecorder {
  private _options: types.VideoOptions;
  private _process: ChildProcess | null = null;
  private _gracefullyClose: (() => Promise<void>) | null = null;
  private _lastWritePromise: Promise<void> = Promise.resolve();
  private _firstFrameTimestamp: number = 0;
  private _lastFrame: { timestamp: number, frameNumber: number, buffer: Buffer } | null = null;
  private _lastWriteNodeTime: number = 0;
  private _frameQueue: Buffer[] = [];
  private _isStopped = false;
  private _ffmpegPath: string;
  private _launchPromise: Promise<Error | null>;

  constructor(ffmpegPath: string, options: types.VideoOptions) {
    this._ffmpegPath = ffmpegPath;
    if (!options.outputFile.endsWith('.webm'))
      throw new Error('File must have .webm extension');
    this._options = options;
    this._launchPromise = this._launch().catch(e => e);
  }

  private async _launch() {
    await mkdirIfNeeded(this._options.outputFile);
    // How to tune the codec:
    // 1. Read vp8 documentation to figure out the options.
    //   https://www.webmproject.org/docs/encoder-parameters/
    // 2. Use the following command to map the options to ffmpeg arguments.
    //   $ ./third_party/ffmpeg/ffmpeg-mac -h encoder=vp8
    // 3. A bit more about passing vp8 options to ffmpeg.
    //   https://trac.ffmpeg.org/wiki/Encode/VP8
    // 4. Tuning for VP9:
    //   https://developers.google.com/media/vp9/live-encoding
    //
    // How to stress-test video recording (runs 10 recorders in parallel to book all cpus available):
    //   $ node ./utils/video_stress.js
    //
    // We use the following vp8 options:
    //   "-qmin 0 -qmax 50" - quality variation from 0 to 50.
    //     Suggested here: https://trac.ffmpeg.org/wiki/Encode/VP8
    //   "-crf 8" - constant quality mode, 4-63, lower means better quality.
    //   "-deadline realtime -speed 8" - do not use too much cpu to keep up with incoming frames.
    //   "-b:v 1M" - video bitrate. Default value is too low for vp8
    //     Suggested here: https://trac.ffmpeg.org/wiki/Encode/VP8
    //   Note that we can switch to "-qmin 20 -qmax 50 -crf 30" for smaller video size but worse quality.
    //
    // We use "pad" and "crop" video filters (-vf option) to resize incoming frames
    // that might be of the different size to the desired video size.
    //   https://ffmpeg.org/ffmpeg-filters.html#pad-1
    //   https://ffmpeg.org/ffmpeg-filters.html#crop
    //
    // We use "image2pipe" mode to pipe frames and get a single video - https://trac.ffmpeg.org/wiki/Slideshow
    //   "-f image2pipe -c:v mjpeg -i -" forces input to be read from standard input, and forces
    //     mjpeg input image format.
    //   "-avioflags direct" reduces general buffering.
    //   "-fpsprobesize 0 -probesize 32 -analyzeduration 0" reduces initial buffering
    //     while analyzing input fps and other stats.
    //
    // "-y" means overwrite output.
    // "-an" means no audio.
    // "-threads 1" means using one thread. This drastically reduces stalling when
    //   cpu is overbooked. By default vp8 tries to use all available threads?

    const w = this._options.width;
    const h = this._options.height;
    const args = `-loglevel error -f image2pipe -avioflags direct -fpsprobesize 0 -probesize 32 -analyzeduration 0 -c:v mjpeg -i pipe:0 -y -an -r ${fps} -c:v vp8 -qmin 0 -qmax 50 -crf 8 -deadline realtime -speed 8 -b:v 1M -threads 1 -vf pad=${w}:${h}:0:0:gray,crop=${w}:${h}:0:0`.split(' ');
    args.push(this._options.outputFile);

    const { launchedProcess, gracefullyClose } = await launchProcess({
      command: this._ffmpegPath,
      args,
      stdio: 'stdin',
      log: (message: string) => debugLogger.log('browser', message),
      tempDirectories: [],
      attemptToGracefullyClose: async () => {
        debugLogger.log('browser', 'Closing stdin...');
        launchedProcess.stdin!.end();
      },
      onExit: (exitCode, signal) => {
        debugLogger.log('browser', `ffmpeg onkill exitCode=${exitCode} signal=${signal}`);
      },
    });
    launchedProcess.stdin!.on('finish', () => {
      debugLogger.log('browser', 'ffmpeg finished input.');
    });
    launchedProcess.stdin!.on('error', () => {
      debugLogger.log('browser', 'ffmpeg error.');
    });
    this._process = launchedProcess;
    this._gracefullyClose = gracefullyClose;
  }

  writeFrame(frame: Buffer, timestamp: number) {
    this._launchPromise.then(error => {
      if (error)
        return;
      this._writeFrame(frame, timestamp);
    });
  }

  private _writeFrame(frame: Buffer, timestamp: number) {
    assert(this._process);
    if (this._isStopped)
      return;

    if (!this._firstFrameTimestamp)
      this._firstFrameTimestamp = timestamp;

    const frameNumber = Math.floor((timestamp - this._firstFrameTimestamp) * fps);

    if (this._lastFrame) {
      const repeatCount = frameNumber - this._lastFrame.frameNumber;
      for (let i = 0; i < repeatCount; ++i)
        this._frameQueue.push(this._lastFrame.buffer);
      this._lastWritePromise = this._lastWritePromise.then(() => this._sendFrames());
    }

    this._lastFrame = { buffer: frame, timestamp, frameNumber };
    this._lastWriteNodeTime = monotonicTime();
  }

  private async _sendFrames() {
    while (this._frameQueue.length)
      await this._sendFrame(this._frameQueue.shift()!);
  }

  private async _sendFrame(frame: Buffer) {
    return new Promise(f => this._process!.stdin!.write(frame, f)).then(error => {
      if (error)
        debugLogger.log('browser', `ffmpeg failed to write: ${String(error)}`);
    });
  }

  async stop() {
    // Only report the error on stop. This allows to make the constructor synchronous.
    const error = await this._launchPromise;
    if (error)
      throw error;
    if (this._isStopped)
      return;
    if (!this._lastFrame) {
      // ffmpeg only creates a file upon some non-empty input
      this._writeFrame(createWhiteImage(this._options.width, this._options.height), monotonicTime());
    }
    // Pad with at least 1s of the last frame in the end for convenience.
    // This also ensures non-empty videos with 1 frame.
    const addTime = Math.max((monotonicTime() - this._lastWriteNodeTime) / 1000, 1);
    this._writeFrame(Buffer.from([]), this._lastFrame!.timestamp + addTime);
    this._isStopped = true;
    try {
      await this._lastWritePromise;
      await this._gracefullyClose!();
    } catch (e) {
      debugLogger.log('error', `ffmpeg failed to stop: ${String(e)}`);
    }
  }
}

function createWhiteImage(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 4, 255);
  return jpegjs.encode({ data, width, height }, 80).data;
}
