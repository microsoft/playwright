/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require('path');

// Hack for our own tests.
const testRunnerTestFile = path.join(__dirname, 'test', 'testrunner.spec.js');

class Location {
  constructor() {
    this._fileName = '';
    this._filePath = '';
    this._lineNumber = 0;
    this._columnNumber = 0;
  }

  fileName() {
    return this._fileName;
  }

  filePath() {
    return this._filePath;
  }

  lineNumber() {
    return this._lineNumber;
  }

  columnNumber() {
    return this._columnNumber;
  }

  toString() {
    return this._fileName + ':' + this._lineNumber;
  }

  toDetailedString() {
    return this._fileName + ':' + this._lineNumber + ':' + this._columnNumber;
  }

  static getCallerLocation(ignorePrefix = __dirname) {
    const error = new Error();
    const stackFrames = error.stack.split('\n').slice(1);
    const location = new Location();
    // Find first stackframe that doesn't point to this file.
    for (let frame of stackFrames) {
      frame = frame.trim();
      if (!frame.startsWith('at '))
        return null;
      if (frame.endsWith(')')) {
        const from = frame.indexOf('(');
        frame = frame.substring(from + 1, frame.length - 1);
      } else {
        frame = frame.substring('at '.length);
      }

      const match = frame.match(/^(.*):(\d+):(\d+)$/);
      if (!match)
        return null;
      const filePath = match[1];
      if (filePath === __filename || (filePath.startsWith(ignorePrefix) && filePath !== testRunnerTestFile))
        continue;

      location._filePath = filePath;
      location._fileName = filePath.split(path.sep).pop();
      location._lineNumber = parseInt(match[2], 10);
      location._columnNumber = parseInt(match[3], 10);
      return location;
    }
    return location;
  }
}

module.exports = Location;
