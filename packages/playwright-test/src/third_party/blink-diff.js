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

/**
 * @typedef {number} int
 * @typedef {number} float
 * @typedef {{c1: number, c2: number, c3: number, c4: number}} Color
 * @typedef {{red: int, green: int, blue: int, alpha: int | undefined, opacity: float}} RGBAOColor
 * @typedef {{R: number | undefined, G: number | undefined, B: number | undefined}} Gamma
 * @typedef {{width: number, height: number, x: number, y: number}} Rect
 * @typedef {{width: number, height: number, dimention: number, differences: number[], code: number}} Result
 * @typedef {{
 *   imageA?: PNGImage|Buffer,
 *   imageAPath?: string,
 *   imageB?: PNGImage|Buffer,
 *   imageBPath?: string,
 *   imageOutputPath?: string,
 *   imageOutputLimit?: int,
 *   thresholdType?: string,
 *   threshold?: int,
 *   delta?: int,
 *   outputMaskRed?: int,
 *   outputMaskGreen?: int,
 *   outputMaskBlue?: int,
 *   outputMaskAlpha?: int,
 *   outputMaskOpacity?: float,
 *   outputShiftRed?: int,
 *   outputShiftGreen?: int,
 *   outputShiftBlue?: int,
 *   outputShiftAlpha?: int,
 *   outputShiftOpacity?: float,
 *   outputBackgroundRed?: int,
 *   outputBackgroundGreen?: int,
 *   outputBackgroundBlue?: int,
 *   outputBackgroundAlpha?: int,
 *   outputBackgroundOpacity?: float,
 *   blockOut?: Rect|Rect[],
 *   blockOutRed?: int,
 *   blockOutGreen?: int,
 *   blockOutBlue?: int,
 *   blockOutAlpha?: int,
 *   blockOutOpacity?: float,
 *   copyImageAToOutput?: boolean,
 *   copyImageBToOutput?: boolean,
 *   filter?: string[],
 *   debug?: boolean,
 *   composition?: boolean,
 *   composeLeftToRight?: boolean,
 *   composeTopToBottom?: boolean,
 *   hideShift?: boolean,
 *   hShift?: int,
 *   vShift?: int,
 *   cropImageA?: { x: number, y: number, width: number, height: number },
 *   cropImageB?: { x: number, y: number, width: number, height: number },
 *   perceptual?: boolean,
 *   gamma?: float,
 *   gammaR?: float,
 *   gammaG?: float,
 *   gammaB?: float,
 * }} Options
 */

const assert = require('assert');
const PNGImage = require('./png-js');
const { PNG } = require('pngjs');

/**
 * @template G
 * @param {any} value 
 * @param {G} defaultValue 
 * @returns {G}
 */
function load(value, defaultValue) {
  return ((value == null) ? defaultValue : value);
}

/**
  * Blink-diff comparison class
  */
class BlinkDiff {

