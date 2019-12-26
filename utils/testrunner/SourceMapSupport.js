// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const fs = require('fs');
const path = require('path');
const {TextSourceMap} = require('./SourceMap');
const util = require('util');

const readFileAsync = util.promisify(fs.readFile.bind(fs));

class SourceMapSupport {
  constructor() {
    this._sourceMapPromises = new Map();
  }

  async rewriteStackTraceWithSourceMaps(error) {
    const stackFrames = error.stack.split('\n');
    for (let i = 0; i < stackFrames.length; ++i) {
      const stackFrame = stackFrames[i];

      let match = stackFrame.match(/\((.*):(\d+):(\d+)\)$/);
      if (!match)
        match = stackFrame.match(/^\s*at (.*):(\d+):(\d+)$/);
      if (!match)
        continue;
      const filePath = match[1];
      const sourceMap = await this._maybeLoadSourceMapForPath(filePath);
      if (!sourceMap)
        continue;
      const compiledLineNumber = parseInt(match[2], 10);
      const compiledColumnNumber = parseInt(match[3], 10);
      if (isNaN(compiledLineNumber) || isNaN(compiledColumnNumber))
        continue;
      const entry = sourceMap.findEntry(compiledLineNumber, compiledColumnNumber);
      if (!entry)
        continue;
      stackFrames[i] = stackFrame.replace(filePath + ':' + compiledLineNumber + ':' + compiledColumnNumber, entry.sourceURL + ':' + entry.sourceLineNumber + ':' + entry.sourceColumnNumber);
    }
    error.stack = stackFrames.join('\n');
  }

  async _maybeLoadSourceMapForPath(filePath) {
    let sourceMapPromise = this._sourceMapPromises.get(filePath);
    if (sourceMapPromise === undefined) {
      sourceMapPromise = this._loadSourceMapForPath(filePath);
      this._sourceMapPromises.set(filePath, sourceMapPromise);
    }
    return sourceMapPromise;
  }

  async _loadSourceMapForPath(filePath) {
    try {
      const fileContent = await readFileAsync(filePath, 'utf8');
      const magicCommentLine = fileContent.trim().split('\n').pop().trim();
      const magicCommentMatch = magicCommentLine.match('^//#\\s*sourceMappingURL\\s*=(.*)$');
      if (!magicCommentMatch)
        return null;
      const sourceMappingURL = magicCommentMatch[1].trim();

      const sourceMapPath = path.resolve(path.dirname(filePath), sourceMappingURL);
      const json = JSON.parse(await readFileAsync(sourceMapPath, 'utf8'));
      return new TextSourceMap(filePath, sourceMapPath, json);
    } catch(e) {
      return null;
    }
  }
}

module.exports = {SourceMapSupport};
