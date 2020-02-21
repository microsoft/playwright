/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const {getCallerLocation} = require('./utils.js');
const colors = require('colors/safe');
const Diff = require('text-diff');

class Matchers {
  constructor(customMatchers = {}) {
    this._matchers = {};
    Object.assign(this._matchers, DefaultMatchers);
    Object.assign(this._matchers, customMatchers);
    this.expect = this.expect.bind(this);
  }

  addMatcher(name, matcher) {
    this._matchers[name] = matcher;
  }

  expect(received) {
    return new Expect(received, this._matchers);
  }
};

class MatchError extends Error {
  constructor(message, formatter) {
    super(message);
    this.name = this.constructor.name;
    this.formatter = formatter;
    this.location = getCallerLocation(__filename);
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {Matchers, MatchError};

class Expect {
  constructor(received, matchers) {
    this.not = {};
    this.not.not = this;
    for (const matcherName of Object.keys(matchers)) {
      const matcher = matchers[matcherName];
      this[matcherName] = applyMatcher.bind(null, matcherName, matcher, false /* inverse */, received);
      this.not[matcherName] = applyMatcher.bind(null, matcherName, matcher, true /* inverse */, received);
    }

    function applyMatcher(matcherName, matcher, inverse, received, ...args) {
      const result = matcher.call(null, received, ...args);
      const message = `expect.${inverse ? 'not.' : ''}${matcherName} failed` + (result.message ? `: ${result.message}` : '');
      if (result.pass === inverse)
        throw new MatchError(message, result.formatter || defaultFormatter.bind(null, received));
    }
  }
}

function defaultFormatter(received) {
  return `Received: ${colors.red(JSON.stringify(received))}`;
}

function stringFormatter(received, expected) {
  const diff = new Diff();
  const result = diff.main(expected, received);
  diff.cleanupSemantic(result);
  const highlighted = result.map(([type, text]) => {
    if (type === -1)
      return colors.bgRed(text);
    if (type === 1)
      return colors.bgGreen.black(text);
    return text;
  }).join('');
  const output = [
    `Expected: ${expected}`,
    `Received: ${highlighted}`,
  ];
  for (let i = 0; i < Math.min(expected.length, received.length); ++i) {
    if (expected[i] !== received[i]) {
      const padding = ' '.repeat('Expected: '.length);
      const firstDiffCharacter = '~'.repeat(i) + '^';
      output.push(colors.red(padding + firstDiffCharacter));
      break;
    }
  }
  return output.join('\n');
}

function objectFormatter(received, expected) {
  const receivedLines = received.split('\n');
  const expectedLines = expected.split('\n');
  const encodingMap = new Map();
  const decodingMap = new Map();

  const doEncodeLines = (lines) => {
    let encoded = '';
    for (const line of lines) {
      let code = encodingMap.get(line);
      if (!code) {
        code = String.fromCodePoint(encodingMap.size);
        encodingMap.set(line, code);
        decodingMap.set(code, line);
      }
      encoded += code;
    }
    return encoded;
  };

  const doDecodeLines = (text) => {
    let decoded = [];
    for (const codepoint of [...text])
      decoded.push(decodingMap.get(codepoint));
    return decoded;
  }

  let receivedEncoded = doEncodeLines(received.split('\n'));
  let expectedEncoded = doEncodeLines(expected.split('\n'));

  const diff = new Diff();
  const result = diff.main(expectedEncoded, receivedEncoded);
  diff.cleanupSemantic(result);

  const highlighted = result.map(([type, text]) => {
    const lines = doDecodeLines(text);
    if (type === -1)
      return lines.map(line => '-   ' + colors.bgRed(line));
    if (type === 1)
      return lines.map(line => '+   ' + colors.bgGreen.black(line));
    return lines.map(line => '    ' + line);
  }).flat().join('\n');
  return `Received:\n${highlighted}`;
}

function toBeFormatter(received, expected) {
  if (typeof expected === 'string' && typeof received === 'string') {
    return stringFormatter(JSON.stringify(received), JSON.stringify(expected));
  }
  return [
    `Expected: ${JSON.stringify(expected)}`,
    `Received: ${colors.red(JSON.stringify(received))}`,
  ].join('\n');
}

const DefaultMatchers = {
  toBe: function(received, expected, message) {
    message = message || `${received} == ${expected}`;
    return { pass: received === expected, message, formatter: toBeFormatter.bind(null, received, expected) };
  },

  toBeFalsy: function(received, message) {
    message = message || `${received}`;
    return { pass: !received, message };
  },

  toBeTruthy: function(received, message) {
    message = message || `${received}`;
    return { pass: !!received, message };
  },

  toBeGreaterThan: function(received, other, message) {
    message = message || `${received} > ${other}`;
    return { pass: received > other, message };
  },

  toBeGreaterThanOrEqual: function(received, other, message) {
    message = message || `${received} >= ${other}`;
    return { pass: received >= other, message };
  },

  toBeLessThan: function(received, other, message) {
    message = message || `${received} < ${other}`;
    return { pass: received < other, message };
  },

  toBeLessThanOrEqual: function(received, other, message) {
    message = message || `${received} <= ${other}`;
    return { pass: received <= other, message };
  },

  toBeNull: function(received, message) {
    message = message || `${received} == null`;
    return { pass: received === null, message };
  },

  toContain: function(received, other, message) {
    message = message || `${received} ⊇ ${other}`;
    return { pass: received.includes(other), message };
  },

  toEqual: function(received, other, message) {
    let receivedJson = stringify(received);
    let otherJson = stringify(other);
    let formatter = objectFormatter.bind(null, receivedJson, otherJson);
    if (receivedJson.length < 40 && otherJson.length < 40) {
      receivedJson = receivedJson.split('\n').map(line => line.trim()).join(' ');
      otherJson = otherJson.split('\n').map(line => line.trim()).join(' ');
      formatter = stringFormatter.bind(null, receivedJson, otherJson);
    }
    message = message || `\n${receivedJson} ≈ ${otherJson}`;
    return { pass: receivedJson === otherJson, message, formatter };
  },

  toBeCloseTo: function(received, other, precision, message) {
    return {
      pass: Math.abs(received - other) < Math.pow(10, -precision),
      message
    };
  },

  toBeInstanceOf: function(received, other, message) {
    message = message || `${received.constructor.name} instanceof ${other.name}`;
    return { pass: received instanceof other, message };
  },
};

function stringify(value) {
  function stabilize(key, object) {
    if (typeof object !== 'object' || object === undefined || object === null || Array.isArray(object))
      return object;
    const result = {};
    for (const key of Object.keys(object).sort())
      result[key] = object[key];
    return result;
  }

  return JSON.stringify(stabilize(null, value), stabilize, 2);
}