  /*
   * @param {object} options
   * @param {PNGImage|Buffer} options.imageA Image object of first image
   * @param {string} options.imageAPath Path to first image
   * @param {PNGImage|Buffer} options.imageB Image object of second image
   * @param {string} options.imageBPath Path to second image
   * @param {string} [options.imageOutputPath=undefined] Path to output image file
   * @param {int} [options.imageOutputLimit=BlinkDiff.OUTPUT_ALL] Determines when an image output is created
   * @param {string} [options.thresholdType=BlinkDiff.THRESHOLD_PIXEL] Defines the threshold of the comparison
   * @param {int} [options.threshold=500] Threshold limit according to the comparison limit.
   * @param {number} [options.delta=20] Distance between the color coordinates in the 4 dimensional color-space that will not trigger a difference.
   * @param {int} [options.outputMaskRed=255] Value to set for red on difference pixel. 'Undefined' will not change the value.
   * @param {int} [options.outputMaskGreen=0] Value to set for green on difference pixel. 'Undefined' will not change the value.
   * @param {int} [options.outputMaskBlue=0] Value to set for blue on difference pixel. 'Undefined' will not change the value.
   * @param {int} [options.outputMaskAlpha=255] Value to set for the alpha channel on difference pixel. 'Undefined' will not change the value.
   * @param {float} [options.outputMaskOpacity=0.7] Strength of masking the pixel. 1.0 means that the full color will be used; anything less will mix-in the original pixel.
   * @param {int} [options.outputShiftRed=255] Value to set for red on shifted pixel. 'Undefined' will not change the value.
   * @param {int} [options.outputShiftGreen=165] Value to set for green on shifted pixel. 'Undefined' will not change the value.
   * @param {int} [options.outputShiftBlue=0] Value to set for blue on shifted pixel. 'Undefined' will not change the value.
   * @param {int} [options.outputShiftAlpha=255] Value to set for the alpha channel on shifted pixel. 'Undefined' will not change the value.
   * @param {float} [options.outputShiftOpacity=0.7] Strength of masking the shifted pixel. 1.0 means that the full color will be used; anything less will mix-in the original pixel.
   * @param {int} [options.outputBackgroundRed=0] Value to set for red as background. 'Undefined' will not change the value.
   * @param {int} [options.outputBackgroundGreen=0] Value to set for green as background. 'Undefined' will not change the value.
   * @param {int} [options.outputBackgroundBlue=0] Value to set for blue as background. 'Undefined' will not change the value.
   * @param {int} [options.outputBackgroundAlpha=undefined] Value to set for the alpha channel as background. 'Undefined' will not change the value.
   * @param {float} [options.outputBackgroundOpacity=0.6] Strength of masking the pixel. 1.0 means that the full color will be used; anything less will mix-in the original pixel.
   * @param {object|object[]} [options.blockOut] Object or list of objects with coordinates of blocked-out areas.
   * @param {int} [options.blockOutRed=0] Value to set for red on blocked-out pixel. 'Undefined' will not change the value.
   * @param {int} [options.blockOutGreen=0] Value to set for green on blocked-out pixel. 'Undefined' will not change the value.
   * @param {int} [options.blockOutBlue=0] Value to set for blue on blocked-out pixel. 'Undefined' will not change the value.
   * @param {int} [options.blockOutAlpha=255] Value to set for the alpha channel on blocked-out pixel. 'Undefined' will not change the value.
   * @param {float} [options.blockOutOpacity=1.0] Strength of masking the blocked-out pixel. 1.0 means that the full color will be used; anything less will mix-in the original pixel.
   * @param {boolean} [options.copyImageAToOutput=true]  Copies the first image to the output image before the comparison begins. This will make sure that the output image will highlight the differences on the first image.
   * @param {boolean} [options.copyImageBToOutput=false] Copies the second image to the output image before the comparison begins. This will make sure that the output image will highlight the differences on the second image.
   * @param {string[]} [options.filter=[]] Filters that will be applied before the comparison. Available filters are: blur, grayScale, lightness, luma, luminosity, sepia
   * @param {boolean} [options.debug=false] When set, then the applied filters will be shown on the output image.
   * @param {boolean} [options.composition=true] Should a composition be created to compare?
   * @param {boolean} [options.composeLeftToRight=false] Create composition from left to right, otherwise let it decide on its own whats best
   * @param {boolean} [options.composeTopToBottom=false] Create composition from top to bottom, otherwise let it decide on its own whats best
   * @param {boolean} [options.hideShift=false] Hides shift highlighting by using the background color instead
   * @param {int} [options.hShift=2] Horizontal shift for possible antialiasing
   * @param {int} [options.vShift=2] Vertical shift for possible antialiasing
   * @param {object} [options.cropImageA=null] Cropping for first image (default: no cropping)
   * @param {int} [options.cropImageA.x=0] Coordinate for left corner of cropping region
   * @param {int} [options.cropImageA.y=0] Coordinate for top corner of cropping region
   * @param {int} [options.cropImageA.width] Width of cropping region (default: Width that is left)
   * @param {int} [options.cropImageA.height] Height of cropping region (default: Height that is left)
   * @param {object} [options.cropImageB=null] Cropping for second image (default: no cropping)
   * @param {int} [options.cropImageB.x=0] Coordinate for left corner of cropping region
   * @param {int} [options.cropImageB.y=0] Coordinate for top corner of cropping region
   * @param {int} [options.cropImageB.width] Width of cropping region (default: Width that is left)
   * @param {int} [options.cropImageB.height] Height of cropping region (default: Height that is left)
   * @param {boolean} [options.perceptual=false] Turns perceptual comparison on
   * @param {float} [options.gamma] Gamma correction for all colors
   * @param {float} [options.gammaR] Gamma correction for red
   * @param {float} [options.gammaG] Gamma correction for green
   * @param {float} [options.gammaB] Gamma correction for blue
   *
   * @property {PNGImage} _imageA
   * @property {PNGImage} _imageACompare
   * @property {string} _imageAPath
   * @property {PNGImage} _imageB
   * @property {PNGImage} _imageBCompare
   * @property {string} _imageBPath
   * @property {PNGImage} _imageOutput
   * @property {string} _imageOutputPath
   * @property {int} _imageOutputLimit
   * @property {string} _thresholdType
   * @property {int} _threshold
   * @property {number} _delta
   * @property {int} _outputMaskRed
   * @property {int} _outputMaskGreen
   * @property {int} _outputMaskBlue
   * @property {int} _outputMaskAlpha
   * @property {float} _outputMaskOpacity
   * @property {int} _outputShiftRed
   * @property {int} _outputShiftGreen
   * @property {int} _outputShiftBlue
   * @property {int} _outputShiftAlpha
   * @property {float} _outputShiftOpacity
   * @property {int} _outputBackgroundRed
   * @property {int} _outputBackgroundGreen
   * @property {int} _outputBackgroundBlue
   * @property {int} _outputBackgroundAlpha
   * @property {float} _outputBackgroundOpacity
   * @property {object[]} _blockOut
   * @property {int} _blockOutRed
   * @property {int} _blockOutGreen
   * @property {int} _blockOutBlue
   * @property {int} _blockOutAlpha
   * @property {float} _blockOutOpacity
   * @property {boolean} _copyImageAToOutput
   * @property {boolean} _copyImageBToOutput
   * @property {string[]} _filter
   * @property {boolean} _debug
   * @property {boolean} _composition
   * @property {boolean} _composeLeftToRight
   * @property {boolean} _composeTopToBottom
   * @property {int} _hShift
   * @property {int} _vShift
   * @property {object} _cropImageA
   * @property {int} _cropImageA.x
   * @property {int} _cropImageA.y
   * @property {int} _cropImageA.width
   * @property {int} _cropImageA.height
   * @property {object} _cropImageB
   * @property {int} _cropImageB.x
   * @property {int} _cropImageB.y
   * @property {int} _cropImageB.width
   * @property {int} _cropImageB.height
   * @property {object} _refWhite
   * @property {boolean} _perceptual
   * @property {float} _gamma
   * @property {float} _gammaR
   * @property {float} _gammaG
   * @property {float} _gammaB
   */
  /**
   * @param {Options} options 
   */
  constructor(options) {

    this._imageA = options.imageA;
    this._imageAPath = options.imageAPath;
    assert.ok(options.imageAPath || options.imageA, "Image A not given.");

    this._imageB = options.imageB;
    this._imageBPath = options.imageBPath;
    assert.ok(options.imageBPath || options.imageB, "Image B not given.");

    this._imageOutput = null;
    this._imageOutputPath = options.imageOutputPath;
    this._imageOutputLimit = load(options.imageOutputLimit, BlinkDiff.OUTPUT_ALL);

    // Pixel or Percent
    this._thresholdType = load(options.thresholdType, BlinkDiff.THRESHOLD_PIXEL);

    // How many pixels different to ignore.
    this._threshold = load(options.threshold, 500);

    this._delta = load(options.delta, 20);

    this._outputMaskRed = load(options.outputMaskRed, 255);
    this._outputMaskGreen = load(options.outputMaskGreen, 0);
    this._outputMaskBlue = load(options.outputMaskBlue, 0);
    this._outputMaskAlpha = load(options.outputMaskAlpha, 255);
    this._outputMaskOpacity = load(options.outputMaskOpacity, 0.7);

    this._outputBackgroundRed = load(options.outputBackgroundRed, 0);
    this._outputBackgroundGreen = load(options.outputBackgroundGreen, 0);
    this._outputBackgroundBlue = load(options.outputBackgroundBlue, 0);
    this._outputBackgroundAlpha = options.outputBackgroundAlpha;
    this._outputBackgroundOpacity = load(options.outputBackgroundOpacity, 0.6);

    if (options.hideShift) {
      this._outputShiftRed = this._outputBackgroundRed;
      this._outputShiftGreen = this._outputBackgroundGreen;
      this._outputShiftBlue = this._outputBackgroundBlue;
      this._outputShiftAlpha = this._outputBackgroundAlpha;
      this._outputShiftOpacity = this._outputBackgroundOpacity;

    } else {
      this._outputShiftRed = load(options.outputShiftRed, 200);
      this._outputShiftGreen = load(options.outputShiftGreen, 100);
      this._outputShiftBlue = load(options.outputShiftBlue, 0);
      this._outputShiftAlpha = load(options.outputShiftAlpha, 255);
      this._outputShiftOpacity = load(options.outputShiftOpacity, 0.7);
    }

    const blockOut = /** @type {Rect[]|Rect}*/ (load(options.blockOut, []));
    /** @type {Rect[]}*/
    this._blockOut = Array.isArray(blockOut) ? blockOut : [blockOut];

    this._blockOutRed = load(options.blockOutRed, 0);
    this._blockOutGreen = load(options.blockOutGreen, 0);
    this._blockOutBlue = load(options.blockOutBlue, 0);
    this._blockOutAlpha = load(options.blockOutAlpha, 255);
    this._blockOutOpacity = load(options.blockOutOpacity, 1.0);

    this._copyImageAToOutput = load(options.copyImageAToOutput, true);
    this._copyImageBToOutput = load(options.copyImageBToOutput, false);

    this._filter = load(options.filter, []);

    this._debug = load(options.debug, false);

    this._composition = load(options.composition, true);
    this._composeLeftToRight = load(options.composeLeftToRight, false);
    this._composeTopToBottom = load(options.composeTopToBottom, false);

    this._hShift = load(options.hShift, 2);
    this._vShift = load(options.vShift, 2);

    this._cropImageA = options.cropImageA;
    this._cropImageB = options.cropImageB;

    // Prepare reference white
    this._refWhite = this._convertRgbToXyz({c1: 1, c2: 1, c3: 1, c4: 1});

    this._perceptual = load(options.perceptual, false);

    this._gamma = options.gamma;
    this._gammaR = options.gammaR;
    this._gammaG = options.gammaG;
    this._gammaB = options.gammaB;
  }

