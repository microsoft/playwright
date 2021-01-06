/**
 * Copyright (c) Microsoft Corporation.
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
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { TraceModel, videoById, VideoMetaInfo } from './traceModel';
import type { PageVideoTraceEvent } from '../../trace/traceTypes';
import { ffmpegExecutable } from '../../utils/binaryPaths';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

export class VideoTileGenerator {
  private _traceModel: TraceModel;

  constructor(traceModel: TraceModel) {
    this._traceModel = traceModel;
  }

  tilePath(urlPath: string) {
    const index = urlPath.lastIndexOf('/');
    const tile = urlPath.substring(index + 1);
    const videoId = urlPath.substring(0, index);
    const { context, page } = videoById(this._traceModel, videoId);
    const videoFilePath = path.join(path.dirname(context.filePath), page.video!.video.fileName);
    return videoFilePath + '-' + tile;
  }

  async render(videoId: string): Promise<VideoMetaInfo | undefined> {
    const { context, page } = videoById(this._traceModel, videoId);
    const video = page.video!.video;
    const videoFilePath = path.join(path.dirname(context.filePath), video.fileName);
    const metaInfoFilePath = videoFilePath + '-metainfo.txt';
    try {
      const metaInfo = await fsReadFileAsync(metaInfoFilePath, 'utf8');
      return metaInfo ? JSON.parse(metaInfo) : undefined;
    } catch (e) {
    }

    const ffmpeg = ffmpegExecutable()!;
    console.log('Generating frames for ' + videoFilePath); // eslint-disable-line no-console
    // Force output frame rate to 25 fps as otherwise it would produce one image per timebase unit
    // which is currently 1 / (25 * 1000).
    const result = spawnSync(ffmpeg, ['-i', videoFilePath, '-r', '25', `${videoFilePath}-%03d.png`]);
    const metaInfo = parseMetaInfo(result.stderr.toString(), video);
    await fsWriteFileAsync(metaInfoFilePath, metaInfo ? JSON.stringify(metaInfo) : '');
    return metaInfo;
  }
}

function parseMetaInfo(text: string, video: PageVideoTraceEvent): VideoMetaInfo | undefined {
  const lines = text.split('\n');
  let framesLine = lines.find(l => l.startsWith('frame='));
  if (!framesLine)
    return;
  framesLine = framesLine.substring(framesLine.lastIndexOf('frame='));
  const framesMatch = framesLine.match(/frame=\s+(\d+)/);
  const outputLineIndex = lines.findIndex(l => l.trim().startsWith('Output #0'));
  const streamLine = lines.slice(outputLineIndex).find(l => l.trim().startsWith('Stream #0:0'))!;
  const fpsMatch = streamLine.match(/, (\d+) fps,/);
  const resolutionMatch = streamLine.match(/, (\d+)x(\d+)\D/);
  const durationMatch = lines.find(l => l.trim().startsWith('Duration'))!.match(/Duration: (\d+):(\d\d):(\d\d.\d\d)/);
  const duration = (((parseInt(durationMatch![1], 10) * 60) + parseInt(durationMatch![2], 10)) * 60 + parseFloat(durationMatch![3])) * 1000;
  return {
    frames: parseInt(framesMatch![1], 10),
    width: parseInt(resolutionMatch![1], 10),
    height: parseInt(resolutionMatch![2], 10),
    fps: parseInt(fpsMatch![1], 10),
    startTime: (video as any).timestamp,
    endTime: (video as any).timestamp + duration
  };
}
