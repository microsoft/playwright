"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _base = require("./base");
var _empty = _interopRequireDefault(require("./empty"));
var _utils = require("playwright-core/lib/utils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

class JUnitReporter extends _empty.default {
  constructor(options) {
    var _resolveOutputFile;
    super();
    this.config = void 0;
    this.configDir = void 0;
    this.suite = void 0;
    this.timestamp = void 0;
    this.totalTests = 0;
    this.totalFailures = 0;
    this.totalSkipped = 0;
    this.resolvedOutputFile = void 0;
    this.stripANSIControlSequences = false;
    this.includeProjectInTestName = false;
    this.stripANSIControlSequences = (0, _utils.getAsBooleanFromENV)('PLAYWRIGHT_JUNIT_STRIP_ANSI', !!options.stripANSIControlSequences);
    this.includeProjectInTestName = (0, _utils.getAsBooleanFromENV)('PLAYWRIGHT_JUNIT_INCLUDE_PROJECT_IN_TEST_NAME', !!options.includeProjectInTestName);
    this.configDir = options.configDir;
    this.resolvedOutputFile = (_resolveOutputFile = (0, _base.resolveOutputFile)('JUNIT', options)) === null || _resolveOutputFile === void 0 ? void 0 : _resolveOutputFile.outputFile;
  }
  printsToStdio() {
    return !this.resolvedOutputFile;
  }
  onConfigure(config) {
    this.config = config;
  }
  onBegin(suite) {
    this.suite = suite;
    this.timestamp = new Date();
  }
  async onEnd(result) {
    const children = [];
    for (const projectSuite of this.suite.suites) {
      for (const fileSuite of projectSuite.suites) children.push(await this._buildTestSuite(projectSuite.title, fileSuite));
    }
    const tokens = [];
    const self = this;
    const root = {
      name: 'testsuites',
      attributes: {
        id: process.env[`PLAYWRIGHT_JUNIT_SUITE_ID`] || '',
        name: process.env[`PLAYWRIGHT_JUNIT_SUITE_NAME`] || '',
        tests: self.totalTests,
        failures: self.totalFailures,
        skipped: self.totalSkipped,
        errors: 0,
        time: result.duration / 1000
      },
      children
    };
    serializeXML(root, tokens, this.stripANSIControlSequences);
    const reportString = tokens.join('\n');
    if (this.resolvedOutputFile) {
      await _fs.default.promises.mkdir(_path.default.dirname(this.resolvedOutputFile), {
        recursive: true
      });
      await _fs.default.promises.writeFile(this.resolvedOutputFile, reportString);
    } else {
      console.log(reportString);
    }
  }
  async _buildTestSuite(projectName, suite) {
    let tests = 0;
    let skipped = 0;
    let failures = 0;
    let duration = 0;
    const children = [];
    const testCaseNamePrefix = projectName && this.includeProjectInTestName ? `[${projectName}] ` : '';
    for (const test of suite.allTests()) {
      ++tests;
      if (test.outcome() === 'skipped') ++skipped;
      if (!test.ok()) ++failures;
      for (const result of test.results) duration += result.duration;
      await this._addTestCase(suite.title, testCaseNamePrefix, test, children);
    }
    this.totalTests += tests;
    this.totalSkipped += skipped;
    this.totalFailures += failures;
    const entry = {
      name: 'testsuite',
      attributes: {
        name: suite.title,
        timestamp: this.timestamp.toISOString(),
        hostname: projectName,
        tests,
        failures,
        skipped,
        time: duration / 1000,
        errors: 0
      },
      children
    };
    return entry;
  }
  async _addTestCase(suiteName, namePrefix, test, entries) {
    var _properties$children2;
    const entry = {
      name: 'testcase',
      attributes: {
        // Skip root, project, file
        name: namePrefix + test.titlePath().slice(3).join(' › '),
        // filename
        classname: suiteName,
        time: test.results.reduce((acc, value) => acc + value.duration, 0) / 1000
      },
      children: []
    };
    entries.push(entry);

    // Xray Test Management supports testcase level properties, where additional metadata may be provided
    // some annotations are encoded as value attributes, other as cdata content; this implementation supports
    // Xray JUnit extensions but it also agnostic, so other tools can also take advantage of this format
    const properties = {
      name: 'properties',
      children: []
    };
    for (const annotation of test.annotations) {
      var _properties$children;
      const property = {
        name: 'property',
        attributes: {
          name: annotation.type,
          value: annotation !== null && annotation !== void 0 && annotation.description ? annotation.description : ''
        }
      };
      (_properties$children = properties.children) === null || _properties$children === void 0 || _properties$children.push(property);
    }
    if ((_properties$children2 = properties.children) !== null && _properties$children2 !== void 0 && _properties$children2.length) entry.children.push(properties);
    if (test.outcome() === 'skipped') {
      entry.children.push({
        name: 'skipped'
      });
      return;
    }
    if (!test.ok()) {
      entry.children.push({
        name: 'failure',
        attributes: {
          message: `${_path.default.basename(test.location.file)}:${test.location.line}:${test.location.column} ${test.title}`,
          type: 'FAILURE'
        },
        text: (0, _base.stripAnsiEscapes)((0, _base.formatFailure)(this.config, test).message)
      });
    }
    const systemOut = [];
    const systemErr = [];
    for (const result of test.results) {
      systemOut.push(...result.stdout.map(item => item.toString()));
      systemErr.push(...result.stderr.map(item => item.toString()));
      for (const attachment of result.attachments) {
        if (!attachment.path) continue;
        let attachmentPath = _path.default.relative(this.configDir, attachment.path);
        try {
          if (this.resolvedOutputFile) attachmentPath = _path.default.relative(_path.default.dirname(this.resolvedOutputFile), attachment.path);
        } catch {
          systemOut.push(`\nWarning: Unable to make attachment path ${attachment.path} relative to report output file ${this.resolvedOutputFile}`);
        }
        try {
          await _fs.default.promises.access(attachment.path);
          systemOut.push(`\n[[ATTACHMENT|${attachmentPath}]]\n`);
        } catch {
          systemErr.push(`\nWarning: attachment ${attachmentPath} is missing`);
        }
      }
    }
    // Note: it is important to only produce a single system-out/system-err entry
    // so that parsers in the wild understand it.
    if (systemOut.length) entry.children.push({
      name: 'system-out',
      text: systemOut.join('')
    });
    if (systemErr.length) entry.children.push({
      name: 'system-err',
      text: systemErr.join('')
    });
  }
}
function serializeXML(entry, tokens, stripANSIControlSequences) {
  const attrs = [];
  for (const [name, value] of Object.entries(entry.attributes || {})) attrs.push(`${name}="${escape(String(value), stripANSIControlSequences, false)}"`);
  tokens.push(`<${entry.name}${attrs.length ? ' ' : ''}${attrs.join(' ')}>`);
  for (const child of entry.children || []) serializeXML(child, tokens, stripANSIControlSequences);
  if (entry.text) tokens.push(escape(entry.text, stripANSIControlSequences, true));
  tokens.push(`</${entry.name}>`);
}

// See https://en.wikipedia.org/wiki/Valid_characters_in_XML
const discouragedXMLCharacters = /[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f-\u0084\u0086-\u009f]/g;
function escape(text, stripANSIControlSequences, isCharacterData) {
  if (stripANSIControlSequences) text = (0, _base.stripAnsiEscapes)(text);
  if (isCharacterData) {
    text = '<![CDATA[' + text.replace(/]]>/g, ']]&gt;') + ']]>';
  } else {
    const escapeRe = /[&"'<>]/g;
    text = text.replace(escapeRe, c => ({
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;',
      '<': '&lt;',
      '>': '&gt;'
    })[c]);
  }
  text = text.replace(discouragedXMLCharacters, '');
  return text;
}
var _default = exports.default = JUnitReporter;