  /**
   * Runs the comparison synchronously
   *
   * @method runSync
   * @return {Result} Result of comparison { code, differences, dimension, width, height }
   */
  runSync() {

    var i, len, rect, color;

    try {
      this._imageA = this._loadImageSync(this._imageAPath, this._imageA);
      this._imageB = this._loadImageSync(this._imageBPath, this._imageB);

      // Crop images if requested
      if (this._cropImageA) {
        this._correctDimensions(this._imageA.getWidth(), this._imageA.getHeight(), this._cropImageA);
        this._crop("Image-A", this._imageA, this._cropImageA);
      }
      if (this._cropImageB) {
        this._correctDimensions(this._imageB.getWidth(), this._imageB.getHeight(), this._cropImageB);
        this._crop("Image-B", this._imageB, this._cropImageB);
      }

      // Always clip
      this._clip(this._imageA, this._imageB);

      this._imageOutput = PNGImage.createImage(this._imageA.getWidth(), this._imageA.getHeight());

      // Make a copy when not in debug mode
      if (this._debug) {
        this._imageACompare = this._imageA;
        this._imageBCompare = this._imageB;
      } else {
        this._imageACompare = PNGImage.copyImage(this._imageA);
        this._imageBCompare = PNGImage.copyImage(this._imageB);
      }

      // Block-out
      color = {
        red: this._blockOutRed,
        green: this._blockOutGreen,
        blue: this._blockOutBlue,
        alpha: this._blockOutAlpha,
        opacity: this._blockOutOpacity
      };
      for (i = 0, len = this._blockOut.length; i < len; i++) {
        rect = this._blockOut[i];

        // Make sure the block-out parameters fit
        this._correctDimensions(this._imageACompare.getWidth(), this._imageACompare.getHeight(), rect);

        this._imageACompare.fillRect(rect.x, rect.y, rect.width, rect.height, color);
        this._imageBCompare.fillRect(rect.x, rect.y, rect.width, rect.height, color);
      }

      // Copy image to composition
      if (this._copyImageAToOutput) {
        this._copyImage(this._debug ? this._imageACompare : this._imageA, this._imageOutput);
      } else if (this._copyImageBToOutput) {
        this._copyImage(this._debug ? this._imageBCompare : this._imageB, this._imageOutput);
      }

      // Gamma correction
      var gamma = undefined;
      if (this._gamma || this._gammaR || this._gammaG || this._gammaB) {
        gamma = {
          R: this._gammaR || this._gamma, G: this._gammaG || this._gamma, B: this._gammaB || this._gamma
        };
      }

      // Comparison
      var result = this._compare(this._imageACompare, this._imageBCompare, this._imageOutput, this._delta,
        { // Output-Mask color
          red: this._outputMaskRed,
          green: this._outputMaskGreen,
          blue: this._outputMaskBlue,
          alpha: this._outputMaskAlpha,
          opacity: this._outputMaskOpacity
        }, { // Output-Shift color
          red: this._outputShiftRed,
          green: this._outputShiftGreen,
          blue: this._outputShiftBlue,
          alpha: this._outputShiftAlpha,
          opacity: this._outputShiftOpacity
        }, { // Background color
          red: this._outputBackgroundRed,
          green: this._outputBackgroundGreen,
          blue: this._outputBackgroundBlue,
          alpha: this._outputBackgroundAlpha,
          opacity: this._outputBackgroundOpacity
        },
        this._hShift, this._vShift,
        this._perceptual,
        gamma
      );

      // Create composition if requested
      if (this._debug) {
        this._imageOutput = this._createComposition(this._imageACompare, this._imageBCompare, this._imageOutput);
      } else {
        this._imageOutput = this._createComposition(this._imageA, this._imageB, this._imageOutput);
      }

      // Need to write to the filesystem?
      if (this._imageOutputPath && this._withinOutputLimit(result.code, this._imageOutputLimit)) {
        this._imageOutput.writeImageSync(this._imageOutputPath);
        this.log("Wrote differences to " + this._imageOutputPath);
      }

      return result;

    } catch (err) {
      console.error(err.stack);
      throw err;
    }
  }

