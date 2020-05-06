import { promisify } from 'util';
import { setTimeout } from 'timers';
import { mkdtempSync, writeFileSync, rmdirSync } from 'fs';
import { resolve } from 'path';

const ffmpegPath: string = require('@ffmpeg-installer/ffmpeg').path;
import * as ffmpeg from 'fluent-ffmpeg';

import { Page } from './page';
import { logPolitely } from './helper';


const DEFAULT_OPTIONS = [
  // NOTE: don't ask confirmation for rewriting the output file
  '-y',

  // NOTE: use the time when a frame is read from the source as its timestamp
  // IMPORTANT: must be specified before configuring the source
  '-use_wallclock_as_timestamps', '1',

  // NOTE: use stdin as a source
  '-i', 'pipe:0',

  // NOTE: use the H.264 video codec
  '-c:v', 'libx264',

  // NOTE: use the 'ultrafast' compression preset
  '-preset', 'ultrafast',

  // NOTE: use the yuv420p pixel format (the most widely supported)
  '-pix_fmt', 'yuv420p',

  // NOTE: scale input frames to make the frame height divisible by 2 (yuv420p's requirement)
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',

  // NOTE: set the frame rate to 30 in the output video (the most widely supported)
  '-r', '30',
];
const FFMPEG_START_DELAY = 50;
const delay = promisify(setTimeout);

type Options = {
  FPS: 30 | 60;
  outFile: string;
};

export class Video {
  private _frames: Buffer[] = [];
  public closed = false;
  private capturingPromise?: Promise<void>;
  private tempFolder = '';
  private captureCounter = 0;
  private ffmpegCommand: ffmpeg.FfmpegCommand;
  public constructor(
    private readonly page: Page,
  ) {
    this.tempFolder = mkdtempSync(resolve(__dirname));
    this.ffmpegCommand = ffmpeg({ timeout: FFMPEG_START_DELAY })
        .on('exit', () => {
          this.captureCounter = 0;
          logPolitely('exit');
        // rmdirSync(this.tempFolder);
        }).setFfmpegPath(ffmpegPath);
  }
  async init({ FPS, outFile }: Options) {
    this.ffmpegCommand.addOptions(DEFAULT_OPTIONS).FPS(FPS).output(outFile);

    await delay(FFMPEG_START_DELAY);
  }


  async start() {
    this.captureCounter = 0;
    this.capturingPromise = this._capture();
  }
  async stop() {

    this.closed = true;

    await this.capturingPromise;
    this.ffmpegCommand
        .addInput(this.tempFolder + '/image_%d.jpeg')
        .run();
  }

  private async _capture() {
    let errorTries = 0;
    while (!this.closed) {
      try {
        const frame = await this.page.screenshot({ omitBackground: true, type: 'jpeg' });
        writeFileSync(`${this.tempFolder}/image_${this.captureCounter}.jpeg`, frame);
      } catch (e) {
        errorTries++;
        if (errorTries > 5) {
          this.closed = true;
          return;
        }
        continue;
      }
    }
  }
}