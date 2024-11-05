/* eslint-disable brace-style */
/* eslint-disable nonblock-statement-body-position */
/* eslint-disable arrow-parens */
/* eslint-disable indent */
/* eslint-disable quotes */
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
import type * as channels from "@protocol/channels";
import archiver from "archiver";
import { PassThrough } from "stream";
import type * as api from "../../types/types";
import { ChannelOwner } from "./channelOwner";

export class Tracing
  extends ChannelOwner<channels.TracingChannel>
  implements api.Tracing
{
  private _includeSources = false;
  private _stacksId: string | undefined;
  private _isTracing = false;
  private _traceBuffer: Buffer | null = null;

  static from(channel: channels.TracingChannel): Tracing {
    return (channel as any)._object;
  }

  constructor(
    parent: ChannelOwner,
    type: string,
    guid: string,
    initializer: channels.TracingInitializer
  ) {
    super(parent, type, guid, initializer);
    this.markAsInternalType();
  }

  async start(
    options: {
      name?: string;
      title?: string;
      snapshots?: boolean;
      screenshots?: boolean;
      sources?: boolean;
      _live?: boolean;
    } = {}
  ) {
    this._includeSources = !!options.sources;
    await this._channel.tracingStart({
      name: options.name,
      snapshots: options.snapshots,
      screenshots: options.screenshots,
      live: options._live,
    });
    const { traceName } = await this._channel.tracingStartChunk({
      name: options.name,
      title: options.title,
    });
    await this._startCollectingStacks(traceName);
  }

  async startChunk(options: { name?: string; title?: string } = {}) {
    const { traceName } = await this._channel.tracingStartChunk(options);
    await this._startCollectingStacks(traceName);
  }

  private async _startCollectingStacks(traceName: string) {
    if (!this._isTracing) {
      this._isTracing = true;
      this._connection.setIsTracing(true);
    }
    const result = await this._connection
      .localUtils()
      ._channel.tracingStarted({ traceName });
    this._stacksId = result.stacksId;
  }

  async stopChunk() {
    this._traceBuffer = await this._collectTraceAsBuffer();
  }

  async stop() {
    this._traceBuffer = await this._collectTraceAsBuffer();
    await this._channel.tracingStop();
  }

  private async _collectTraceAsBuffer(): Promise<Buffer> {
    const result = await this._channel.tracingStopChunk({ mode: "entries" });
    if (!result.entries) return Buffer.alloc(0);

    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Uint8Array[] = [];
    const passthrough = new PassThrough();

    archive.pipe(passthrough);
    passthrough.on("data", (chunk: Buffer) =>
      chunks.push(Uint8Array.from(chunk))
    );
    archive.on("error", (err) => {
      throw err;
    });

    result.entries.forEach((entry) => {
      archive.append(Buffer.from(entry.value), { name: entry.name });
    });

    await archive.finalize();
    return Buffer.concat(chunks);
  }

  getTraceBuffer(): Buffer | null {
    return this._traceBuffer;
  }

  _resetStackCounter() {
    if (this._isTracing) {
      this._isTracing = false;
      this._connection.setIsTracing(false);
    }
  }
}