  /**
   * Determines if result is within the output limit
   *
   * @method _withinOutputLimit
   * @param {int} resultCode
   * @param {int} outputLimit
   * @return {boolean}
   */
  _withinOutputLimit(resultCode, outputLimit) {
    return this._convertResultCodeToRelativeValue(resultCode) <= outputLimit;
  }

  /**
   * Converts the result-code to a relative value
   *
   * @method _convertResultCodeToRelativeValue
   * @param {int} resultCode
   * @return {int}
   */
  _convertResultCodeToRelativeValue(resultCode) {

    /** @type {any} */
    var valueMap = {
      0: 0, 1: 10, 7: 20, 5: 30
    };

    return valueMap[resultCode] !== undefined ? valueMap[resultCode] : 0;
  }

  /**
   * Creates a comparison image
   *
   * @method _createComposition
   * @param {PNGImage} imageA
   * @param {PNGImage} imageB
   * @param {PNGImage} imageOutput
   * @return {PNGImage}
   */
  _createComposition(imageA, imageB, imageOutput) {

    var width, height, image = imageOutput;

    if (this._composition) {
      width = Math.max(imageA.getWidth(), imageB.getWidth());
      height = Math.max(imageA.getHeight(), imageB.getHeight());

      if (((width > height) && !this._composeLeftToRight) || this._composeTopToBottom) {
        image = PNGImage.createImage(width, height * 3);

        PNG.bitblt(imageA.getImage(), image.getImage(), 0, 0, imageA.getWidth(), imageA.getHeight(), 0, 0);
        PNG.bitblt(imageOutput.getImage(), image.getImage(), 0, 0, imageOutput.getWidth(), imageOutput.getHeight(), 0, height);
        PNG.bitblt(imageB.getImage(), image.getImage(), 0, 0, imageB.getWidth(), imageB.getHeight(), 0, height * 2);
      } else {
        image = PNGImage.createImage(width * 3, height);

        PNG.bitblt(imageA.getImage(), image.getImage(), 0, 0, imageA.getWidth(), imageA.getHeight(), 0, 0);
        PNG.bitblt(imageOutput.getImage(), image.getImage(), 0, 0, imageOutput.getWidth(), imageOutput.getHeight(), width, 0);
        PNG.bitblt(imageB.getImage(), image.getImage(), 0, 0, imageB.getWidth(), imageB.getHeight(), width * 2, 0);
      }
    }

    return image;
  }

