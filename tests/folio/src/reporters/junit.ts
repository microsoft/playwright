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
import { FullConfig } from '../types';
import EmptyReporter from './empty';
import { Suite, Test } from '../test';
import { monotonicTime } from '../util';
import { formatFailure, stripAscii } from './base';

class JUnitReporter extends EmptyReporter {
  private config: FullConfig;
  private suite: Suite;
  private timestamp: number;
  private startTime: number;
  private totalTests = 0;
  private totalFailures = 0;
  private totalSkipped = 0;

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
    this.timestamp = Date.now();
    this.startTime = monotonicTime();
  }

  onEnd() {
    const duration = monotonicTime() - this.startTime;
    const children: XMLEntry[] = [];
    for (const suite of this.suite.suites)
      children.push(this._buildTestSuite(suite));
    const tokens: string[] = [];

    const self = this;
    const root: XMLEntry = {
      name: 'testsuites',
      attributes: {
        id: process.env[`FOLIO_JUNIT_SUITE_ID`] || '',
        name: process.env[`FOLIO_JUNIT_SUITE_NAME`] || '',
        tests: self.totalTests,
        failures: self.totalFailures,
        skipped: self.totalSkipped,
        errors: 0,
        time: duration / 1000
      },
      children
    };

    serializeXML(root, tokens);
    const reportString = tokens.join('\n');
    const outputName = process.env[`FOLIO_JUNIT_OUTPUT_NAME`];
    if (outputName) {
      fs.mkdirSync(path.dirname(outputName), { recursive: true });
      fs.writeFileSync(outputName, reportString);
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

    suite.findTest(test => {
      ++tests;
      if (test.skipped)
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
        name: path.relative(this.config.testDir, suite.file),
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

  private _addTestCase(test: Test, entries: XMLEntry[]) {
    const entry = {
      name: 'testcase',
      attributes: {
        name: test.spec.fullTitle(),
        classname: path.relative(this.config.testDir, test.spec.file) + ' ' + test.spec.parent.fullTitle(),
        time: (test.results.reduce((acc, value) => acc + value.duration, 0)) / 1000
      },
      children: []
    };
    entries.push(entry);

    if (test.skipped) {
      entry.children.push({ name: 'skipped'});
      return;
    }

    if (!test.ok()) {
      entry.children.push({
        name: 'failure',
        attributes: {
          message: `${path.basename(test.spec.file)}:${test.spec.line}:${test.spec.column} ${test.spec.title}`,
          type: 'FAILURE',
        },
        text: stripAscii(formatFailure(this.config, test))
      });
    }
    for (const result of test.results) {
      for (const stdout of result.stdout) {
        entries.push({
          name: 'system-out',
          text: stdout.toString()
        });
      }

      for (const stderr of result.stderr) {
        entries.push({
          name: 'system-err',
          text: stderr.toString()
        });
      }
    }
  }
}

type XMLEntry = {
  name: string;
  attributes?: { [name: string]: string | number | boolean };
  children?: XMLEntry[];
  text?: string;
};

function serializeXML(entry: XMLEntry, tokens: string[]) {
  const attrs: string[] = [];
  for (const name of Object.keys(entry.attributes || {}))
    attrs.push(`${name}="${escape(String(entry.attributes[name]))}"`);
  tokens.push(`<${entry.name}${attrs.length ? ' ' : ''}${attrs.join(' ')}>`);
  for (const child of entry.children || [])
    serializeXML(child, tokens);
  if (entry.text)
    tokens.push(escape(entry.text));
  tokens.push(`</${entry.name}>`);
}

function escape(text: string): string {
  text = text.replace(/"/g, '&quot;');
  text = text.replace(/&/g, '&amp;');
  text = text.replace(/</g, '&lt;');
  text = text.replace(/>/g, '&gt;');
  return text;
}

export default JUnitReporter;
