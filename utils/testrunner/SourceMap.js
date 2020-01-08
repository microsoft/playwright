/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

const path = require('path');

function upperBound(array, object, comparator, left, right) {
  function defaultComparator(a, b) {
    return a < b ? -1 : (a > b ? 1 : 0);
  }
  comparator = comparator || defaultComparator;
  let l = left || 0;
  let r = right !== undefined ? right : array.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (comparator(object, array[m]) >= 0) {
      l = m + 1;
    } else {
      r = m;
    }
  }
  return r;
}

/**
 * @interface
 */
class SourceMap {
  /**
   * @return {string}
   */
  compiledURL() {
  }

  /**
   * @return {string}
   */
  url() {
  }

  /**
   * @return {!Array<string>}
   */
  sourceURLs() {
  }

  /**
   * @param {string} sourceURL
   * @return {?string}
   */
  embeddedContentByURL(sourceURL) {
  }

  /**
   * @param {number} lineNumber in compiled resource
   * @param {number} columnNumber in compiled resource
   * @return {?SourceMapEntry}
   */
  findEntry(lineNumber, columnNumber) {
  }

  /**
   * @param {string} sourceURL
   * @param {number} lineNumber
   * @param {number} columnNumber
   * @return {?SourceMapEntry}
   */
  sourceLineMapping(sourceURL, lineNumber, columnNumber) {
  }

  /**
   * @return {!Array<!SourceMapEntry>}
   */
  mappings() {
  }

  dispose() {
  }
}

/**
 * @unrestricted
 */
class SourceMapV3 {
  constructor() {
    /** @type {number} */ this.version;
    /** @type {string|undefined} */ this.file;
    /** @type {!Array.<string>} */ this.sources;
    /** @type {!Array.<!SourceMapV3.Section>|undefined} */ this.sections;
    /** @type {string} */ this.mappings;
    /** @type {string|undefined} */ this.sourceRoot;
    /** @type {!Array.<string>|undefined} */ this.names;
  }
}

/**
 * @unrestricted
 */
SourceMapV3.Section = class {
  constructor() {
    /** @type {!SourceMapV3} */ this.map;
    /** @type {!SourceMapV3.Offset} */ this.offset;
  }
};

/**
 * @unrestricted
 */
SourceMapV3.Offset = class {
  constructor() {
    /** @type {number} */ this.line;
    /** @type {number} */ this.column;
  }
};

/**
 * @unrestricted
 */
class SourceMapEntry {
  /**
   * @param {number} lineNumber
   * @param {number} columnNumber
   * @param {string=} sourceURL
   * @param {number=} sourceLineNumber
   * @param {number=} sourceColumnNumber
   * @param {string=} name
   */
  constructor(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber, name) {
    this.lineNumber = lineNumber;
    this.columnNumber = columnNumber;
    this.sourceURL = sourceURL;
    this.sourceLineNumber = sourceLineNumber;
    this.sourceColumnNumber = sourceColumnNumber;
    this.name = name;
  }

  /**
   * @param {!SourceMapEntry} entry1
   * @param {!SourceMapEntry} entry2
   * @return {number}
   */
  static compare(entry1, entry2) {
    if (entry1.lineNumber !== entry2.lineNumber) {
      return entry1.lineNumber - entry2.lineNumber;
    }
    return entry1.columnNumber - entry2.columnNumber;
  }
}

/**
 * @implements {SourceMap}
 * @unrestricted
 */
class TextSourceMap {
  /**
   * Implements Source Map V3 model. See https://github.com/google/closure-compiler/wiki/Source-Maps
   * for format description.
   * @param {string} compiledURL
   * @param {string} sourceMappingURL
   * @param {!SourceMapV3} payload
   */
  constructor(compiledURL, sourceMappingURL, payload) {
    if (!TextSourceMap._base64Map) {
      const base64Digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      TextSourceMap._base64Map = {};
      for (let i = 0; i < base64Digits.length; ++i) {
        TextSourceMap._base64Map[base64Digits.charAt(i)] = i;
      }
    }

    this._json = payload;
    this._compiledURL = compiledURL;
    this._sourceMappingURL = sourceMappingURL;
    this._baseURL = sourceMappingURL.startsWith('data:') ? compiledURL : sourceMappingURL;

    /** @type {?Array<!SourceMapEntry>} */
    this._mappings = null;
    /** @type {!Map<string, !TextSourceMap.SourceInfo>} */
    this._sourceInfos = new Map();
    if (this._json.sections) {
      const sectionWithURL = !!this._json.sections.find(section => !!section.url);
      if (sectionWithURL) {
        cosole.warn(`SourceMap "${sourceMappingURL}" contains unsupported "URL" field in one of its sections.`);
      }
    }
    this._eachSection(this._parseSources.bind(this));
  }

  /**
   * @override
   * @return {string}
   */
  compiledURL() {
    return this._compiledURL;
  }

  /**
   * @override
   * @return {string}
   */
  url() {
    return this._sourceMappingURL;
  }

  /**
   * @override
   * @return {!Array.<string>}
   */
  sourceURLs() {
    return Array.from(this._sourceInfos.keys());
  }

  /**
   * @override
   * @param {string} sourceURL
   * @return {?string}
   */
  embeddedContentByURL(sourceURL) {
    if (!this._sourceInfos.has(sourceURL)) {
      return null;
    }
    return this._sourceInfos.get(sourceURL).content;
  }

  /**
   * @override
   * @param {number} lineNumber in compiled resource
   * @param {number} columnNumber in compiled resource
   * @return {?SourceMapEntry}
   */
  findEntry(lineNumber, columnNumber) {
    const mappings = this.mappings();
    const index = upperBound(mappings, undefined, (unused, entry) => lineNumber - entry.lineNumber || columnNumber - entry.columnNumber);
    return index ? mappings[index - 1] : null;
  }