  /**
   * Loads the image or uses the already available image
   *
   * @method _loadImageSync
   * @param {string|undefined} path
   * @param {PNGImage|Buffer=} image
   * @return {PNGImage}
   */
  _loadImageSync(path, image) {

    if (image instanceof Buffer) {
      return PNGImage.loadImageSync(image);

    } else if ((typeof path === 'string') && !image) {
      return PNGImage.readImageSync(path);

    } else {
      return /** @type {PNGImage} */ (image);
    }
  }

  /**
   * Copies one image into another image
   *
   * @method _copyImage
   * @param {PNGImage} imageSrc
   * @param {PNGImage} imageDst
   */
  _copyImage(imageSrc, imageDst) {
    PNG.bitblt(imageSrc.getImage(), imageDst.getImage(), 0, 0, imageSrc.getWidth(), imageSrc.getHeight(), 0, 0);
  }


  /**
   * Is the difference above the set threshold?
   *
   * @method isAboveThreshold
   * @param {int} items
   * @param {int} total
   * @return {boolean}
   */
  isAboveThreshold(items, total) {

    if ((this._thresholdType === BlinkDiff.THRESHOLD_PIXEL) && (this._threshold <= items)) {
      return true;
    } else if (this._threshold <= (items / total)) {
      return true;
    }

    return false;
  }


  /**
   * Log method that can be overwritten to modify the logging behavior.
   *
   * @method log
   * @param {string} text
   */
  log(text) {
    // Nothing here; Overwrite this to add some functionality
  }


  /**
   * Has comparison passed?
   *
   * @method hasPassed
   * @param {int} result Comparison result-code
   * @return {boolean}
   */
  hasPassed(result) {
    return ((result !== BlinkDiff.RESULT_DIFFERENT) && (result !== BlinkDiff.RESULT_UNKNOWN));
  }


