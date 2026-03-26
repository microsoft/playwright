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
import { assert, createGuid, renderTitleForCall } from '../utils';
import { debugLogger } from '../utils';
import { VideoRecorder } from './videoRecorder';
import { Page } from './page';
import { registry } from './registry';
import { validateVideoSize } from './browserContext';

import type * as types from './types';
import type { CallMetadata, InstrumentationListener, SdkObject } from './instrumentation';

export type ScreencastListener = (frame: types.ScreencastFrame) => void;
export type ScreencastOptions = { width: number, height: number, quality: number, annotate?: types.AnnotateOptions };

export class Screencast implements InstrumentationListener {
  private _page: Page;
  private _videoRecorder: VideoRecorder | null = null;
  private _videoId: string | null = null;
  private _clients = new Map<ScreencastListener, ScreencastOptions>();
  // Aiming at 25 fps by default - each frame is 40ms, but we give some slack with 35ms.
  // When throttling for tracing, 200ms between frames, except for 10 frames around the action.
  private _frameThrottler: FrameThrottler | undefined;
  private _videoFrameListener: ScreencastListener | null = null;
  private _annotate: types.AnnotateOptions | undefined;

  constructor(page: Page) {
    this._page = page;
    this._page.instrumentation.addListener(this, page.browserContext);
  }

  dispose() {
    this._frameThrottler?.dispose();
    this._frameThrottler = undefined;
    this._page.instrumentation.removeListener(this);
  }

  startForTracing(listener: ScreencastListener) {
    this.startScreencast(listener, { width: 800, height: 800, quality: 90 }).catch(e => debugLogger.log('error', e));
    this._frameThrottler = new FrameThrottler(10, 35, 200);
  }

  stopForTracing(listener: ScreencastListener) {
    this.stopScreencast(listener).catch(e => debugLogger.log('error', e));
    this.dispose();
  }

  throttleFrameAck(ack: () => void) {
    if (!this._frameThrottler)
      ack();
    else
      this._frameThrottler.ack(ack);
  }

  temporarilyDisableThrottling() {
    this._frameThrottler?.recharge();
  }

  // Note: it is important to start video recorder before sending Screencast.startScreencast,
  // and it is equally important to send Screencast.startScreencast before sending Target.resume.
  launchAutomaticVideoRecorder(): types.VideoOptions | undefined {
    const recordVideo = this._page.browserContext._options.recordVideo;
    if (!recordVideo)
      return;
    // validateBrowserContextOptions ensures correct video size.
    const dir = recordVideo.dir ?? this._page.browserContext._browser.options.artifactsDir;
    const videoOptions = this._launchVideoRecorder(dir, recordVideo.size!);
    if (recordVideo.annotate)
      videoOptions.annotate = recordVideo.annotate;
    return videoOptions;
  }

  private _launchVideoRecorder(dir: string, size: { width: number, height: number }): types.VideoOptions {
    assert(!this._videoId);
    // Do this first, it likes to throw.
    const ffmpegPath = registry.findExecutable('ffmpeg')!.executablePathOrDie(this._page.browserContext._browser.sdkLanguage());

    this._videoId = createGuid();
    const outputFile = path.join(dir, this._videoId + '.webm');
    const videoOptions = {
      ...size,
      outputFile,
    };

    this._videoRecorder = new VideoRecorder(ffmpegPath, videoOptions);
    this._videoFrameListener = frame => this._videoRecorder!.writeFrame(frame.buffer, frame.frameSwapWallTime / 1000);
    this._page.waitForInitializedOrError().then(p => {
      if (p instanceof Error)
        this.stopVideoRecording().catch(() => {});
    });
    return videoOptions;
  }

  async startVideoRecording(options: types.VideoOptions) {
    const videoId = this._videoId;
    assert(videoId);
    this._page.once(Page.Events.Close, () => this.stopVideoRecording().catch(() => {}));
    await this.startScreencast(this._videoFrameListener!, {
      quality: 90,
      width: options.width,
      height: options.height,
      annotate: options.annotate,
    });
    return this._page.browserContext._browser._videoStarted(this._page, videoId, options.outputFile);
  }

  async stopVideoRecording(): Promise<void> {
    if (!this._videoId)
      return;
    const videoFrameListener = this._videoFrameListener!;
    this._videoFrameListener = null;
    const videoId = this._videoId;
    this._videoId = null;
    const videoRecorder = this._videoRecorder!;
    this._videoRecorder = null;
    await this.stopScreencast(videoFrameListener);
    await videoRecorder.stop();
    // Keep the video artifact in the map until encoding is fully finished, if the context
    // starts closing before the video is fully written to disk it will wait for it.
    const video = this._page.browserContext._browser._takeVideo(videoId);
    video?.reportFinished();
  }

  async startExplicitVideoRecording(options: { size?: types.Size, annotate?: types.AnnotateOptions } = {}) {
    if (this._videoId)
      throw new Error('Video is already being recorded');
    const size = validateVideoSize(options.size, this._page.emulatedSize()?.viewport);
    const videoOptions = this._launchVideoRecorder(this._page.browserContext._browser.options.artifactsDir, size);
    if (options.annotate)
      videoOptions.annotate = options.annotate;
    return await this.startVideoRecording(videoOptions);
  }

  async stopExplicitVideoRecording() {
    if (!this._videoId)
      throw new Error('Video is not being recorded');
    await this.stopVideoRecording();
  }

  async startScreencast(listener: ScreencastListener, options: ScreencastOptions) {
    this._clients.set(listener, options);
    if (!this._annotate && options.annotate)
      this._annotate = options.annotate;
    if (this._clients.size === 1)
      await this._page.delegate.startScreencast(options);
  }

  async stopScreencast(listener: ScreencastListener) {
    this._clients.delete(listener);
    if (!this._clients.size)
      await this._page.delegate.stopScreencast();
    this._annotate = Array.from(this._clients.values()).find(options => options.annotate)?.annotate;
  }

  onScreencastFrame(frame: types.ScreencastFrame) {
    for (const listener of this._clients.keys())
      listener(frame);
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata, parentId?: string): Promise<void> {
    if (!this._annotate)
      return;
    metadata.annotate = true;
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (!this._annotate)
      return;

    const page = sdkObject.attribution.page;
    if (!page)
      return;

    const actionTitle = renderTitleForCall(metadata);
    const utility = await page.mainFrame()._utilityContext();

    // Run this outside of the progress timer.
    await utility.evaluate(async options => {
      const { injected, duration } = options;
      injected.setScreencastAnnotation(options);
      await new Promise(f => injected.utils.builtins.setTimeout(f, duration));
      injected.setScreencastAnnotation(null);
    }, {
      injected: await utility.injectedScript(),
      duration: this._annotate?.duration ?? 500,
      point: metadata.point,
      box: metadata.box,
      actionTitle,
      position: this._annotate?.position,
      fontSize: this._annotate?.fontSize,
    }).catch(e => debugLogger.log('error', e));
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
