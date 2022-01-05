/**
 * The MIT License (MIT)
 * Copyright (c) 2014-2015 Yahoo! Inc.
 * Modifications copyright (c) Microsoft Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// @ts-check

import { test as it, expect } from './playwright-test-fixtures';
import fs from 'fs';
import path from 'path';
import BlinkDiff from '../../packages/playwright-test/lib/third_party/blink-diff';
import PNGImage from '../../packages/playwright-test/lib/third_party/png-js';

/**
 * @param {string} type
 * @returns  {PNGImage}
 */
function generateImage(type) {
  let image;

  switch (type) {
    case 'small-1':
      image = PNGImage.createImage(2, 2);
      image.setAt(0, 0, { red: 10, green: 20, blue: 30, alpha: 40 });
      image.setAt(0, 1, { red: 50, green: 60, blue: 70, alpha: 80 });
      image.setAt(1, 0, { red: 90, green: 100, blue: 110, alpha: 120 });
      image.setAt(1, 1, { red: 130, green: 140, blue: 150, alpha: 160 });
      break;

    case 'small-2':
      image = PNGImage.createImage(2, 2);
      image.setAt(0, 0, { red: 210, green: 220, blue: 230, alpha: 240 });
      image.setAt(0, 1, { red: 10, green: 20, blue: 30, alpha: 40 });
      image.setAt(1, 0, { red: 50, green: 60, blue: 70, alpha: 80 });
      image.setAt(1, 1, { red: 15, green: 25, blue: 35, alpha: 45 });
      break;

    case 'small-3':
      image = PNGImage.createImage(2, 2);
      break;

    case 'medium-1':
      image = PNGImage.createImage(3, 3);
      image.setAt(0, 0, { red: 130, green: 140, blue: 150, alpha: 160 });
      image.setAt(0, 1, { red: 170, green: 180, blue: 190, alpha: 200 });
      image.setAt(0, 2, { red: 210, green: 220, blue: 230, alpha: 240 });
      image.setAt(1, 0, { red: 15, green: 25, blue: 35, alpha: 45 });
      image.setAt(1, 1, { red: 55, green: 65, blue: 75, alpha: 85 });
      image.setAt(1, 2, { red: 95, green: 105, blue: 115, alpha: 125 });
      image.setAt(2, 0, { red: 10, green: 20, blue: 30, alpha: 40 });
      image.setAt(2, 1, { red: 50, green: 60, blue: 70, alpha: 80 });
      image.setAt(2, 2, { red: 90, green: 100, blue: 110, alpha: 120 });
      break;

    case 'medium-2':
      image = PNGImage.createImage(3, 3);
      image.setAt(0, 0, { red: 95, green: 15, blue: 165, alpha: 26 });
      image.setAt(0, 1, { red: 15, green: 225, blue: 135, alpha: 144 });
      image.setAt(0, 2, { red: 170, green: 80, blue: 210, alpha: 2 });
      image.setAt(1, 0, { red: 50, green: 66, blue: 23, alpha: 188 });
      image.setAt(1, 1, { red: 110, green: 120, blue: 63, alpha: 147 });
      image.setAt(1, 2, { red: 30, green: 110, blue: 10, alpha: 61 });
      image.setAt(2, 0, { red: 190, green: 130, blue: 180, alpha: 29 });
      image.setAt(2, 1, { red: 10, green: 120, blue: 31, alpha: 143 });
      image.setAt(2, 2, { red: 155, green: 165, blue: 15, alpha: 185 });
      break;

    case 'slim-1':
      image = PNGImage.createImage(1, 3);
      image.setAt(0, 0, { red: 15, green: 225, blue: 135, alpha: 144 });
      image.setAt(0, 1, { red: 170, green: 80, blue: 210, alpha: 2 });
      image.setAt(0, 2, { red: 50, green: 66, blue: 23, alpha: 188 });
      break;

    case 'slim-2':
      image = PNGImage.createImage(3, 1);
      image.setAt(0, 0, { red: 15, green: 225, blue: 135, alpha: 144 });
      image.setAt(1, 0, { red: 170, green: 80, blue: 210, alpha: 2 });
      image.setAt(2, 0, { red: 50, green: 66, blue: 23, alpha: 188 });
      break;
  }

  return /** @type {PNGImage} */ (image);
}