  /**
   * Clips the images to the lower resolution of both
   *
   * @method _clip
   * @param {PNGImage} imageA Source image
   * @param {PNGImage} imageB Destination image
   */
  _clip(imageA, imageB) {

    var minWidth, minHeight;

    if ((imageA.getWidth() != imageB.getWidth()) || (imageA.getHeight() != imageB.getHeight())) {

      minWidth = imageA.getWidth();
      if (imageB.getWidth() < minWidth) {
        minWidth = imageB.getWidth();
      }

      minHeight = imageA.getHeight();
      if (imageB.getHeight() < minHeight) {
        minHeight = imageB.getHeight();
      }

      this.log("Clipping to " + minWidth + " x " + minHeight);

      imageA.clip(0, 0, minWidth, minHeight);
      imageB.clip(0, 0, minWidth, minHeight);
    }
  }

  /**
   * Crops the source image to the bounds of rect
   *
   * @method _crop
   * @param {string} which Title of image to crop
   * @param {PNGImage} image Source image
   * @param {object} rect Values for rect
   * @param {int} rect.x X value of rect
   * @param {int} rect.y Y value of rect
   * @param {int} rect.width Width value of rect
   * @param {int} rect.height Height value of rect
   */
  _crop(which, image, rect) {

    this.log("Cropping " + which + " from " + rect.x + "," + rect.y + " by " + rect.width + " x " + rect.height);

    image.clip(rect.x, rect.y, rect.width, rect.height);
  }

  /**
   * Correcting area dimensions if necessary
   *
   * Note:
   *  Priority is on the x/y coordinates, and not on the size since the size will then be removed anyways.
   *
   * @method _correctDimensions
   * @param {int} width
   * @param {int} height
   * @param {object} rect Values for rect
   * @param {int} rect.x X value of rect
   * @param {int} rect.y Y value of rect
   * @param {int} rect.width Width value of rect
   * @param {int} rect.height Height value of rect
   */
  _correctDimensions(width, height, rect) {

    // Set values if none given
    rect.x = rect.x || 0;
    rect.y = rect.y || 0;
    rect.width = rect.width || width;
    rect.height = rect.height || height;

    // Check negative values
    rect.x = Math.max(0, rect.x);
    rect.y = Math.max(0, rect.y);
    rect.width = Math.max(0, rect.width);
    rect.height = Math.max(0, rect.height);

    // Check dimensions
    rect.x = Math.min(rect.x, width - 1); // -1 to make sure that there is an image
    rect.y = Math.min(rect.y, height - 1);
    rect.width = Math.min(rect.width, width - rect.x);
    rect.height = Math.min(rect.height, height - rect.y);
  }

  /**
   * Calculates the distance of colors in the 4 dimensional color space
   *
   * @method _colorDelta
   * @param {Color} color1 Values for color 1
   * @param {Color} color2 Values for color 2
   * @return {number} Distance
   */
  _colorDelta(color1, color2) {
    var c1, c2, c3, c4;

    c1 = Math.pow(color1.c1 - color2.c1, 2);
    c2 = Math.pow(color1.c2 - color2.c2, 2);
    c3 = Math.pow(color1.c3 - color2.c3, 2);
    c4 = Math.pow(color1.c4 - color2.c4, 2);

    return Math.sqrt(c1 + c2 + c3 + c4);
  }

  /**
   * Gets the color of an image by the index
   *
   * @method _getColor
   * @param {PNGImage} image Image
   * @param {int} idx Index of pixel in image
   * @param {boolean=} perceptual
   * @param {Gamma=} gamma
   * @return {Color}
   */
  _getColor(image, idx, perceptual, gamma) {
    var color = {
      c1: image.getRed(idx), c2: image.getGreen(idx), c3: image.getBlue(idx), c4: image.getAlpha(idx)
    };

    if (perceptual || gamma) {
      color = this._correctGamma(color, gamma);
      color = this._convertRgbToXyz(color);
      color = this._convertXyzToCieLab(color);
    }

    return color;
  }

  /**
   * Correct gamma and return color in [0, 1] range
   *
   * @method _correctGamma
   * @param {Color} color
   * @param {Gamma=} gamma
   * @return {Color}
   */
  _correctGamma(color, gamma) {

    // Convert to range [0, 1]
    var result = {
      c1: color.c1 / 255, c2: color.c2 / 255, c3: color.c3 / 255, c4: color.c4
    };

    if (gamma && (gamma.R !== undefined || gamma.G !== undefined || gamma.B !== undefined)) {
      if (gamma.R !== undefined) {
        result.c1 = Math.pow(result.c1, gamma.R);
      }
      if (gamma.G !== undefined) {
        result.c2 = Math.pow(result.c2, gamma.G);
      }
      if (gamma.B !== undefined) {
        result.c3 = Math.pow(result.c3, gamma.B);
      }
    }

    return result;
  }

