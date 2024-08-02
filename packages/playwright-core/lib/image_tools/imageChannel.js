"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ImageChannel = void 0;
var _colorUtils = require("./colorUtils");
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

class ImageChannel {
  static intoRGB(width, height, data, options = {}) {
    const {
      paddingSize = 0,
      paddingColorOdd = [255, 0, 255],
      paddingColorEven = [0, 255, 0]
    } = options;
    const newWidth = width + 2 * paddingSize;
    const newHeight = height + 2 * paddingSize;
    const r = new Uint8Array(newWidth * newHeight);
    const g = new Uint8Array(newWidth * newHeight);
    const b = new Uint8Array(newWidth * newHeight);
    for (let y = 0; y < newHeight; ++y) {
      for (let x = 0; x < newWidth; ++x) {
        const index = y * newWidth + x;
        if (y >= paddingSize && y < newHeight - paddingSize && x >= paddingSize && x < newWidth - paddingSize) {
          const offset = ((y - paddingSize) * width + (x - paddingSize)) * 4;
          const alpha = data[offset + 3] === 255 ? 1 : data[offset + 3] / 255;
          r[index] = (0, _colorUtils.blendWithWhite)(data[offset], alpha);
          g[index] = (0, _colorUtils.blendWithWhite)(data[offset + 1], alpha);
          b[index] = (0, _colorUtils.blendWithWhite)(data[offset + 2], alpha);
        } else {
          const color = (y + x) % 2 === 0 ? paddingColorEven : paddingColorOdd;
          r[index] = color[0];
          g[index] = color[1];
          b[index] = color[2];
        }
      }
    }
    return [new ImageChannel(newWidth, newHeight, r), new ImageChannel(newWidth, newHeight, g), new ImageChannel(newWidth, newHeight, b)];
  }
  constructor(width, height, data) {
    this.data = void 0;
    this.width = void 0;
    this.height = void 0;
    this.data = data;
    this.width = width;
    this.height = height;
  }
  get(x, y) {
    return this.data[y * this.width + x];
  }
  boundXY(x, y) {
    return [Math.min(Math.max(x, 0), this.width - 1), Math.min(Math.max(y, 0), this.height - 1)];
  }
}
exports.ImageChannel = ImageChannel;