/**
 * @param {Buffer} buf1
 * @param {Buffer} buf2
 * @returns  boolean
 */
function compareBuffer(buf1, buf2) {

  if (buf1.length !== buf2.length)
    return false;

  for (let i = 0, len = buf1.length; i < len; i++) {
    if (buf1[i] !== buf2[i])
      return false;
  }

  return true;
}

it.describe('Blink-Diff', () => {

  it.describe('Default values', () => {

    /** @type {BlinkDiff} */
    let instance;

    it.beforeEach(() => {
      instance = new BlinkDiff({
        imageA: 'image-a' as any, imageAPath: 'path to image-a', imageB: 'image-b' as any, imageBPath: 'path to image-b',

        composition: false
      });
    });

    it('should have the right values for imageA', () => {
      expect(instance._imageA).toBe('image-a');
    });

    it('should have the right values for imageAPath', () => {
      expect(instance._imageAPath).toBe('path to image-a');
    });

    it('should have the right values for imageB', () => {
      expect(instance._imageB).toBe('image-b');
    });

    it('should have the right values for imageBPath', () => {
      expect(instance._imageBPath).toBe('path to image-b');
    });

    it('should not have a value for imageOutputPath', () => {
      expect(instance._imageOutputPath).toBeUndefined();
    });

    it('should not have a value for thresholdType', () => {
      expect(instance._thresholdType).toBe('pixel');
    });

    it('should not have a value for threshold', () => {
      expect(instance._threshold).toBe(500);
    });

    it('should not have a value for delta', () => {
      expect(instance._delta).toBe(20);
    });

    it('should not have a value for outputMaskRed', () => {
      expect(instance._outputMaskRed).toBe(255);
    });

    it('should not have a value for outputMaskGreen', () => {
      expect(instance._outputMaskGreen).toBe(0);
    });

    it('should not have a value for outputMaskBlue', () => {
      expect(instance._outputMaskBlue).toBe(0);
    });

    it('should not have a value for outputMaskAlpha', () => {
      expect(instance._outputMaskAlpha).toBe(255);
    });

    it('should not have a value for outputMaskOpacity', () => {
      expect(instance._outputMaskOpacity).toBe(0.7);
    });

    it('should not have a value for outputBackgroundRed', () => {
      expect(instance._outputBackgroundRed).toBe(0);
    });

    it('should not have a value for outputBackgroundGreen', () => {
      expect(instance._outputBackgroundGreen).toBe(0);
    });

    it('should not have a value for outputBackgroundBlue', () => {
      expect(instance._outputBackgroundBlue).toBe(0);
    });

    it('should not have a value for outputBackgroundAlpha', () => {
      expect(instance._outputBackgroundAlpha).toBeUndefined();
    });

    it('should not have a value for outputBackgroundOpacity', () => {
      expect(instance._outputBackgroundOpacity).toBe(0.6);
    });

    it('should not have a value for copyImageAToOutput', () => {
      expect(instance._copyImageAToOutput).toBeTruthy();
    });

    it('should not have a value for copyImageBToOutput', () => {
      expect(instance._copyImageBToOutput).toBeFalsy();
    });

    it('should not have a value for filter', () => {
      expect(instance._filter).toEqual([]);
    });

    it('should not have a value for debug', () => {
      expect(instance._debug).toBeFalsy();
    });

    it.describe('Special cases', () => {

      /** @type {BlinkDiff} */
      let instance;

      it.beforeEach(() => {
        instance = new BlinkDiff({
          imageA: 'image-a' as any, imageB: 'image-b' as any
        });
      });

      it('should have the images', () => {
        expect(instance._imageA).toBe('image-a');
        expect(instance._imageB).toBe('image-b');
      });
    });
  });

  it.describe('Methods', () => {

    /** @type {BlinkDiff} */
    let instance;

    it.beforeEach(() => {
      instance = new BlinkDiff({
        imageA: 'image-a' as any, imageAPath: 'path to image-a', imageB: 'image-b' as any, imageBPath: 'path to image-b'
      });
    });

    it.describe('hasPassed', () => {

      it('should pass when identical', () => {
        expect(instance.hasPassed(BlinkDiff.RESULT_IDENTICAL)).toBeTruthy();
      });

      it('should pass when similar', () => {
        expect(instance.hasPassed(BlinkDiff.RESULT_SIMILAR)).toBeTruthy();
      });

      it('should not pass when unknown', () => {
        expect(instance.hasPassed(BlinkDiff.RESULT_UNKNOWN)).toBeFalsy();
      });

      it('should not pass when different', () => {
        expect(instance.hasPassed(BlinkDiff.RESULT_DIFFERENT)).toBeFalsy();
      });
    });

    it.describe('_colorDelta', () => {
      it('should calculate the delta', () => {
        const color1 = {
            c1: 23, c2: 87, c3: 89, c4: 234
          }, color2 = {
            c1: 84, c2: 92, c3: 50, c4: 21
          };

        expect(instance._colorDelta(color1, color2)).toBeGreaterThanOrEqual(225.02);
        expect(instance._colorDelta(color1, color2)).toBeLessThanOrEqual(225.03);
      });
    });

    it.describe('_loadImage', () => {

      /** @type {PNGImage} */
      let image;

      it.beforeEach(() => {
        image = generateImage('medium-2');
      });

      it.describe('from Image', () => {

        it('should use already loaded image', () => {
          const result = instance._loadImageSync('pathToFile', image);

          expect(result).toBeInstanceOf(PNGImage);
          expect(result).toBe(image);
        });
      });

      it.describe('from Path', () => {

        it('should load image when only path given', async () => {
          const image = await instance._loadImageSync(path.join(__dirname, 'assets', 'test.png'));
          const compare = compareBuffer(image.getImage().data, image.getImage().data);
          expect(compare).toBeTruthy();
        });
      });

      it.describe('from Buffer', () => {

        /** @type {Buffer} */
        let buffer;

        it.beforeEach(() => {
          buffer = fs.readFileSync(path.join(__dirname, 'assets', 'test.png'));
        });

        it('should load image from buffer if given', async () => {
          const image = await instance._loadImageSync('pathToFile', buffer);
          const compare = compareBuffer(image.getImage().data, image.getImage().data);
          expect(compare).toBeTruthy();
        });
      });
    });

    it.describe('_copyImage', () => {

      it('should copy the image', () => {
        const image1 = generateImage('small-1');
        const image2 = generateImage('small-2');

        instance._copyImage(image1, image2);

        expect(image1.getAt(0, 0)).toBe(image2.getAt(0, 0));
        expect(image1.getAt(0, 1)).toBe(image2.getAt(0, 1));
        expect(image1.getAt(1, 0)).toBe(image2.getAt(1, 0));
        expect(image1.getAt(1, 1)).toBe(image2.getAt(1, 1));
      });
    });

    it.describe('_correctDimensions', () => {

      it.describe('Negative Values', () => {

        it('should correct negative x values', () => {
          const rect = { x: -10, y: 23, width: 42, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(0);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(42);
          expect(rect.height).toBe(57);
        });

        it('should correct negative y values', () => {
          const rect = { x: 10, y: -23, width: 42, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(10);
          expect(rect.y).toBe(0);
          expect(rect.width).toBe(42);
          expect(rect.height).toBe(57);
        });

        it('should correct negative width values', () => {
          const rect = { x: 10, y: 23, width: -42, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(10);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(0);
          expect(rect.height).toBe(57);
        });

        it('should correct negative height values', () => {
          const rect = { x: 10, y: 23, width: 42, height: -57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(10);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(42);
          expect(rect.height).toBe(0);
        });

        it('should correct all negative values', () => {
          const rect = { x: -10, y: -23, width: -42, height: -57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(0);
          expect(rect.y).toBe(0);
          expect(rect.width).toBe(0);
          expect(rect.height).toBe(0);
        });
      });

      it.describe('Dimensions', () => {

        it('should correct too big x values', () => {
          const rect = { x: 1000, y: 23, width: 42, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(299);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(1);
          expect(rect.height).toBe(57);
        });

        it('should correct too big y values', () => {
          const rect = { x: 10, y: 2300, width: 42, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(10);
          expect(rect.y).toBe(199);
          expect(rect.width).toBe(42);
          expect(rect.height).toBe(1);
        });

        it('should correct too big width values', () => {
          const rect = { x: 11, y: 23, width: 4200, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(11);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(289);
          expect(rect.height).toBe(57);
        });

        it('should correct too big height values', () => {
          const rect = { x: 11, y: 23, width: 42, height: 5700 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(11);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(42);
          expect(rect.height).toBe(177);
        });

        it('should correct too big width and height values', () => {
          const rect = { x: 11, y: 23, width: 420, height: 570 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(11);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(289);
          expect(rect.height).toBe(177);
        });
      });

      it.describe('Border Dimensions', () => {

        it('should correct too big x values', () => {
          const rect = { x: 300, y: 23, width: 42, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(299);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(1);
          expect(rect.height).toBe(57);
        });

        it('should correct too big y values', () => {
          const rect = { x: 10, y: 200, width: 42, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(10);
          expect(rect.y).toBe(199);
          expect(rect.width).toBe(42);
          expect(rect.height).toBe(1);
        });

        it('should correct too big width values', () => {
          const rect = { x: 11, y: 23, width: 289, height: 57 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(11);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(289);
          expect(rect.height).toBe(57);
        });

        it('should correct too big height values', () => {
          const rect = { x: 11, y: 23, width: 42, height: 177 };

          instance._correctDimensions(300, 200, rect);

          expect(rect.x).toBe(11);
          expect(rect.y).toBe(23);
          expect(rect.width).toBe(42);
          expect(rect.height).toBe(177);
        });
      });
    });

    it.describe('_crop', () => {

      /** @type {PNGImage} */
      let croppedImage;
      /** @type {PNGImage} */
      let expectedImage;
      it.beforeEach(() => {
        croppedImage = generateImage('medium-1');
        expectedImage = generateImage('medium-1');
      });

      it('should crop image', () => {
        instance._crop('Medium-1', croppedImage, { x: 1, y: 2, width: 2, height: 1 });

        expect(croppedImage.getWidth()).toBe(2);
        expect(croppedImage.getHeight()).toBe(1);

        expect(croppedImage.getAt(0, 0)).toBe(expectedImage.getAt(1, 2));
        expect(croppedImage.getAt(1, 0)).toBe(expectedImage.getAt(2, 2));
      });
    });

    it.describe('_clip', () => {

      it('should clip the image small and medium', () => {
        const image1 = generateImage('small-1'), image2 = generateImage('medium-2');

        instance._clip(image1, image2);

        expect(image1.getWidth()).toBe(image2.getWidth());
        expect(image1.getHeight()).toBe(image2.getHeight());
      });

      it('should clip the image medium and small', () => {
        const image1 = generateImage('medium-1'), image2 = generateImage('small-2');

        instance._clip(image1, image2);

        expect(image1.getWidth()).toBe(image2.getWidth());
        expect(image1.getHeight()).toBe(image2.getHeight());
      });

      it('should clip the image slim-1 and medium', () => {
        const image1 = generateImage('slim-1'), image2 = generateImage('medium-1');

        instance._clip(image1, image2);

        expect(image1.getWidth()).toBe(image2.getWidth());
        expect(image1.getHeight()).toBe(image2.getHeight());
      });

      it('should clip the image slim-2 and medium', () => {
        const image1 = generateImage('slim-2'), image2 = generateImage('medium-1');

        instance._clip(image1, image2);

        expect(image1.getWidth()).toBe(image2.getWidth());
        expect(image1.getHeight()).toBe(image2.getHeight());
      });

      it('should clip the image small and small', () => {
        const image1 = generateImage('small-2'), image2 = generateImage('small-1');

        instance._clip(image1, image2);

        expect(image1.getWidth()).toBe(image2.getWidth());
        expect(image1.getHeight()).toBe(image2.getHeight());
      });
    });

    it.describe('isAboveThreshold', () => {

      it.describe('Pixel threshold', () => {

        it.beforeEach(() => {
          instance._thresholdType = BlinkDiff.THRESHOLD_PIXEL;
          instance._threshold = 50;
        });

        it('should be below threshold', () => {
          expect(instance.isAboveThreshold(49)).toBeFalsy();
        });

        it('should be above threshold on border', () => {
          expect(instance.isAboveThreshold(50)).toBeTruthy();
        });

        it('should be above threshold', () => {
          expect(instance.isAboveThreshold(51)).toBeTruthy();
        });
      });

      it.describe('Percent threshold', () => {

        it.beforeEach(() => {
          instance._thresholdType = BlinkDiff.THRESHOLD_PERCENT;
          instance._threshold = 0.1;
        });

        it('should be below threshold', () => {
          expect(instance.isAboveThreshold(9, 100)).toBeFalsy();
        });

        it('should be above threshold on border', () => {
          expect(instance.isAboveThreshold(10, 100)).toBeTruthy();
        });

        it('should be above threshold', () => {
          expect(instance.isAboveThreshold(11, 100)).toBeTruthy();
        });
      });
    });

    it.describe('Comparison', () => {
      /** @type {PNGImage} */
      let image1;
      /** @type {PNGImage} */
      let image2;
      /** @type {PNGImage} */
      let image3;
      /** @type {PNGImage} */
      let image4;
      /** @type {{ red: number, green: number, blue: number, alpha: number }} */
      let maskColor;
      /** @type {{ red: number, green: number, blue: number, alpha: number }} */
      let shiftColor;
      /** @type {{ red: number, green: number, blue: number, alpha: number }} */
      let backgroundMaskColor;


      it.beforeEach(() => {
        image1 = generateImage('small-1');
        image2 = generateImage('small-2');
        image3 = generateImage('small-3');
        image4 = generateImage('small-1');
        maskColor = {
          red: 123, green: 124, blue: 125, alpha: 126
        };
        shiftColor = {
          red: 200, green: 100, blue: 0, alpha: 113
        };
        backgroundMaskColor = {
          red: 31, green: 33, blue: 35, alpha: 37
        };
      });

      it.describe('_pixelCompare', () => {

        it('should have no differences with a zero dimension', () => {
          const deltaThreshold = 10, width = 0, height = 0, hShift = 0, vShift = 0;
          const result = instance._pixelCompare(image1, image2, image3, deltaThreshold, width, height, maskColor, shiftColor, backgroundMaskColor, hShift, vShift);

          expect(result).toBe(0);
        });

        it('should have all differences', () => {
          const deltaThreshold = 10, width = 2, height = 2, hShift = 0, vShift = 0;
          const result = instance._pixelCompare(image1, image2, image3, deltaThreshold, width, height, maskColor, shiftColor, backgroundMaskColor, hShift, vShift);

          expect(result).toBe(4);
        });

        it('should have some differences', () => {
          const deltaThreshold = 100, width = 2, height = 2, hShift = 0, vShift = 0;
          const result = instance._pixelCompare(image1, image2, image3, deltaThreshold, width, height, maskColor, shiftColor, backgroundMaskColor, hShift, vShift);

          expect(result).toBe(2);
        });
      });

      it.describe('_compare', () => {

        it.beforeEach(() => {
          instance._thresholdType = BlinkDiff.THRESHOLD_PIXEL;
          instance._threshold = 3;
        });

        it('should be different', () => {
          const deltaThreshold = 10, hShift = 0, vShift = 0;
          const result = instance._compare(image1, image2, image3, deltaThreshold, maskColor, shiftColor, backgroundMaskColor, hShift, vShift);

          expect(result).toEqual({
            code: BlinkDiff.RESULT_DIFFERENT, differences: 4, dimension: 4, width: 2, height: 2
          });
        });

        it('should be similar', () => {
          const deltaThreshold = 100, hShift = 0, vShift = 0;
          const result = instance._compare(image1, image2, image3, deltaThreshold, maskColor, shiftColor, backgroundMaskColor, hShift, vShift);

          expect(result).toEqual({
            code: BlinkDiff.RESULT_SIMILAR, differences: 2, dimension: 4, width: 2, height: 2
          });
        });

        it('should be identical', () => {
          const deltaThreshold = 10, hShift = 0, vShift = 0;
          const result = instance._compare(image1, image4, image3, deltaThreshold, maskColor, shiftColor, backgroundMaskColor, hShift, vShift);

          expect(result).toEqual({
            code: BlinkDiff.RESULT_IDENTICAL, differences: 0, dimension: 4, width: 2, height: 2
          });
        });
      });
    });

    it.describe('Run', () => {

      it.beforeEach(() => {
        instance._imageA = generateImage('small-1');
        instance._imageB = generateImage('medium-1');

        instance._thresholdType = BlinkDiff.THRESHOLD_PIXEL;
        instance._threshold = 3;

        instance._composition = false;
      });

      it('should crop image-a', async () => {
        instance._cropImageA = { width: 1, height: 2 };
        const result = instance.runSync();
        expect(result.dimension).toBe(2);
      });

      it('should crop image-b', async () => {
        instance._cropImageB = { width: 1, height: 1 };
        const result = instance.runSync();
        expect(result.dimension).toBe(1);
      });

      it('should clip image-b', async () => {
        const result = instance.runSync();
        expect(result.dimension).toBe(4);
      });

      it('should crop and clip images', async () => {
        instance._cropImageA = { width: 1, height: 2 };
        instance._cropImageB = { width: 1, height: 1 };
        const result = instance.runSync();
        expect(result.dimension).toBe(1);
      });

      it('should write output file', async ({}, testInfo) => {
        instance._imageOutputPath = testInfo.outputPath('tmp.png');
        instance.runSync();
        if (!fs.existsSync(testInfo.outputPath('tmp.png')))
          throw new Error('Could not write file.');
      });

      it('should compare image-a to image-b', async () => {
        const result = instance.runSync();
        expect(result.code).toBe(BlinkDiff.RESULT_DIFFERENT);
      });

      it('should be black', async () => {
        instance._delta = 1000;
        instance._copyImageAToOutput = false;
        instance._copyImageBToOutput = false;
        instance._outputBackgroundRed = 0;
        instance._outputBackgroundGreen = 0;
        instance._outputBackgroundBlue = 0;
        instance._outputBackgroundAlpha = 0;
        instance._outputBackgroundOpacity = undefined;

        instance.runSync();
        expect(instance._imageOutput.getAt(0, 0)).toBe(0);
      });

      it('should copy image-a to output by default', async () => {
        instance._delta = 1000;
        instance._outputBackgroundRed = undefined;
        instance._outputBackgroundGreen = undefined;
        instance._outputBackgroundBlue = undefined;
        instance._outputBackgroundAlpha = undefined;
        instance._outputBackgroundOpacity = undefined;

        instance.runSync();
        expect(instance._imageOutput.getAt(0, 0)).toBe(instance._imageA.getAt(0, 0));
      });

      it('should copy image-a to output', async () => {
        instance._delta = 1000;
        instance._copyImageAToOutput = true;
        instance._copyImageBToOutput = false;
        instance._outputBackgroundRed = undefined;
        instance._outputBackgroundGreen = undefined;
        instance._outputBackgroundBlue = undefined;
        instance._outputBackgroundAlpha = undefined;
        instance._outputBackgroundOpacity = undefined;

        instance.runSync();
        expect(instance._imageOutput.getAt(0, 0)).toBe(instance._imageA.getAt(0, 0));
      });

      it('should copy image-b to output', async () => {
        instance._delta = 1000;
        instance._copyImageAToOutput = false;
        instance._copyImageBToOutput = true;
        instance._outputBackgroundRed = undefined;
        instance._outputBackgroundGreen = undefined;
        instance._outputBackgroundBlue = undefined;
        instance._outputBackgroundAlpha = undefined;
        instance._outputBackgroundOpacity = undefined;

        instance.runSync();
        expect(instance._imageOutput.getAt(0, 0)).toBe(instance._imageB.getAt(0, 0));
      });
    });

    it.describe('Color-Conversion', () => {

      it('should convert RGB to XYZ', () => {
        const color = /** @type {any} */ (instance._convertRgbToXyz({ c1: 92 / 255, c2: 255 / 255, c3: 162 / 255, c4: 1 }));

        expect(color.c1).toBeCloseTo(0.6144431682352941, 0.0001);
        expect(color.c2).toBeCloseTo(0.8834245847058824, 0.0001);
        expect(color.c3).toBeCloseTo(0.6390158682352941, 0.0001);
        expect(color.c4).toBeCloseTo(1, 0.0001);
      });

      it('should convert Xyz to CIELab', () => {
        const color = /** @type {any} */ (instance._convertXyzToCieLab({
          c1: 0.6144431682352941, c2: 0.8834245847058824, c3: 0.6390158682352941, c4: 1
        }));

        expect(color.c1).toBeCloseTo(95.30495102757038, 0.0001);
        expect(color.c2).toBeCloseTo(-54.68933740774734, 0.0001);
        expect(color.c3).toBeCloseTo(19.63870174748623, 0.0001);
        expect(color.c4).toBeCloseTo(1, 0.0001);
      });
    });
  });
});