  /**
   * Converts the color from RGB to XYZ
   *
   * @method _convertRgbToXyz
   * @param {Color} color
   * @return {Color}
   */
  _convertRgbToXyz(color) {
    var result = {};

    result.c1 = color.c1 * 0.4887180 + color.c2 * 0.3106803 + color.c3 * 0.2006017;
    result.c2 = color.c1 * 0.1762044 + color.c2 * 0.8129847 + color.c3 * 0.0108109;
    result.c3 = color.c2 * 0.0102048 + color.c3 * 0.9897952;
    result.c4 = color.c4;

    return result;
  }

  /**
   * Converts the color from XYZ to CieLab
   *
   * @method _convertXyzToCieLab
   * @param {Color} color
   * @return {Color}
   */
  _convertXyzToCieLab(color) {
    var result = {}, c1, c2, c3;

    /**
     * @param {number} t 
     * @returns {number}
     */
    function f (t) {
      return (t > 0.00885645167904) ? Math.pow(t, 1 / 3) : 70.08333333333263 * t + 0.13793103448276;
    }

    c1 = f(color.c1 / this._refWhite.c1);
    c2 = f(color.c2 / this._refWhite.c2);
    c3 = f(color.c3 / this._refWhite.c3);

    result.c1 = (116 * c2) - 16;
    result.c2 = 500 * (c1 - c2);
    result.c3 = 200 * (c2 - c3);
    result.c4 = color.c4;

    return result;
  }

  /**
   * Calculates the lower limit
   *
   * @method _calculateLowerLimit
   * @param {int} value
   * @param {int} min
   * @param {int} shift
   * @return {int}
   */
  _calculateLowerLimit(value, min, shift) {
    return (value - shift) < min ? -(shift + (value - shift)) : -shift;
  }

  /**
   * Calculates the upper limit
   *
   * @method _calculateUpperLimit
   * @param {int} value
   * @param {int} max
   * @param {int} shift
   * @return {int}
   */
  _calculateUpperLimit(value, max, shift) {
    return (value + shift) > max ? (max - value) : shift;
  }

