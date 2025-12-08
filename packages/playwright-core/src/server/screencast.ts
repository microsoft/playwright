/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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
import { assert, createGuid, mkdirIfNeeded } from '../utils';
import { debugLogger } from '../utils';
import { VideoRecorder } from './videoRecorder';
import { Page } from './page';
import { registry } from './registry';

import type * as types from './types';

export class Screencast {
  private _page: Page;
  private _videoRecorder: VideoRecorder | null = null;
  private _screencastId: string | null = null;
  private _screencastClients = new Set<unknown>();

  // Aiming at 25 fps by default - each frame is 40ms, but we give some slack with 35ms.
  // When throttling for tracing, 200ms between frames, except for 10 frames around the action.
  private _frameThrottler = new FrameThrottler(10, 35, 200);

  constructor(page: Page) {
    this._page = page;
  }

  stopFrameThrottler() {
    this._frameThrottler.dispose();
  }

  setOptions(options: { width: number, height: number, quality: number } | null) {
    this._setOptions(options).catch(e => debugLogger.log('error', e));
    this._frameThrottler.setThrottlingEnabled(!!options);
  }

  throttleScreencastFrameAck(ack: () => void) {
    // Don't ack immediately, tracing has smart throttling logic that is implemented here.
    this._frameThrottler.ack(ack);
  }

  temporarilyDisableTracingScreencastThrottling() {
    this._frameThrottler.recharge();
  }

  async initializeVideoRecorder(): Promise<types.PageScreencastOptions | undefined> {
    const recordVideo = this._page.browserContext._options.recordVideo;
    if (!recordVideo)
      return undefined;
    const screencastId = createGuid();
    const outputFile = path.join(recordVideo.dir, screencastId + '.webm');
    const screencastOptions = {
      // validateBrowserContextOptions ensures correct video size.
      ...recordVideo.size!,
      outputFile,
    };
    await mkdirIfNeeded(path.join(recordVideo.dir, 'dummy'));
    // Note: it is important to start video recorder before sending Screencast.startScreencast,
    // and it is equally important to send Screencast.startScreencast before sending Target.resume.
    await this._createVideoRecorder(screencastId, screencastOptions);
    this._page.waitForInitializedOrError().then(p => {
      if (p instanceof Error)
        this.stopVideoRecording().catch(() => {});
    });
    return screencastOptions;
  }

  async startVideoRecording(options: types.PageScreencastOptions) {
    const screencastId = this._screencastId;
    assert(screencastId);
    this._page.once(Page.Events.Close, () => this.stopVideoRecording().catch(() => {}));
    const gotFirstFrame = new Promise(f => this._page.once(Page.Events.ScreencastFrame, f));
    await this._startScreencast(this._videoRecorder, {
      quality: 90,
      width: options.width,
      height: options.height,
    });
    // Wait for the first frame before reporting video to the client.
    gotFirstFrame.then(() => {
      this._page.browserContext._browser._videoStarted(this._page.browserContext, screencastId, options.outputFile, this._page.waitForInitializedOrError());
    });
  }

  async stopVideoRecording(): Promise<void> {
    if (!this._screencastId)
      return;
    const screencastId = this._screencastId;
    this._screencastId = null;
    const recorder = this._videoRecorder!;
    this._videoRecorder = null;
    await this._stopScreencast(recorder);
    await recorder.stop().catch(() => {});
    // Keep the video artifact in the map until encoding is fully finished, if the context
    // starts closing before the video is fully written to disk it will wait for it.
    const video = this._page.browserContext._browser._takeVideo(screencastId);
    video?.reportFinished();
  }

  private async _setOptions(options: { width: number, height: number, quality: number } | null): Promise<void> {
    if (options)
      await this._startScreencast(this, options);
    else
      await this._stopScreencast(this);
  }

  private async _startScreencast(client: unknown, options: { width: number, height: number, quality: number }) {
    this._screencastClients.add(client);
    if (this._screencastClients.size === 1) {
      await this._page.delegate.startScreencast({
        width: options.width,
        height: options.height,
        quality: options.quality,
      });
    }
  }

  private async _stopScreencast(client: unknown) {
    this._screencastClients.delete(client);
    if (!this._screencastClients.size)
      await this._page.delegate.stopScreencast();
  }

  private async _createVideoRecorder(screencastId: string, options: types.PageScreencastOptions): Promise<void> {
    assert(!this._screencastId);
    const ffmpegPath = registry.findExecutable('ffmpeg')!.executablePathOrDie(this._page.browserContext._browser.sdkLanguage());
    this._videoRecorder = await VideoRecorder.launch(this._page, ffmpegPath, options);
    this._screencastId = screencastId;
  }
}

class FrameThrottler {
  private _acks: (() => void)[] = [];
  private _defaultInterval: number;
  private _throttlingInterval: number;
  private _nonThrottledFrames: number;
  private _budget: number;
  private _throttlingEnabled = false;
  private _timeoutId: NodeJS.Timeout | undefined;

  constructor(nonThrottledFrames: number, defaultInterval: number, throttlingInterval: number) {
    this._nonThrottledFrames = nonThrottledFrames;
    this._budget = nonThrottledFrames;
    this._defaultInterval = defaultInterval;
    this._throttlingInterval = throttlingInterval;
    this._tick();
  }

  dispose() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = undefined;
    }
  }

  setThrottlingEnabled(enabled: boolean) {
    this._throttlingEnabled = enabled;
  }

  recharge() {
    // Send all acks, reset budget.
    for (const ack of this._acks)
      ack();
    this._acks = [];
    this._budget = this._nonThrottledFrames;
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._tick();
    }
  }

  ack(ack: () => void) {
    if (!this._timeoutId) {
      // Already disposed.
      ack();
      return;
    }
    this._acks.push(ack);
  }

  private _tick() {
    const ack = this._acks.shift();
    if (ack) {
      --this._budget;
      ack();
    }

    if (this._throttlingEnabled && this._budget <= 0) {
      // Non-throttled frame budget is exceeded. Next ack will be throttled.
      this._timeoutId = setTimeout(() => this._tick(), this._throttlingInterval);
    } else {
      // Either not throttling, or still under budget. Next ack will be after the default timeout.
      this._timeoutId = setTimeout(() => this._tick(), this._defaultInterval);
    }
  }
}
