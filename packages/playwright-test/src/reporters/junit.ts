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

import fs from 'fs';
import path from 'path';
import { FullConfig, FullResult, Reporter, Suite, TestCase } from '../../types/testReporter';
import { monotonicTime } from '../util';
import { formatFailure, formatTestTitle, stripAnsiEscapes } from './base';

class JUnitReporter implements Reporter {
  private config!: FullConfig;
  private suite!: Suite;
  private timestamp!: number;
  private startTime!: number;
  private totalTests = 0;
  private totalFailures = 0;
  private totalSkipped = 0;
  private outputFile: string | undefined;
  private stripANSIControlSequences = false;
  private useCDATAsections = false;

  constructor(options: { outputFile?: string, stripANSIControlSequences?: boolean, useCDATAsections?: boolean } = {}) {
    this.outputFile = options.outputFile || process.env[`PLAYWRIGHT_JUNIT_OUTPUT_NAME`];
    this.stripANSIControlSequences = options.stripANSIControlSequences || false;
    this.useCDATAsections = options.useCDATAsections || false;
  }

  printsToStdio() {
    return !this.outputFile;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
    this.timestamp = Date.now();
    this.startTime = monotonicTime();
  }

  async onEnd(result: FullResult) {
    const duration = monotonicTime() - this.startTime;
    const children: XMLEntry[] = [];
    for (const projectSuite of this.suite.suites) {
      for (const fileSuite of projectSuite.suites)
        children.push(this._buildTestSuite(fileSuite));
    }
    const tokens: string[] = [];

    const self = this;
    const root: XMLEntry = {
      name: 'testsuites',
      attributes: {
        id: process.env[`PLAYWRIGHT_JUNIT_SUITE_ID`] || '',
        name: process.env[`PLAYWRIGHT_JUNIT_SUITE_NAME`] || '',
        tests: self.totalTests,
        failures: self.totalFailures,
        skipped: self.totalSkipped,
        errors: 0,
        time: duration / 1000
      },
      children
    };

    serializeXML(root, tokens, this.stripANSIControlSequences, this.useCDATAsections);
    const reportString = tokens.join('\n');
    if (this.outputFile) {
      fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
      fs.writeFileSync(this.outputFile, reportString);
    } else {
      console.log(reportString);
    }
  }

  private _buildTestSuite(suite: Suite): XMLEntry {
    let tests = 0;
    let skipped = 0;
    let failures = 0;
    let duration = 0;
    const children: XMLEntry[] = [];

    suite.allTests().forEach(test => {
      ++tests;
      if (test.outcome() === 'skipped')
        ++skipped;
      if (!test.ok())
        ++failures;
      for (const result of test.results)
        duration += result.duration;
      this._addTestCase(test, children);
    });
    this.totalTests += tests;
    this.totalSkipped += skipped;
    this.totalFailures += failures;

    const entry: XMLEntry = {
      name: 'testsuite',
      attributes: {
        name: suite.location ? path.relative(this.config.rootDir, suite.location.file) : '',
        timestamp: this.timestamp,
        hostname: '',
        tests,
        failures,
        skipped,
        time: duration / 1000,
        errors: 0,
      },
      children
    };

    return entry;
  }

  private _addTestCase(test: TestCase, entries: XMLEntry[]) {
    const entry = {
      name: 'testcase',
      attributes: {
        // Skip root, project, file
        name: test.titlePath().slice(3).join(' '),
        classname: formatTestTitle(this.config, test),
        time: (test.results.reduce((acc, value) => acc + value.duration, 0)) / 1000
      },
      children: [] as XMLEntry[]
    };
    entries.push(entry);

    if (test.outcome() === 'skipped') {
      entry.children.push({ name: 'skipped' });
      return;
    }

    if (!test.ok()) {
      entry.children.push({
        name: 'failure',
        attributes: {
          message: `${path.basename(test.location.file)}:${test.location.line}:${test.location.column} ${test.title}`,
          type: 'FAILURE',
        },
        text: stripAnsiEscapes(formatFailure(this.config, test).message)
      });
    }

    const systemOut: string[] = [];
    const systemErr: string[] = [];
    for (const result of test.results) {
      systemOut.push(...result.stdout.map(item => item.toString()));
      systemErr.push(...result.stderr.map(item => item.toString()));
      for (const attachment of result.attachments) {
        if (!attachment.path)
          continue;
        try {
          const attachmentPath = path.relative(this.config.rootDir, attachment.path);
          if (fs.existsSync(attachment.path))
            systemOut.push(`\n[[ATTACHMENT|${attachmentPath}]]\n`);
          else
            systemErr.push(`\nWarning: attachment ${attachmentPath} is missing`);
        } catch (e) {
        }
      }
    }
    // Note: it is important to only produce a single system-out/system-err entry
    // so that parsers in the wild understand it.
    if (systemOut.length)
      entry.children.push({ name: 'system-out', text: systemOut.join('') });
    if (systemErr.length)
      entry.children.push({ name: 'system-err', text: systemErr.join('') });
  }
}

type XMLEntry = {
  name: string;
  attributes?: { [name: string]: string | number | boolean };
  children?: XMLEntry[];
  text?: string;
};

function serializeXML(entry: XMLEntry, tokens: string[], stripANSIControlSequences: boolean, useCDATAsections: boolean) {
  const attrs: string[] = [];
  for (const [name, value] of Object.entries(entry.attributes || {}))
    attrs.push(`${name}="${escape(String(value), stripANSIControlSequences, false, false)}"`);
  tokens.push(`<${entry.name}${attrs.length ? ' ' : ''}${attrs.join(' ')}>`);
  for (const child of entry.children || [])
    serializeXML(child, tokens, stripANSIControlSequences, useCDATAsections);
  if (entry.text)
    tokens.push(escape(entry.text, stripANSIControlSequences, true, useCDATAsections));
  tokens.push(`</${entry.name}>`);
}

// See https://en.wikipedia.org/wiki/Valid_characters_in_XML
const discouragedXMLCharacters = /[\u0001-\u0008\u000b-\u000c\u000e-\u001f\u007f-\u0084\u0086-\u009f]/g;
const ansiControlSequence = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');

function escape(text: string, stripANSIControlSequences: boolean, isCharacterData: boolean, useCDATAsections: boolean): string {
  if (stripANSIControlSequences)
    text = text.replace(ansiControlSequence, '');
  if (isCharacterData) {
    if (useCDATAsections)
      text = '<![CDATA[' + text.replace(/]]>/g, ']]&gt;') + ']]>';
    else
      text = text.replace(/]]>/g, ']]&gt;');
  } else {
    const escapeRe = /[&"'<>]/g;
    text = text.replace(escapeRe, c => ({ '&': '&amp;', '"': '&quot;', "'": '&apos;', '<': '&lt;', '>': '&gt;' }[c]!));
  }

  text = text.replace(discouragedXMLCharacters, '');
  return text;
}

export default JUnitReporter;
