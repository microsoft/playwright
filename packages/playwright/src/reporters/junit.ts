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
import type { FullConfig, FullResult, Suite, TestCase } from '../../types/testReporter';
import { monotonicTime } from 'playwright-core/lib/utils';
import { formatFailure, stripAnsiEscapes } from './base';
import { assert } from 'playwright-core/lib/utils';
import EmptyReporter from './empty';

class JUnitReporter extends EmptyReporter {
  private config!: FullConfig;
  private suite!: Suite;
  private timestamp!: Date;
  private startTime!: number;
  private totalTests = 0;
  private totalFailures = 0;
  private totalSkipped = 0;
  private outputFile: string | undefined;
  private resolvedOutputFile: string | undefined;
  private stripANSIControlSequences = false;
  private includeProjectInTestName = false;

  constructor(options: { outputFile?: string, stripANSIControlSequences?: boolean, includeProjectInTestName?: boolean } = {}) {
    super();
    this.outputFile = options.outputFile || reportOutputNameFromEnv();
    this.stripANSIControlSequences = options.stripANSIControlSequences || false;
    this.includeProjectInTestName = options.includeProjectInTestName || false;
  }

  override printsToStdio() {
    return !this.outputFile;
  }

  override onConfigure(config: FullConfig) {
    this.config = config;
  }

  override onBegin(suite: Suite) {
    this.suite = suite;
    this.timestamp = new Date();
    this.startTime = monotonicTime();
    if (this.outputFile) {
      assert(this.config.configFile || path.isAbsolute(this.outputFile), 'Expected fully resolved path if not using config file.');
      this.resolvedOutputFile = this.config.configFile ? path.resolve(path.dirname(this.config.configFile), this.outputFile) : this.outputFile;
    }
  }

  override async onEnd(result: FullResult) {
    const duration = monotonicTime() - this.startTime;
    const children: XMLEntry[] = [];
    for (const projectSuite of this.suite.suites) {
      for (const fileSuite of projectSuite.suites)
        children.push(await this._buildTestSuite(projectSuite.title, fileSuite));
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

    serializeXML(root, tokens, this.stripANSIControlSequences);
    const reportString = tokens.join('\n');
    if (this.resolvedOutputFile) {
      await fs.promises.mkdir(path.dirname(this.resolvedOutputFile), { recursive: true });
      await fs.promises.writeFile(this.resolvedOutputFile, reportString);
    } else {
      console.log(reportString);
    }
  }

  private async _buildTestSuite(projectName: string, suite: Suite): Promise<XMLEntry> {
    let tests = 0;
    let skipped = 0;
    let failures = 0;
    let duration = 0;
    const children: XMLEntry[] = [];
    const testCaseNamePrefix = projectName && this.includeProjectInTestName ? `[${projectName}] ` : '';

    for (const test of suite.allTests()){
      ++tests;
      if (test.outcome() === 'skipped')
        ++skipped;
      if (!test.ok())
        ++failures;
      for (const result of test.results)
        duration += result.duration;
      await this._addTestCase(suite.title, testCaseNamePrefix, test, children);
    }

    this.totalTests += tests;
    this.totalSkipped += skipped;
    this.totalFailures += failures;

    const entry: XMLEntry = {
      name: 'testsuite',
      attributes: {
        name: suite.title,
        timestamp: this.timestamp.toISOString(),
        hostname: projectName,
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

  private async _addTestCase(suiteName: string, namePrefix: string, test: TestCase, entries: XMLEntry[]) {
    const entry = {
      name: 'testcase',
      attributes: {
        // Skip root, project, file
        name: namePrefix + test.titlePath().slice(3).join(' › '),
        // filename
        classname: suiteName,
        time: (test.results.reduce((acc, value) => acc + value.duration, 0)) / 1000

      },
      children: [] as XMLEntry[]
    };
    entries.push(entry);

    // Xray Test Management supports testcase level properties, where additional metadata may be provided
    // some annotations are encoded as value attributes, other as cdata content; this implementation supports
    // Xray JUnit extensions but it also agnostic, so other tools can also take advantage of this format
    const properties: XMLEntry = {
      name: 'properties',
      children: [] as XMLEntry[]
    };

    for (const annotation of test.annotations) {
      const property: XMLEntry = {
        name: 'property',
        attributes: {
          name: annotation.type,
          value: (annotation?.description ? annotation.description : '')
        }
      };
      properties.children?.push(property);
    }

    if (properties.children?.length)
      entry.children.push(properties);

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

        let attachmentPath = path.relative(this.config.rootDir, attachment.path);
        try {
          if (this.resolvedOutputFile)
            attachmentPath = path.relative(path.dirname(this.resolvedOutputFile), attachment.path);
        } catch {
          systemOut.push(`\nWarning: Unable to make attachment path ${attachment.path} relative to report output file ${this.outputFile}`);
        }

        try {
          await fs.promises.access(attachment.path);
          systemOut.push(`\n[[ATTACHMENT|${attachmentPath}]]\n`);
        } catch {
          systemErr.push(`\nWarning: attachment ${attachmentPath} is missing`);
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

function serializeXML(entry: XMLEntry, tokens: string[], stripANSIControlSequences: boolean) {
  const attrs: string[] = [];
  for (const [name, value] of Object.entries(entry.attributes || {}))
    attrs.push(`${name}="${escape(String(value), stripANSIControlSequences, false)}"`);
  tokens.push(`<${entry.name}${attrs.length ? ' ' : ''}${attrs.join(' ')}>`);
  for (const child of entry.children || [])
    serializeXML(child, tokens, stripANSIControlSequences);
  if (entry.text)
    tokens.push(escape(entry.text, stripANSIControlSequences, true));
  tokens.push(`</${entry.name}>`);
}

// See https://en.wikipedia.org/wiki/Valid_characters_in_XML
const discouragedXMLCharacters = /[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f-\u0084\u0086-\u009f]/g;

function escape(text: string, stripANSIControlSequences: boolean, isCharacterData: boolean): string {
  if (stripANSIControlSequences)
    text = stripAnsiEscapes(text);

  if (isCharacterData) {
    text = '<![CDATA[' + text.replace(/]]>/g, ']]&gt;') + ']]>';
  } else {
    const escapeRe = /[&"'<>]/g;
    text = text.replace(escapeRe, c => ({ '&': '&amp;', '"': '&quot;', "'": '&apos;', '<': '&lt;', '>': '&gt;' }[c]!));
  }

  text = text.replace(discouragedXMLCharacters, '');
  return text;
}

function reportOutputNameFromEnv(): string | undefined {
  if (process.env[`PLAYWRIGHT_JUNIT_OUTPUT_NAME`])
    return path.resolve(process.cwd(), process.env[`PLAYWRIGHT_JUNIT_OUTPUT_NAME`]);
  return undefined;
}

export default JUnitReporter;
