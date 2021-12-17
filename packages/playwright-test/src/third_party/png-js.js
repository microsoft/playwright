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
 * @typedef {{red: int, green: int, blue: int, alpha: int | undefined, opacity: float}} RGBAOColor
 */

const { PNG } = require('pngjs');
const fs = require('fs');

class PNGImage {
  /**
   * Creates an image by dimensions
   *
   * @static
   * @method createImage
   * @param {int} width
   * @param {int} height
   * @return {PNGImage}
   */
  static createImage = function (width, height) {
    var image = new PNG({
      width: width,
      height: height
    });
    return new PNGImage(image);
  }

  /**
   * Copies an already existing image
   *
   * @static
   * @method copyImage
   * @param {PNGImage} image
   * @return {PNGImage}
   */
  static copyImage(image) {
    var newImage = this.createImage(image.getWidth(), image.getHeight());
    PNG.bitblt(image.getImage(), newImage.getImage(), 0, 0, image.getWidth(), image.getHeight(), 0, 0);
    return newImage;
  }

  /**
   * @param {Buffer} buffer
   * @returns {PNGImage}
   */
  static loadImageSync(buffer) {
    return new PNGImage(PNG.sync.read(buffer));
  }

  /**
   * @param {string} path
   * @returns {PNGImage}
   */
   static readImageSync(path) {
    return this.loadImageSync(fs.readFileSync(path));
  }

  /** @param {PNG} image */
  constructor(image) {
    /** @type {PNG} */
    this._image = image;
  }

  /**
   * Gets the original png-js object
   *
   * @method getImage
   * @return {PNG}
   */
  getImage() {
    return this._image;
  }

  /**
   * Gets the width of the image
   *
   * @method getWidth
   * @return {int}
   */
  getWidth() {
    return this._image.width;
  }

  /**
   * Gets the height of the image
   *
   * @method getHeight
   * @return {int}
   */
  getHeight() {
    return this._image.height;
  }

  /**
   * Clips the current image by modifying it in-place
   *
   * @method clip
   * @param {int} x Starting x-coordinate
   * @param {int} y Starting y-coordinate
   * @param {int} width Width of area relative to starting coordinate
   * @param {int} height Height of area relative to starting coordinate
   */
  clip(x, y, width, height) {

    var image;

    width = Math.min(width, this.getWidth() - x);
    height = Math.min(height, this.getHeight() - y);

    if ((width < 0) || (height < 0)) {
      throw new Error('Width and height cannot be negative.');
    }

    image = new PNG({
      width: width, height: height
    });

    this._image.bitblt(image, x, y, width, height, 0, 0);
    this._image = image;
  }

  /**
   * Fills an area with the specified color
   *
   * @method fillRect
   * @param {int} x Starting x-coordinate
   * @param {int} y Starting y-coordinate
   * @param {int} width Width of area relative to starting coordinate
   * @param {int} height Height of area relative to starting coordinate
   * @param {RGBAOColor} color
   */
  fillRect(x, y, width, height, color) {
    var i,
      iLen = x + width,
      j,
      jLen = y + height,
      index;

    for (i = x; i < iLen; i++) {
      for (j = y; j < jLen; j++) {
        index = this.getIndex(i, j);
        this.setAtIndex(index, color);
      }
    }
  }

  /**
   * Gets index of a specific coordinate
   *
   * @method getIndex
   * @param {int} x X-coordinate of pixel
   * @param {int} y Y-coordinate of pixel
   * @return {int} Index of pixel
   */
  getIndex(x, y) {
    return (this.getWidth() * y) + x;
  }

  /**
   * Writes the image to the filesystem
   *
   * @method writeImage
   * @param {string} filename Path to file
   * @param {(error: Error | undefined, image: PNGImage) => void} fn Callback
   */
  writeImage(filename, fn) {
    fn = fn || (() => {});
    this._image.pack().pipe(fs.createWriteStream(filename)).once('close', () => {
      this._image.removeListener('error', fn);
      fn(undefined, this);
    }).once('error', (err) => {
      this._image.removeListener('close', fn);
      fn(err, this);
    });
  }

  /**
   * @param {string} filename
   */
  writeImageSync(filename) {
    fs.writeFileSync(filename, PNG.sync.write(this._image));
  }

  /**
   * Gets the color of a pixel at a specific index
   *
   * @method getPixel
   * @param {int} idx Index of pixel
   * @return {int} Color
   */
  getAtIndex(idx) {
    return this.getColorAtIndex(idx) | (this.getAlpha(idx) << 24);
  }

  /**
   * Gets the color of a pixel at a specific coordinate
   *
   * @method getAt
   * @param {int} x X-coordinate of pixel
   * @param {int} y Y-coordinate of pixel
   * @return {int} Color
   */
  getAt(x, y) {
    var idx = this.getIndex(x, y);
    return this.getAtIndex(idx);
  }

  /**
   * Gets the color of a pixel at a specific coordinate
   * Alias for getAt
   *
   * @method getPixel
   * @param {int} x X-coordinate of pixel
   * @param {int} y Y-coordinate of pixel
   * @return {int} Color
   */
  getPixel(x, y) {
    return this.getAt(x, y);
  }

