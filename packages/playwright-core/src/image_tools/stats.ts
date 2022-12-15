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

import type { ImageChannel } from './imageChannel';

export interface Stats {
  c1: ImageChannel;
  c2: ImageChannel;

  // Compute mean value. See https://en.wikipedia.org/wiki/Mean
  meanC1(x1: number, y1: number, x2: number, y2: number): number;
  meanC2(x1: number, y1: number, x2: number, y2: number): number;
  // Compute **population** (not sample) variance. See https://en.wikipedia.org/wiki/Variance
  varianceC1(x1: number, y1: number, x2: number, y2: number): number;
  varianceC2(x1: number, y1: number, x2: number, y2: number): number;
  // Compute covariance. See https://en.wikipedia.org/wiki/Covariance
  covariance(x1: number, y1: number, x2: number, y2: number): number;
}

// Image channel has a 8-bit depth.
const DYNAMIC_RANGE = 2 ** 8 - 1;

export function ssim(stats: Stats, x1: number, y1: number, x2: number, y2: number): number {
  const mean1 = stats.meanC1(x1, y1, x2, y2);
  const mean2 = stats.meanC2(x1, y1, x2, y2);
  const var1 = stats.varianceC1(x1, y1, x2, y2);
  const var2 = stats.varianceC2(x1, y1, x2, y2);
  const cov = stats.covariance(x1, y1, x2, y2);
  const c1 = (0.01 * DYNAMIC_RANGE) ** 2;
  const c2 = (0.03 * DYNAMIC_RANGE) ** 2;
  return (2 * mean1 * mean2 + c1) * (2 * cov + c2) / (mean1 ** 2 + mean2 ** 2 + c1) / (var1 + var2 + c2);
}

export class FastStats implements Stats {
  c1: ImageChannel;
  c2: ImageChannel;

  private _partialSumC1: number[];
  private _partialSumC2: number[];
  private _partialSumMult: number[];
  private _partialSumSq1: number[];
  private _partialSumSq2: number[];

  constructor(c1: ImageChannel, c2: ImageChannel) {
    this.c1 = c1;
    this.c2 = c2;
    const { width, height } = c1;

    this._partialSumC1 = new Array(width * height);
    this._partialSumC2 = new Array(width * height);
    this._partialSumSq1 = new Array(width * height);
    this._partialSumSq2 = new Array(width * height);
    this._partialSumMult = new Array(width * height);

    const recalc = (mx: number[], idx: number, initial: number, x: number, y: number) => {
      mx[idx] = initial;
      if (y > 0)
        mx[idx] += mx[(y - 1) * width + x];
      if (x > 0)
        mx[idx] += mx[y * width + x - 1];
      if (x > 0 && y > 0)
        mx[idx] -= mx[(y - 1) * width + x - 1];
    };

    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        const idx = y * width + x;
        recalc(this._partialSumC1, idx, this.c1.data[idx], x, y);
        recalc(this._partialSumC2, idx, this.c2.data[idx], x, y);
        recalc(this._partialSumSq1, idx, this.c1.data[idx] * this.c1.data[idx], x, y);
        recalc(this._partialSumSq2, idx, this.c2.data[idx] * this.c2.data[idx], x, y);
        recalc(this._partialSumMult, idx, this.c1.data[idx] * this.c2.data[idx], x, y);
      }
    }
  }

  _sum(partialSum: number[], x1: number, y1: number, x2: number, y2: number): number {
    const width = this.c1.width;
    let result = partialSum[y2 * width + x2];
    if (y1 > 0)
      result -= partialSum[(y1 - 1) * width + x2];
    if (x1 > 0)
      result -= partialSum[y2 * width + x1 - 1];
    if (x1 > 0 && y1 > 0)
      result += partialSum[(y1 - 1) * width + x1 - 1];
    return result;
  }

  meanC1(x1: number, y1: number, x2: number, y2: number): number {
    const N = (y2 - y1 + 1) * (x2 - x1 + 1);
    return this._sum(this._partialSumC1, x1, y1, x2, y2) / N;
  }

  meanC2(x1: number, y1: number, x2: number, y2: number): number {
    const N = (y2 - y1 + 1) * (x2 - x1 + 1);
    return this._sum(this._partialSumC2, x1, y1, x2, y2) / N;
  }

  varianceC1(x1: number, y1: number, x2: number, y2: number): number {
    const N = (y2 - y1 + 1) * (x2 - x1 + 1);
    return (this._sum(this._partialSumSq1, x1, y1, x2, y2) - (this._sum(this._partialSumC1, x1, y1, x2, y2) ** 2) / N) / N;
  }

  varianceC2(x1: number, y1: number, x2: number, y2: number): number {
    const N = (y2 - y1 + 1) * (x2 - x1 + 1);
    return (this._sum(this._partialSumSq2, x1, y1, x2, y2) - (this._sum(this._partialSumC2, x1, y1, x2, y2) ** 2) / N) / N;
  }

  covariance(x1: number, y1: number, x2: number, y2: number): number {
    const N = (y2 - y1 + 1) * (x2 - x1 + 1);
    return (this._sum(this._partialSumMult, x1, y1, x2, y2) - this._sum(this._partialSumC1, x1, y1, x2, y2) * this._sum(this._partialSumC2, x1, y1, x2, y2) / N) / N;
  }
}

