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

import { EventEmitter } from 'events';

import { jpegjs } from '../utilsBundle';
import { getActionGroup } from '../utils/isomorphic/protocolFormatter';

import type { InstrumentationListener, SdkObject } from './instrumentation';
import type * as types from './types';
import type { CallMetadata } from '@protocol/callMetadata';
import type { Page } from './page';

interface VFXEffect {
  duration: number;
  leadup: number;
  render(data: Buffer, width: number, height: number, viewportWidth: number, viewportHeight: number, time: number): void;
}

const CompositorEvent = {
  Frame: 'frame',
} as const;

type CompositorEventMap = {
  [CompositorEvent.Frame]: [frame: types.ScreencastFrame];
};

class RippleEffect implements VFXEffect {
  readonly duration = 500;
  readonly leadup = 150;

  private static readonly _r = 66;
  private static readonly _g = 133;
  private static readonly _b = 244;
  private static readonly _maxRadius = 30;

  constructor(private _x: number, private _y: number) {
  }

  render(data: Buffer, width: number, height: number, viewportWidth: number, viewportHeight: number, time: number): void {
    const progress = Math.min(Math.max(time / this.duration, 0), 1);
    const radius = progress * RippleEffect._maxRadius;
    const alpha = (1 - progress) * 0.4;

    if (alpha <= 0 || radius <= 0)
      return;

    // Scale from viewport (CSS) coordinates to frame (JPEG pixel) coordinates.
    const cx = Math.round(this._x * width / viewportWidth);
    const cy = Math.round(this._y * height / viewportHeight);
    const r2 = radius * radius;
    const outerR2 = (radius + 1.5) * (radius + 1.5);
    const innerR2 = Math.max(0, (radius - 1.5)) * Math.max(0, (radius - 1.5));

    const minX = Math.max(0, Math.floor(cx - radius - 2));
    const maxX = Math.min(width - 1, Math.ceil(cx + radius + 2));
    const minY = Math.max(0, Math.floor(cy - radius - 2));
    const maxY = Math.min(height - 1, Math.ceil(cy + radius + 2));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist2 = dx * dx + dy * dy;

        let a = 0;
        if (dist2 <= r2)
          a = alpha;
        else if (dist2 <= outerR2 && dist2 >= innerR2)
          a = alpha * 0.8;
        else
          continue;

        const idx = (y * width + x) * 4;
        data[idx] = Math.round(data[idx] * (1 - a) + RippleEffect._r * a);
        data[idx + 1] = Math.round(data[idx + 1] * (1 - a) + RippleEffect._g * a);
        data[idx + 2] = Math.round(data[idx + 2] * (1 - a) + RippleEffect._b * a);
      }
    }
  }
}

export class Compositor extends EventEmitter<CompositorEventMap> implements InstrumentationListener {
  static Events = CompositorEvent;

  private _page: Page;
  private _mode: 'recording' | 'supervision' = 'recording';
  private _effects: { effect: VFXEffect; startTime: number }[] = [];
  private _effectTimer: NodeJS.Timeout | null = null;
  private _lastFrame: { encoded: types.ScreencastFrame; decoded?: { data: Buffer; width: number; height: number } } | null = null;
  private _lastEmittedTimestamp = 0;
  private _timestampDelta = 0;

  constructor(page: Page) {
    super();
    this._page = page;
    this.setMaxListeners(0);
    this._page.browserContext.instrumentation.addListener(this, this._page.browserContext);
  }

  setMode(mode: 'recording' | 'supervision') {
    this._mode = mode;
  }

  onScreencastFrame(frame: types.ScreencastFrame) {
    this._lastFrame = { encoded: frame };
    this._emitComposited(frame.frameSwapWallTime + this._timestampDelta);
    this._scheduleEffectTimer();
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (metadata.internal)
      return;
    if (metadata.pageId && metadata.pageId !== this._page.guid)
      return;
    if (getActionGroup(metadata) === 'getter')
      return;
    if (!metadata.point)
      return;

    const effect = new RippleEffect(metadata.point.x, metadata.point.y);
    const active = { effect, startTime: 0 };
    this._effects.push(active);

    if (this._mode === 'recording')
      this._drainForRecording(active);
    else
      await new Promise<void>(resolve => setTimeout(resolve, effect.leadup));
  }

  private _renderEffects(timestamp: number) {
    for (const e of this._effects) {
      if (e.startTime === 0)
        e.startTime = timestamp;
    }
    this._effects = this._effects.filter(e => timestamp < e.startTime + e.effect.duration);
    if (!this._effects.length)
      return;

    const lastFrame = this._lastFrame!;
    if (!lastFrame.decoded)
      lastFrame.decoded = jpegjs.decode(lastFrame.encoded.buffer);
    const decoded = lastFrame.decoded;

    // TODO: restore only affected pixels to prevent cloning the entire buffer.
    const composited = Buffer.from(decoded.data);
    for (const e of this._effects)
      e.effect.render(composited, decoded.width, decoded.height, this._lastFrame!.encoded.width, this._lastFrame!.encoded.height, timestamp - e.startTime);
    return jpegjs.encode({ data: composited, width: decoded.width, height: decoded.height }, 90).data;
  }

  private _drainForRecording(active: { effect: VFXEffect; startTime: number }) {
    if (!this._lastFrame)
      return;

    const timestampBefore = this._lastEmittedTimestamp;

    // Emit the last real frame with the new effect applied.
    this._emitComposited(this._lastEmittedTimestamp);

    // Emit synthetic frames at ~60fps to animate the effect lead-up.
    const deadline = this._lastEmittedTimestamp + active.effect.leadup;
    while (this._effects.length && this._lastEmittedTimestamp < deadline) {
      this._lastEmittedTimestamp += 16;
      const encoded = this._renderEffects(this._lastEmittedTimestamp);
      if (!encoded)
        break;
      this.emit(Compositor.Events.Frame, {
        buffer: encoded,
        width: this._lastFrame.encoded.width,
        height: this._lastFrame.encoded.height,
        frameSwapWallTime: this._lastEmittedTimestamp,
      });
    }

    // Shift future real frame timestamps forward so they don't overlap with the synthetic ones.
    this._timestampDelta += this._lastEmittedTimestamp - timestampBefore;
  }

  private _emitComposited(timestamp: number) {
    const frame = this._lastFrame!.encoded;
    const encoded = this._effects.length ? this._renderEffects(timestamp) : undefined;
    this._lastEmittedTimestamp = timestamp;
    this.emit(Compositor.Events.Frame, {
      buffer: encoded ?? frame.buffer,
      width: frame.width,
      height: frame.height,
      frameSwapWallTime: timestamp,
    });
  }

  private _scheduleEffectTimer() {
    if (this._effectTimer)
      clearTimeout(this._effectTimer);
    this._effectTimer = null;
    if (!this._effects.length)
      return;
    if (!this.listenerCount(Compositor.Events.Frame))
      return;
    this._effectTimer = setTimeout(() => this._rerenderFrame(), 16);
  }

  private _rerenderFrame() {
    this._effectTimer = null;
    if (!this.listenerCount(Compositor.Events.Frame))
      return;
    if (!this._lastFrame)
      return;
    this._lastEmittedTimestamp += 16;
    this._emitComposited(this._lastEmittedTimestamp);
    this._scheduleEffectTimer();
  }

  dispose() {
    if (this._effectTimer)
      clearTimeout(this._effectTimer);
    this._effectTimer = null;
    this._lastFrame = null;
    this._lastEmittedTimestamp = 0;
    this._timestampDelta = 0;
    this._page.browserContext.instrumentation.removeListener(this);
  }
}
