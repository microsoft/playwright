/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import { PNG } from 'playwright-core/lib/utilsBundle';
import { registry } from '../../packages/playwright-core/lib/server';

export class VideoPlayer {
  fileName: string;
  output: string;
  duration: number;
  frames: number;
  videoWidth: number;
  videoHeight: number;
  cache = new Map<number, any>();

  constructor(fileName: string) {
    this.fileName = fileName;
    const ffmpeg = registry.findExecutable('ffmpeg')!.executablePathOrDie('javascript');
    // Force output frame rate to 25 fps as otherwise it would produce one image per timebase unit
    // which is 1 / (25 * 1000).
    this.output = spawnSync(ffmpeg, ['-i', this.fileName, '-r', '25', `${this.fileName}-%04d.png`]).stderr.toString();

    const lines = this.output.split('\n');
    let framesLine = lines.find(l => l.startsWith('frame='))!;
    if (!framesLine)
      throw new Error(`No frame data in the output:\n${this.output}`);
    framesLine = framesLine.substring(framesLine.lastIndexOf('frame='));
    const framesMatch = framesLine.match(/frame=\s+(\d+)/);
    const streamLine = lines.find(l => l.trim().startsWith('Stream #0:0'));
    const resolutionMatch = streamLine.match(/, (\d+)x(\d+),/);
    const durationMatch = lines.find(l => l.trim().startsWith('Duration'))!.match(/Duration: (\d+):(\d\d):(\d\d.\d\d)/);
    this.duration = (((parseInt(durationMatch![1], 10) * 60) + parseInt(durationMatch![2], 10)) * 60 + parseFloat(durationMatch![3])) * 1000;
    this.frames = parseInt(framesMatch![1], 10);
    this.videoWidth = parseInt(resolutionMatch![1], 10);
    this.videoHeight = parseInt(resolutionMatch![2], 10);
  }

  findFrame(framePredicate: (pixels: Buffer) => boolean, offset?: { x: number, y: number }): any |undefined {
    for (let f = 1; f <= this.frames; ++f) {
      const frame = this.frame(f, offset);
      if (framePredicate(frame.data))
        return frame;
    }
  }

  seekLastFrame(offset?: { x: number, y: number }): any {
    return this.frame(this.frames, offset);
  }

  frame(frame: number, offset = { x: 10, y: 10 }): any {
    if (!this.cache.has(frame)) {
      const gap = '0'.repeat(4 - String(frame).length);
      const buffer = fs.readFileSync(`${this.fileName}-${gap}${frame}.png`);
      this.cache.set(frame, PNG.sync.read(buffer));
    }
    const decoded = this.cache.get(frame);
    const dst = new PNG({ width: 10, height: 10 });
    PNG.bitblt(decoded, dst, offset.x, offset.y, 10, 10, 0, 0);
    return dst;
  }
}
