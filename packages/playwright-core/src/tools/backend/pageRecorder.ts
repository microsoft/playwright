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
import { Transform } from 'stream';
import { finished } from 'stream/promises';

import jpegjs from 'jpeg-js';
import { debugLogger } from '@utils/debugLogger';
import { mkdirIfNeeded } from '@utils/fileUtils';
import { monotonicTime } from '@isomorphic/time';
import { EbmlStreamParser } from '@utils/ebmlParser';
import { launchProcess } from '@utils/processLauncher';

import { registry } from '../../server/registry/index';

import type { ChildProcess } from 'child_process';
import type { ClusterMeta } from '@utils/ebmlParser';
import type { TransformCallback } from 'stream';

const fps = 25;

type Size = { width: number; height: number };

// Daemon-side video recorder. Owns one ffmpeg child per page, takes mjpeg
// frames via writeFrame (sourced from page.screencast.onFrame), and writes
// two files to recordingDir:
//   * <pageId>.webm — the encoded media (tee of ffmpeg stdout).
//   * <pageId>.cues — ndjson sidecar, one cluster per line:
//         {"startWallMs":1700000000000,"fileOffset":1024,"byteLen":2048}
//     monotonic by fileOffset and startWallMs (parser emits clusters in
//     file order). The first record's fileOffset is the size of the init
//     segment. Append-only — safe to poll-tail from the dashboard process
//     without reader/writer locks.
//
// Frame pacing and shutdown semantics are lifted verbatim from the
// server-side FfmpegVideoRecorder.
export class PageRecorder {
  private _size: Size;
  private _process: ChildProcess;
  private _gracefullyClose: () => Promise<void>;
  private _webmStream: fs.WriteStream;
  private _cuesStream: fs.WriteStream;

  private _firstFrameTimestamp: number = 0;
  private _lastFrame: { timestamp: number, frameNumber: number, buffer: Buffer } | null = null;
  private _lastWriteNodeTime: number = 0;
  private _isStopped = false;

  static async create(options: { recordingDir: string; pageId: string; size: Size }): Promise<PageRecorder> {
    const webmPath = path.join(options.recordingDir, `${options.pageId}.webm`);
    const cuesPath = path.join(options.recordingDir, `${options.pageId}.cues`);
    await mkdirIfNeeded(webmPath);
    const webmStream = fs.createWriteStream(webmPath);
    const cuesStream = fs.createWriteStream(cuesPath);
    await Promise.all([
      new Promise<void>((resolve, reject) => webmStream.once('open', () => resolve()).once('error', reject)),
      new Promise<void>((resolve, reject) => cuesStream.once('open', () => resolve()).once('error', reject)),
    ]);

    // Wallclock origin for the recording — the .cues stream below
    // converts each cluster's recorder-relative timecode to wallclock by
    // adding this. Captured before ffmpeg starts so it covers the whole
    // stream.
    const originWallMs = Date.now();

    const w = options.size.width;
    const h = options.size.height;
    // VP8 args copied verbatim from server/videoRecorder.ts, plus:
    //   -cluster_time_limit 1000  ~1s cluster cadence (seek granularity).
    //   -g 50                     keyframe every ~2s @ 25fps (so seeks land on
    //                             a decodable cluster soon after a target time).
    //   -flush_packets 1          push every packet to stdout immediately so
    //                             the dashboard sees clusters land promptly
    //                             (without this ffmpeg buffers pipe writes).
    const args = (
      `-loglevel error -f image2pipe -avioflags direct -fpsprobesize 0 -probesize 32 -analyzeduration 0 ` +
      `-c:v mjpeg -i pipe:0 -y -an -r ${fps} -c:v vp8 -qmin 0 -qmax 50 -crf 8 -deadline realtime -speed 8 -b:v 1M -threads 1 ` +
      `-vf pad=${w}:${h}:0:0:gray,crop=${w}:${h}:0:0 ` +
      `-cluster_time_limit 1000 -g 50 -flush_packets 1 -f webm pipe:1`
    ).split(' ');

    const { launchedProcess, gracefullyClose } = await launchProcess({
      command: registry.findExecutable('ffmpeg')!.executablePathOrDie('javascript'),
      args,
      stdio: ['pipe', 'pipe', 'pipe'],
      tempDirectories: [],
      attemptToGracefullyClose: async () => {
        launchedProcess.stdin!.end();
        await new Promise<void>(resolve => launchedProcess.once('exit', () => resolve()));
      },
      onExit: (code, signal) => debugLogger.log('browser', `PageRecorder ffmpeg exit code=${code} signal=${signal}`),
      log: msg => debugLogger.log('browser', `PageRecorder ${msg}`),
    });
    launchedProcess.stdin!.on('error', e => debugLogger.log('browser', `PageRecorder ffmpeg stdin error: ${String(e)}`));
    launchedProcess.stdout!.on('error', e => debugLogger.log('browser', `PageRecorder ffmpeg stdout error: ${String(e)}`));

    launchedProcess.stdout!.pipe(webmStream);
    launchedProcess.stdout!.pipe(new CueStream(originWallMs)).pipe(cuesStream);

    return new PageRecorder(options.size, launchedProcess, gracefullyClose, webmStream, cuesStream);
  }

