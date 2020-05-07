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

import { mkdtempSync, readFile, writeFile } from 'fs';
import { resolve } from 'path';
import { EventEmitter } from 'events';
import { promisify } from 'util';

const ffmpegPath: string = require('@ffmpeg-installer/ffmpeg').path;
import * as ffmpeg from 'fluent-ffmpeg';
import * as rimraf from 'rimraf';

import { Page } from './page';
import { VideoOptions } from './types';
import { logPolitely, helper } from './helper';

const FFMPEG_START_DELAY = 50;

const writeFileAsync = promisify(writeFile);
export class Video {
  public closed = false;
  private capturingPromise?: Promise<void>;
  public _tempFolder = '';
  private captureCounter = 0;
  private ffmpegProcess: ffmpeg.FfmpegCommand;
  public _keepScreenshots: boolean = false;
  public _outputFile: string = '';
  private readonly imageType = 'png' as const;
  private ffmpegProcessPromise: Promise<unknown>;
  public constructor(
    private readonly page: Page,
  ) {
    this._tempFolder = mkdtempSync(resolve(__dirname));

    this.ffmpegProcess = ffmpeg({ timeout: FFMPEG_START_DELAY }).setFfmpegPath(ffmpegPath);
    this.ffmpegProcessPromise = eventToPromise(this.ffmpegProcess, 'end');
  }
  async init(options: VideoOptions = {}) {
    this._outputFile = options.outFile || `${helper.guid()}.mp4`;
    const fps = options.FPS || 30;
    this.ffmpegProcess
        .on('end', onEnd.bind(this))
        .on('progress', onProgress)
        .on('error', onError)
        .output(this._outputFile)
        .FPS(fps)
        .addOptions(
            '-start_number',
            '0'
        );
    this._keepScreenshots = !!options.keepScreenshots;
  }


  async start() {
    this.captureCounter = 0;
    this.capturingPromise = this._capture();
  }
  async stop() {

    this.closed = true;
    await this.capturingPromise;
    this.ffmpegProcess.input(`${this._tempFolder}/image_%d.${this.imageType}`).inputFPS(1 / 6).run();
    await this.ffmpegProcessPromise;

    const path = resolve(this._outputFile);

    const buffer = await promisify(readFile)(path);
    return buffer;
  }

  private async _capture() {
    let errorTries = 0;
    while (!this.closed) {
      try {
        const frame = await this.page.screenshot({ omitBackground: true, type: this.imageType });
        await writeFileAsync(`${this._tempFolder}/image_${this.captureCounter}.${this.imageType}`, frame);
      } catch (e) {
        errorTries++;
        if (errorTries > 5) {
          this.closed = true;
          return;
        }
        continue;
      }
      this.captureCounter++;
    }
  }

}
function onError(err: Error, stdout: typeof process.stdout, stderr: typeof process.stderr) {
  logPolitely('Cannot process video: ' + err.message);
}
function onEnd(this: Video) {
  logPolitely('Finished processing file: ' + this._outputFile);

  if (!this._keepScreenshots) {
    rimraf(`${this._tempFolder}/*`, err => {
      if (err)
        logPolitely(err.message);
    });
  }
}

let timemark: any = null;
function onProgress(progress: any) {
  if (progress.timemark !== timemark) {
    timemark = progress.timemark;
    logPolitely(`Time mark: ${timemark}...`);
  }
}

function eventToPromise<T extends EventEmitter>(emitter: T, eventResolve: string, eventReject?: string) {
  return new Promise((resolve, reject) => {
    emitter.on(eventResolve, resolve);
    if (eventReject)
      emitter.on(eventReject, reject);
  });
}