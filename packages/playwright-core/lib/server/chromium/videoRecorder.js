"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VideoRecorder = void 0;
var _utils = require("../../utils");
var _page = require("../page");
var _processLauncher = require("../../utils/processLauncher");
var _progress = require("../progress");
var _instrumentation = require("../instrumentation");
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

const fps = 25;
class VideoRecorder {
  static async launch(page, ffmpegPath, options) {
    if (!options.outputFile.endsWith('.webm')) throw new Error('File must have .webm extension');
    const controller = new _progress.ProgressController((0, _instrumentation.serverSideCallMetadata)(), page);
    controller.setLogName('browser');
    return await controller.run(async progress => {
      const recorder = new VideoRecorder(page, ffmpegPath, progress);
      await recorder._launch(options);
      return recorder;
    });
  }
  constructor(page, ffmpegPath, progress) {
    this._process = null;
    this._gracefullyClose = null;
    this._lastWritePromise = Promise.resolve();
    this._lastFrameTimestamp = 0;
    this._lastFrameBuffer = null;
    this._lastWriteTimestamp = 0;
    this._progress = void 0;
    this._frameQueue = [];
    this._isStopped = false;
    this._ffmpegPath = void 0;
    this._progress = progress;
    this._ffmpegPath = ffmpegPath;
    page.on(_page.Page.Events.ScreencastFrame, frame => this.writeFrame(frame.buffer, frame.timestamp));
  }
  async _launch(options) {
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

    const w = options.width;
    const h = options.height;
    const args = `-loglevel error -f image2pipe -avioflags direct -fpsprobesize 0 -probesize 32 -analyzeduration 0 -c:v mjpeg -i - -y -an -r ${fps} -c:v vp8 -qmin 0 -qmax 50 -crf 8 -deadline realtime -speed 8 -b:v 1M -threads 1 -vf pad=${w}:${h}:0:0:gray,crop=${w}:${h}:0:0`.split(' ');
    args.push(options.outputFile);
    const progress = this._progress;
    const {
      launchedProcess,
      gracefullyClose
    } = await (0, _processLauncher.launchProcess)({
      command: this._ffmpegPath,
      args,
      stdio: 'stdin',
      log: message => progress.log(message),
      tempDirectories: [],
      attemptToGracefullyClose: async () => {
        progress.log('Closing stdin...');
        launchedProcess.stdin.end();
      },
      onExit: (exitCode, signal) => {
        progress.log(`ffmpeg onkill exitCode=${exitCode} signal=${signal}`);
      }
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
  writeFrame(frame, timestamp) {
    (0, _utils.assert)(this._process);
    if (this._isStopped) return;
    if (this._lastFrameBuffer) {
      const durationSec = timestamp - this._lastFrameTimestamp;
      const repeatCount = Math.max(1, Math.round(fps * durationSec));
      for (let i = 0; i < repeatCount; ++i) this._frameQueue.push(this._lastFrameBuffer);
      this._lastWritePromise = this._lastWritePromise.then(() => this._sendFrames());
    }
    this._lastFrameBuffer = frame;
    this._lastFrameTimestamp = timestamp;
    this._lastWriteTimestamp = (0, _utils.monotonicTime)();
  }
  async _sendFrames() {
    while (this._frameQueue.length) await this._sendFrame(this._frameQueue.shift());
  }
  async _sendFrame(frame) {
    return new Promise(f => this._process.stdin.write(frame, f)).then(error => {
      if (error) this._progress.log(`ffmpeg failed to write: ${String(error)}`);
    });
  }
  async stop() {
    if (this._isStopped) return;
    this.writeFrame(Buffer.from([]), this._lastFrameTimestamp + ((0, _utils.monotonicTime)() - this._lastWriteTimestamp) / 1000);
    this._isStopped = true;
    await this._lastWritePromise;
    await this._gracefullyClose();
  }
}
exports.VideoRecorder = VideoRecorder;