  /**
   * Checks if any pixel in the shift surrounding has a comparable color
   *
   * @method _shiftCompare
   * @param {int} x
   * @param {int} y
   * @param {Color} color
   * @param {number} deltaThreshold
   * @param {PNGImage} imageA
   * @param {PNGImage} imageB
   * @param {int} width
   * @param {int} height
   * @param {int} hShift
   * @param {int} vShift
   * @param {boolean=} perceptual
   * @param {Gamma=} gamma
   * @return {boolean} Is pixel within delta found in surrounding?
   */
  _shiftCompare(x, y, color, deltaThreshold, imageA, imageB, width, height, hShift, vShift, perceptual, gamma) {

    var i, xOffset, xLow, xHigh, yOffset, yLow, yHigh, delta, localDeltaThreshold;

    if ((hShift > 0) || (vShift > 0)) {

      xLow = this._calculateLowerLimit(x, 0, hShift);
      xHigh = this._calculateUpperLimit(x, width - 1, hShift);

      yLow = this._calculateLowerLimit(y, 0, vShift);
      yHigh = this._calculateUpperLimit(y, height - 1, vShift);

      for (xOffset = xLow; xOffset <= xHigh; xOffset++) {
        for (yOffset = yLow; yOffset <= yHigh; yOffset++) {

          if ((xOffset != 0) || (yOffset != 0)) {

            i = imageB.getIndex(x + xOffset, y + yOffset);

            var color1 = this._getColor(imageA, i, perceptual, gamma);
            localDeltaThreshold = this._colorDelta(color, color1);

            var color2 = this._getColor(imageB, i, perceptual, gamma);
            delta = this._colorDelta(color, color2);

            if ((Math.abs(delta - localDeltaThreshold) < deltaThreshold) && (localDeltaThreshold > deltaThreshold)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Does a quick comparison between the supplied images
   *
   * @method _pixelCompare
   * @param {PNGImage} imageA
   * @param {PNGImage} imageB
   * @param {PNGImage} imageOutput
   * @param {number} deltaThreshold
   * @param {int} width Width of image
   * @param {int} height Height of image
   * @param {RGBAOColor} outputMaskColor
   * @param {RGBAOColor} outputShiftColor
   * @param {RGBAOColor} backgroundColor
   * @param {int=} hShift Horizontal shift
   * @param {int=} vShift Vertical shift
   * @param {boolean=} perceptual
   * @param {Gamma=} gamma
   * @return {int} Number of pixel differences
   */
  _pixelCompare(imageA, imageB, imageOutput, deltaThreshold, width, height, outputMaskColor, outputShiftColor, backgroundColor, hShift, vShift, perceptual, gamma) {
    var difference = 0, i, x, y, delta;

    for (x = 0; x < width; x++) {
      for (y = 0; y < height; y++) {
        i = imageA.getIndex(x, y);

        var color1 = this._getColor(imageA, i, perceptual, gamma);
        var color2 = this._getColor(imageB, i, perceptual, gamma);

        delta = this._colorDelta(color1, color2);

        if (delta > deltaThreshold) {

          if (this._shiftCompare(x, y, color1, deltaThreshold, imageA, imageB, width, height, hShift || 0, vShift || 0, perceptual, gamma) && this._shiftCompare(x, y, color2, deltaThreshold, imageB, imageA, width, height, hShift || 0, vShift || 0, perceptual, gamma)) {
            imageOutput.setAtIndex(i, outputShiftColor);
          } else {
            difference++;
            imageOutput.setAtIndex(i, outputMaskColor);
          }

        } else {
          imageOutput.setAtIndex(i, backgroundColor);
        }
      }
    }

    return difference;
  }

  /**
   * Compares the two images supplied
   *
   * @method _compare
   * @param {PNGImage} imageA
   * @param {PNGImage} imageB
   * @param {PNGImage} imageOutput
   * @param {number} deltaThreshold
   * @param {RGBAOColor} outputMaskColor
   * @param {RGBAOColor} outputShiftColor
   * @param {RGBAOColor} backgroundColor
   * @param {int=} hShift
   * @param {int=} vShift
   * @param {boolean=} perceptual
   * @param {Gamma=} gamma
   * @return {Result}
   */
  _compare(imageA, imageB, imageOutput, deltaThreshold, outputMaskColor, outputShiftColor, backgroundColor, hShift, vShift, perceptual, gamma) {

    /** @type {any} */
    var result = {
      code: BlinkDiff.RESULT_UNKNOWN,
      differences: undefined,
      dimension: undefined,
      width: undefined,
      height: undefined
    };

    // Get some data needed for comparison
    result.width = imageA.getWidth();
    result.height = imageA.getHeight();
    result.dimension = result.width * result.height;

    // Check if identical
    result.differences = this._pixelCompare(imageA, imageB, imageOutput, deltaThreshold, result.width, result.height, outputMaskColor, outputShiftColor, backgroundColor, hShift, vShift, perceptual, gamma);

    // Result
    if (result.differences == 0) {
      this.log("Images are identical or near identical");
      result.code = BlinkDiff.RESULT_IDENTICAL;
      return result;

    } else if (this.isAboveThreshold(result.differences, result.dimension)) {
      this.log("Images are visibly different");
      this.log(result.differences + " pixels are different");
      result.code = BlinkDiff.RESULT_DIFFERENT;
      return result;

    } else {
      this.log("Images are similar");
      this.log(result.differences + " pixels are different");
      result.code = BlinkDiff.RESULT_SIMILAR;
      return result;
    }
  }
};


/**
 * Threshold-type for pixel
 *
 * @static
 * @property THRESHOLD_PIXEL
 * @type {string}
 */
BlinkDiff.THRESHOLD_PIXEL = 'pixel';

/**
 * Threshold-type for percent of all pixels
 *
 * @static
 * @property THRESHOLD_PERCENT
 * @type {string}
 */
BlinkDiff.THRESHOLD_PERCENT = 'percent';


/**
 * Unknown result of the comparison
 *
 * @static
 * @property RESULT_UNKNOWN
 * @type {int}
 */
BlinkDiff.RESULT_UNKNOWN = 0;

/**
 * The images are too different
 *
 * @static
 * @property RESULT_DIFFERENT
 * @type {int}
 */
BlinkDiff.RESULT_DIFFERENT = 1;

/**
 * The images are very similar, but still below the threshold
 *
 * @static
 * @property RESULT_SIMILAR
 * @type {int}
 */
BlinkDiff.RESULT_SIMILAR = 7;

/**
 * The images are identical (or near identical)
 *
 * @static
 * @property RESULT_IDENTICAL
 * @type {int}
 */
BlinkDiff.RESULT_IDENTICAL = 5;


/**
 * Create output when images are different
 *
 * @static
 * @property OUTPUT_DIFFERENT
 * @type {int}
 */
BlinkDiff.OUTPUT_DIFFERENT = 10;

/**
 * Create output when images are similar or different
 *
 * @static
 * @property OUTPUT_SIMILAR
 * @type {int}
 */
BlinkDiff.OUTPUT_SIMILAR = 20;

/**
 * Force output of all comparisons
 *
 * @static
 * @property OUTPUT_ALL
 * @type {int}
 */
BlinkDiff.OUTPUT_ALL = 100;

module.exports = BlinkDiff;