  /**
   * @override
   * @return {!Array<!SourceMapEntry>}
   */
  mappings() {
    if (this._mappings === null) {
      this._mappings = [];
      this._eachSection(this._parseMap.bind(this));
      this._json = null;
    }
    return /** @type {!Array<!SourceMapEntry>} */ (this._mappings);
  }

  /**
   * @param {function(!SourceMapV3, number, number)} callback
   */
  _eachSection(callback) {
    if (!this._json.sections) {
      callback(this._json, 0, 0);
      return;
    }
    for (const section of this._json.sections) {
      callback(section.map, section.offset.line, section.offset.column);
    }
  }

  /**
   * @param {!SourceMapV3} sourceMap
   */
  _parseSources(sourceMap) {
    const sourcesList = [];
    let sourceRoot = sourceMap.sourceRoot || '';
    if (sourceRoot && !sourceRoot.endsWith('/')) {
      sourceRoot += '/';
    }
    for (let i = 0; i < sourceMap.sources.length; ++i) {
      const href = sourceRoot + sourceMap.sources[i];
      let url = path.resolve(path.dirname(this._baseURL), href);
      const source = sourceMap.sourcesContent && sourceMap.sourcesContent[i];
      if (url === this._compiledURL && source) {
        url += '? [sm]';
      }
      this._sourceInfos.set(url, new TextSourceMap.SourceInfo(source, null));
      sourcesList.push(url);
    }
    sourceMap[TextSourceMap._sourcesListSymbol] = sourcesList;
  }

  /**
   * @param {!SourceMapV3} map
   * @param {number} lineNumber
   * @param {number} columnNumber
   */
  _parseMap(map, lineNumber, columnNumber) {
    let sourceIndex = 0;
    let sourceLineNumber = 0;
    let sourceColumnNumber = 0;
    let nameIndex = 0;
    const sources = map[TextSourceMap._sourcesListSymbol];
    const names = map.names || [];
    const stringCharIterator = new TextSourceMap.StringCharIterator(map.mappings);
    let sourceURL = sources[sourceIndex];

    while (true) {
      if (stringCharIterator.peek() === ',') {
        stringCharIterator.next();
      } else {
        while (stringCharIterator.peek() === ';') {
          lineNumber += 1;
          columnNumber = 0;
          stringCharIterator.next();
        }
        if (!stringCharIterator.hasNext()) {
          break;
        }
      }

      columnNumber += this._decodeVLQ(stringCharIterator);
      if (!stringCharIterator.hasNext() || this._isSeparator(stringCharIterator.peek())) {
        this._mappings.push(new SourceMapEntry(lineNumber, columnNumber));
        continue;
      }

      const sourceIndexDelta = this._decodeVLQ(stringCharIterator);
      if (sourceIndexDelta) {
        sourceIndex += sourceIndexDelta;
        sourceURL = sources[sourceIndex];
      }
      sourceLineNumber += this._decodeVLQ(stringCharIterator);
      sourceColumnNumber += this._decodeVLQ(stringCharIterator);

      if (!stringCharIterator.hasNext() || this._isSeparator(stringCharIterator.peek())) {
        this._mappings.push(
            new SourceMapEntry(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber));
        continue;
      }

      nameIndex += this._decodeVLQ(stringCharIterator);
      this._mappings.push(new SourceMapEntry(
          lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber, names[nameIndex]));
    }

    // As per spec, mappings are not necessarily sorted.
    this._mappings.sort(SourceMapEntry.compare);
  }

  /**
   * @param {string} char
   * @return {boolean}
   */
  _isSeparator(char) {
    return char === ',' || char === ';';
  }

  /**
   * @param {!TextSourceMap.StringCharIterator} stringCharIterator
   * @return {number}
   */
  _decodeVLQ(stringCharIterator) {
    // Read unsigned value.
    let result = 0;
    let shift = 0;
    let digit;
    do {
      digit = TextSourceMap._base64Map[stringCharIterator.next()];
      result += (digit & TextSourceMap._VLQ_BASE_MASK) << shift;
      shift += TextSourceMap._VLQ_BASE_SHIFT;
    } while (digit & TextSourceMap._VLQ_CONTINUATION_MASK);

    // Fix the sign.
    const negative = result & 1;
    result >>= 1;
    return negative ? -result : result;
  }

  /**
   * @override
   */
  dispose() {
  }
}

TextSourceMap._VLQ_BASE_SHIFT = 5;
TextSourceMap._VLQ_BASE_MASK = (1 << 5) - 1;
TextSourceMap._VLQ_CONTINUATION_MASK = 1 << 5;

/**
 * @unrestricted
 */
TextSourceMap.StringCharIterator = class {
  /**
   * @param {string} string
   */
  constructor(string) {
    this._string = string;
    this._position = 0;
  }

  /**
   * @return {string}
   */
  next() {
    return this._string.charAt(this._position++);
  }

  /**
   * @return {string}
   */
  peek() {
    return this._string.charAt(this._position);
  }

  /**
   * @return {boolean}
   */
  hasNext() {
    return this._position < this._string.length;
  }
};

/**
 * @unrestricted
 */
TextSourceMap.SourceInfo = class {
  /**
   * @param {?string} content
   * @param {?Array<!SourceMapEntry>} reverseMappings
   */
  constructor(content, reverseMappings) {
    this.content = content;
    this.reverseMappings = reverseMappings;
  }
};

TextSourceMap._sourcesListSymbol = Symbol('sourcesList');

module.exports = {TextSourceMap};