  private constructor(size: Size, process: ChildProcess, gracefullyClose: () => Promise<void>, webmStream: fs.WriteStream, cuesStream: fs.WriteStream) {
    this._size = size;
    this._process = process;
    this._gracefullyClose = gracefullyClose;
    this._webmStream = webmStream;
    this._cuesStream = cuesStream;
  }

  writeFrame(frame: Buffer, wallTimeMs: number): void {
    if (this._isStopped)
      return;
    // wallTimeMs is the page.screencast onFrame frameSwapWallTime (ms).
    // ffmpeg expects seconds for our pacing math.
    const timestamp = wallTimeMs / 1000;

    if (!this._firstFrameTimestamp)
      this._firstFrameTimestamp = timestamp;

    const frameNumber = Math.floor((timestamp - this._firstFrameTimestamp) * fps);

    if (this._lastFrame) {
      // Pad with the previous frame so ffmpeg sees a steady fps stream.
      // TODO: we could replace the steady-fps padding entirely by sending
      // mkv-wrapped frames with explicit timestamps (so ffmpeg doesn't
      // need image2pipe + repeated frames to fill gaps).
      const repeatCount = frameNumber - this._lastFrame.frameNumber;
      const stdin = this._process.stdin!;
      for (let i = 0; i < repeatCount; ++i) {
        stdin.write(this._lastFrame.buffer, error => {
          if (error)
            debugLogger.log('browser', `PageRecorder ffmpeg failed to write: ${String(error)}`);
        });
      }
    }

    this._lastFrame = { buffer: frame, timestamp, frameNumber };
    this._lastWriteNodeTime = monotonicTime();
  }

  async stop(): Promise<void> {
    if (this._isStopped)
      return;
    if (!this._lastFrame) {
      // ffmpeg only emits any output upon non-empty input.
      this.writeFrame(createWhiteImage(this._size.width, this._size.height), monotonicTime() * 1000);
    }
    // Pad with at least 1s of the last frame
    const addTime = Math.max((monotonicTime() - this._lastWriteNodeTime) / 1000, 1);
    this.writeFrame(Buffer.from([]), (this._lastFrame!.timestamp + addTime) * 1000);
    this._isStopped = true;
    try {
      await this._gracefullyClose();
    } catch (e) {
      debugLogger.log('error', `PageRecorder ffmpeg failed to stop: ${String(e)}`);
    }
    await Promise.allSettled([
      finished(this._webmStream),
      finished(this._cuesStream),
    ]);
  }
}

function createWhiteImage(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 4, 255);
  return jpegjs.encode({ data, width, height }, 80).data;
}

class CueStream extends Transform {
  constructor(originWallMs: number) {
    const parser = new EbmlStreamParser({
      onInit: () => {},
      onCluster: (cluster: ClusterMeta) => this.push(JSON.stringify({
        startWallMs: originWallMs + (cluster.timecodeMs ?? 0),
        fileOffset: cluster.fileOffset,
        byteLen: cluster.byteLen,
      }) + '\n'),
    });
    super({
      transform(chunk: Buffer, _: BufferEncoding, cb: TransformCallback) {
        try { parser.feed(chunk); cb(); } catch (e) { cb(e as Error); }
      },
      flush(cb: TransformCallback) {
        try { parser.end(); cb(); } catch (e) { cb(e as Error); }
      },
    });
  }
}
