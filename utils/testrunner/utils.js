const path = require('path');

module.exports = {
  getCallerLocation: function(filename) {
    const error = new Error();
    const stackFrames = error.stack.split('\n').slice(1);
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
      const lineNumber = parseInt(match[2], 10);
      const columnNumber = parseInt(match[3], 10);
      if (filePath === __filename || filePath === filename)
        continue;
      const fileName = filePath.split(path.sep).pop();
      return { fileName, filePath, lineNumber, columnNumber };
    }
    return null;
  },
};
