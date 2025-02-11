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

export function blendWithWhite(c: number, a: number): number {
  return 255 + (c - 255) * a;
}

export function rgb2gray(r: number, g: number, b: number): number {
  // NOTE: this is the exact integer formula from SSIM.js.
  // See https://github.com/obartra/ssim/blob/ca8e3c6a6ff5f4f2e232239e0c3d91806f3c97d5/src/matlab/rgb2gray.ts#L56
  return (77 * r + 150 * g + 29 * b + 128) >> 8;
}

// Perceived color difference defined by CIE94.
// See https://en.wikipedia.org/wiki/Color_difference#CIE94
//
// The result of 1.0 is a "just-noticeable difference".
//
// Other results interpretation (taken from http://zschuessler.github.io/DeltaE/learn/):
//   < 1.0     Not perceptible by human eyes.
//   1-2        Perceptible through close observation.
//   2-10       Perceptible at a glance.
//   11-49      Colors are more similar than opposite
//   100        Colors are exact opposite
export function colorDeltaE94(rgb1: number[], rgb2: number[]) {
  const [l1, a1, b1] = xyz2lab(srgb2xyz(rgb1));
  const [l2, a2, b2] = xyz2lab(srgb2xyz(rgb2));
  const deltaL = l1 - l2;
  const deltaA = a1 - a2;
  const deltaB = b1 - b2;
  const c1 = Math.sqrt(a1 ** 2 + b1 ** 2);
  const c2 = Math.sqrt(a2 ** 2 + b2 ** 2);
  const deltaC = c1 - c2;
  let deltaH = deltaA ** 2 + deltaB ** 2 - deltaC ** 2;
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
  // The k1, k2, kL, kC, kH values for "graphic arts" applications.
  // See https://en.wikipedia.org/wiki/Color_difference#CIE94
  const k1 = 0.045;
  const k2 = 0.015;
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const sC = 1.0 + k1 * c1;
  const sH = 1.0 + k2 * c1;
  const sL = 1;

  return Math.sqrt((deltaL / sL / kL) ** 2 + (deltaC / sC / kC) ** 2 + (deltaH / sH / kH) ** 2);
}

// sRGB -> 1-normalized XYZ (i.e. Y ∈ [0, 1]) with D65 illuminant
// See https://en.wikipedia.org/wiki/SRGB#From_sRGB_to_CIE_XYZ
export function srgb2xyz(rgb: number[]): number[] {
  let r = rgb[0] / 255;
  let g = rgb[1] / 255;
  let b = rgb[2] / 255;
  r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  return [
    (r * 0.4124 + g * 0.3576 + b * 0.1805),
    (r * 0.2126 + g * 0.7152 + b * 0.0722),
    (r * 0.0193 + g * 0.1192 + b * 0.9505),
  ];
}

const sigma_pow2 = 6 * 6 / 29 / 29;
const sigma_pow3 = 6 * 6 * 6 / 29 / 29 / 29;

// 1-normalized CIE XYZ with D65 to L*a*b*
// See https://en.wikipedia.org/wiki/CIELAB_color_space#From_CIEXYZ_to_CIELAB
export function xyz2lab(xyz: number[]): number[] {
  const x = xyz[0] / 0.950489;
  const y = xyz[1];
  const z = xyz[2] / 1.088840;

  const fx = x > sigma_pow3 ? x ** (1 / 3) : x / 3 / sigma_pow2 + 4 / 29;
  const fy = y > sigma_pow3 ? y ** (1 / 3) : y / 3 / sigma_pow2 + 4 / 29;
  const fz = z > sigma_pow3 ? z ** (1 / 3) : z / 3 / sigma_pow2 + 4 / 29;

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [l, a, b];
}