  /**
   * Sets the color of a pixel at a specific index
   *
   * @method setAtIndex
   * @param {int} idx Index of pixel
   * @param {RGBAOColor|int} color
   */
  setAtIndex(idx, color) {
    if (typeof color === 'object') {
      if (color.red !== undefined) this.setRed(idx, color.red, color.opacity);
      if (color.green !== undefined) this.setGreen(idx, color.green, color.opacity);
      if (color.blue !== undefined) this.setBlue(idx, color.blue, color.opacity);
      if (color.alpha !== undefined) this.setAlpha(idx, color.alpha, color.opacity);
    } else {
      this.setRed(idx, color & 0xff);
      this.setGreen(idx, (color & 0xff00) >> 8);
      this.setBlue(idx, (color & 0xff0000) >> 16);
      this.setAlpha(idx, (color & 0xff000000) >> 24);
    }
  }

  /**
   * Sets the color of a pixel at a specific coordinate
   *
   * @method setAt
   * @param {int} x X-coordinate for pixel
   * @param {int} y Y-coordinate for pixel
   * @param {RGBAOColor} color
   */
  setAt(x, y, color) {
    var idx = this.getIndex(x, y);
    this.setAtIndex(idx, color);
  }

  /**
   * Sets the color of a pixel at a specific coordinate
   * Alias for setAt
   *
   * @method setPixel
   * @param {int} x X-coordinate for pixel
   * @param {int} y Y-coordinate for pixel
   * @param {RGBAOColor} color
   */
  setPixel(x, y, color) {
    this.setAt(x, y, color);
  }

  /**
   * Gets the color of a pixel at a specific index
   *
   * @method getColorAtIndex
   * @param {int} idx Index of pixel
   * @return {int} Color
   */
  getColorAtIndex(idx) {
    return this.getRed(idx) | (this.getGreen(idx) << 8) | (this.getBlue(idx) << 16);
  }

  /**
   * Gets the color of a pixel at a specific coordinate
   *
   * @method getColor
   * @param {int} x X-coordinate of pixel
   * @param {int} y Y-coordinate of pixel
   * @return {int} Color
   */
  getColor(x, y) {
    var idx = this.getIndex(x, y);
    return this.getColorAtIndex(idx);
  }

  /**
   * Calculates the final color value for opacity
   *
   * @method _calculateColorValue
   * @param {int} originalValue
   * @param {int} paintValue
   * @param {number} [opacity]
   * @return {int}
   * @private
   */
  _calculateColorValue(originalValue, paintValue, opacity) {

    var originalPart, paintPart;

    if (opacity === undefined) {
      return paintValue;
    } else {
      originalPart = originalValue   * (1 - opacity);
      paintPart = (paintValue   * opacity);

      return Math.floor(originalPart + paintPart);
    }
  }

  /**
   * Get the red value of a pixel
   *
   * @method getRed
   * @param {int} idx Index of pixel
   * @return {int}
   */
  getRed(idx) {
    return this._getValue(idx, 0);
  }

  /**
   * Set the red value of a pixel
   *
   * @method setRed
   * @param {int} idx Index of pixel
   * @param {int} value Value for pixel
   * @param {number} [opacity] Opacity of value set
   */
  setRed(idx, value, opacity) {
    this._setValue(idx, 0, value, opacity);
  }

  /**
   * Get the green value of a pixel
   *
   * @method getGreen
   * @param {int} idx Index of pixel
   * @return {int}
   */
  getGreen(idx) {
    return this._getValue(idx, 1);
  }

  /**
   * Set the green value of a pixel
   *
   * @method setGreen
   * @param {int} idx Index of pixel
   * @param {int} value Value for pixel
   * @param {number} [opacity] Opacity of value set
   */
  setGreen(idx, value, opacity) {
    this._setValue(idx, 1, value, opacity);
  }

  /**
   * Get the blue value of a pixel
   *
   * @method getBlue
   * @param {int} idx Index of pixel
   * @return {int}
   */
  getBlue(idx) {
    return this._getValue(idx, 2);
  }

  /**
   * Set the blue value of a pixel
   *
   * @method setBlue
   * @param {int} idx Index of pixel
   * @param {int} value Value for pixel
   * @param {number} [opacity] Opacity of value set
   */
  setBlue(idx, value, opacity) {
    this._setValue(idx, 2, value, opacity);
  }

  /**
   * Get the alpha value of a pixel
   *
   * @method getAlpha
   * @param {int} idx Index of pixel
   * @return {int}
   */
  getAlpha(idx) {
    return this._getValue(idx, 3);
  }

  /**
   * Set the alpha value of a pixel
   *
   * @method setAlpha
   * @param {int} idx Index of pixel
   * @param {int} value Value for pixel
   * @param {number} [opacity] Opacity of value set
   */
  setAlpha(idx, value, opacity) {
    this._setValue(idx, 3, value, opacity);
  }

  /**
   * Sets the value of a pixel
   *
   * @method _getValue
   * @param {int} offset Offset of a value
   * @param {int} colorOffset Offset of a color
   * @return {int}
   * @private
   */
  _getValue(offset, colorOffset) {
    var localOffset = offset << 2;
    return this._image.data[localOffset + colorOffset];
  }

  /**
   * Sets the value of a pixel
   *
   * @method _setValue
   * @param {int} offset Offset of a value
   * @param {int} colorOffset Offset of a color
   * @param {int} value Value for pixel
   * @param {number} [opacity] Opacity of value set
   * @private
   */
  _setValue(offset, colorOffset, value, opacity) {
    var previousValue = this._getValue(offset, colorOffset),
      localOffset = offset << 2;

    this._image.data[localOffset + colorOffset] = this._calculateColorValue(previousValue, value, opacity);
  }
}

module.exports = PNGImage;
