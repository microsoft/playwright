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

import path from 'path';

import jpegjs from 'jpeg-js';
import { launchProcess } from '@utils/processLauncher';
import { assert } from '@isomorphic/assert';
import { createGuid } from '@utils/crypto';
import { debugLogger } from '@utils/debugLogger';
import { mkdirIfNeeded } from '@utils/fileUtils';
import { monotonicTime } from '@isomorphic/time';
import { Artifact } from './artifact';
import { writeClusterHeader, writeHeader } from './ebml';
import { registry } from './registry';

import type * as types from './types';
import type { ChildProcess } from 'child_process';
import type { Screencast, ScreencastClient } from './screencast';
import type { Page } from './page';

const fps = 25;

export class VideoRecorder {
  private _screencast: Screencast;
  private _videoRecorder: FfmpegVideoRecorder | undefined;
  private _client: ScreencastClient | undefined;
  private _artifact: Artifact | undefined;

  constructor(screencast: Screencast) {
    this._screencast = screencast;
  }

  start(options: { fileName?: string, size?: { width: number, height: number } }) {
    assert(!this._artifact);
    // Do this first, it likes to throw.
    const ffmpegPath = registry.findExecutable('ffmpeg')!.executablePathOrDie(this._screencast.page.browserContext._browser.sdkLanguage());
    const outputFile = options.fileName ?? path.join(this._screencast.page.browserContext._browser.options.artifactsDir, createGuid() + '.webm');

    this._client = {
      onFrame: frame => this._videoRecorder!.writeFrame(frame.buffer, frame.frameSwapWallTime / 1000),
      gracefulClose: () => this.stop(),
      dispose: () => this.stop().catch(e => debugLogger.log('error', `Failed to stop video recorder: ${String(e)}`)),
      size: options.size,
    };

    const { size } = this._screencast.addClient(this._client);
    // For video files only, prioritize encoding into the given size, regardless of the actual pixel data.
    const videoSize = options.size ?? size;
    this._videoRecorder = new FfmpegVideoRecorder(ffmpegPath, videoSize, outputFile);
    this._artifact = new Artifact(this._screencast.page.browserContext, outputFile);
    return this._artifact;
  }

  async stop() {
    if (!this._artifact)
      return;

    const artifact = this._artifact;
    this._artifact = undefined;
    const client = this._client!;
    this._client = undefined;
    const videoRecorder = this._videoRecorder!;
    this._videoRecorder = undefined;

    this._screencast.removeClient(client);
    await videoRecorder._stop();
    await artifact.reportFinished();
  }
}

// Note: it is important to start video recorder before sending Screencast.startScreencast,
// and it is equally important to send Screencast.startScreencast before sending Target.resume.
export function startAutomaticVideoRecording(page: Page) {
  const recordVideo = page.browserContext._options.recordVideo;
  if (!recordVideo)
    return;
  const recorder = new VideoRecorder(page.screencast);
  if (page.browserContext._options.recordVideo?.showActions)
    page.screencast.showActions(page.browserContext._options.recordVideo?.showActions);
  const dir = recordVideo.dir ?? page.browserContext._browser.options.artifactsDir;
  const artifact = recorder.start({ size: recordVideo.size, fileName: path.join(dir, page.guid + '.webm') });
  page.video = artifact;
}

class FfmpegVideoRecorder {
  private _size: types.Size;
  private _process: ChildProcess | null = null;
  private _gracefullyClose: (() => Promise<void>) | null = null;
  private _firstFrameTimestamp: number = 0;
  private _lastFrame: { timestamp: number, frameNumber: number, buffer: Buffer } | null = null;
  private _lastWriteNodeTime: number = 0;
  private _isStopped = false;
  private _ffmpegPath: string;
  private _launchPromise: Promise<Error | null>;
  private _outputFile: string;

  constructor(ffmpegPath: string, size: types.Size, outputFile: string) {
    if (!outputFile.endsWith('.webm'))
      throw new Error('File must have .webm extension');
    this._outputFile = outputFile;
    this._ffmpegPath = ffmpegPath;
    this._size = size;
    this._launchPromise = this._launch().catch(e => e);
  }

  private async _launch() {
    await mkdirIfNeeded(this._outputFile);
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
    // We use "scale" and "pad" video filters (-vf option) to resize incoming frames
    // that might be of a different size to the desired video size.
    //   https://ffmpeg.org/ffmpeg-filters.html#scale
    //   https://ffmpeg.org/ffmpeg-filters.html#pad-1
    //
    // We wrap each incoming MJPEG frame into a minimal Matroska stream (see ./ebml.ts) with an
    // explicit timestamp, and let ffmpeg read frame timing from that stream.
    //   "-f matroska -i pipe:0" forces input to be read from standard input as Matroska.
    //   "-fpsprobesize 0 -probesize 32 -analyzeduration 0" reduces initial buffering
    //     while analyzing input fps and other stats.
    //   Note: "-avioflags direct" must NOT be used here - it breaks Matroska header parsing
    //     by disabling the input buffering the demuxer needs.
    //
    // "-y" means overwrite output.
    // "-an" means no audio.
    // "-r 25" forces a constant output frame rate; ffmpeg duplicates frames as needed based on
    //   the input timestamps, so we don't have to repeat frames ourselves.
    // "-threads 1" means using one thread. This drastically reduces stalling when
    //   cpu is overbooked. By default vp8 tries to use all available threads?

    const w = this._size.width;
    const h = this._size.height;
    const args = `-loglevel error -f matroska -fpsprobesize 0 -probesize 32 -analyzeduration 0 -i pipe:0 -y -an -r ${fps} -c:v vp8 -qmin 0 -qmax 50 -crf 8 -deadline realtime -speed 8 -b:v 1M -threads 1 -vf scale=w='min(iw,${w})':h='min(ih,${h})':force_original_aspect_ratio=decrease:eval=frame,pad=${w}:${h}:0:0:gray`.split(' ');
    args.push(this._outputFile);

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
    launchedProcess.stdin!.write(writeHeader(w, h));
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
    if (this._lastFrame && frameNumber !== this._lastFrame.frameNumber)
      this._emitFrame(this._lastFrame.buffer, this._lastFrame.frameNumber);

    this._lastFrame = { buffer: frame, timestamp, frameNumber };
    this._lastWriteNodeTime = monotonicTime();
  }

  private _emitFrame(frame: Buffer, frameNumber: number) {
    const timestampMs = Math.max(0, Math.round(frameNumber * 1000 / fps));
    this._process!.stdin!.write(writeClusterHeader(timestampMs, frame.length));
    this._process!.stdin!.write(frame);
  }

  async _stop() {
    // Only report the error on stop. This allows to make the constructor synchronous.
    const error = await this._launchPromise;
    if (error)
      throw error;
    if (this._isStopped)
      return;
    if (!this._lastFrame) {
      // ffmpeg only creates a file upon some non-empty input.
      this._writeFrame(createWhiteImage(this._size.width, this._size.height), monotonicTime() / 1000);
    }
    // Emit the last received frame at its own slot, then repeat it at the end so it stays visible
    // for at least 1s. This also ensures non-empty videos with 1 frame and gives the output stream
    // a final timestamp.
    this._emitFrame(this._lastFrame!.buffer, this._lastFrame!.frameNumber);
    const addTime = Math.max((monotonicTime() - this._lastWriteNodeTime) / 1000, 1);
    const endFrameNumber = Math.floor((this._lastFrame!.timestamp + addTime - this._firstFrameTimestamp) * fps);
    this._emitFrame(this._lastFrame!.buffer, endFrameNumber);
    this._isStopped = true;
    try {
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
