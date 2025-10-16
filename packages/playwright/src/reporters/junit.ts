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

import { getAsBooleanFromENV } from 'playwright-core/lib/utils';

import { CommonReporterOptions, formatFailure, nonTerminalScreen, resolveOutputFile } from './base';
import { stripAnsiEscapes } from '../util';

import type { ReporterV2 } from './reporterV2';
import type { JUnitReporterOptions } from '../../types/test';
import type { FullConfig, FullResult, Suite, TestCase } from '../../types/testReporter';

class JUnitReporter implements ReporterV2 {
  private config!: FullConfig;
  private configDir: string;
  private suite!: Suite;
  private timestamp!: Date;
  private totalTests = 0;
  private totalFailures = 0;
  private totalSkipped = 0;
  private resolvedOutputFile: string | undefined;
  private stripANSIControlSequences = false;
  private includeProjectInTestName = false;

  constructor(options: JUnitReporterOptions & CommonReporterOptions) {
    this.stripANSIControlSequences = getAsBooleanFromENV('PLAYWRIGHT_JUNIT_STRIP_ANSI', !!options.stripANSIControlSequences);
    this.includeProjectInTestName = getAsBooleanFromENV('PLAYWRIGHT_JUNIT_INCLUDE_PROJECT_IN_TEST_NAME', !!options.includeProjectInTestName);
    this.configDir = options.configDir;
    this.resolvedOutputFile = resolveOutputFile('JUNIT', options)?.outputFile;
  }

  version(): 'v2' {
    return 'v2';
  }

  printsToStdio() {
    return !this.resolvedOutputFile;
  }

  onConfigure(config: FullConfig) {
    this.config = config;
  }

  onBegin(suite: Suite) {
    this.suite = suite;
    this.timestamp = new Date();
  }

  async onEnd(result: FullResult) {
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
        time: result.duration / 1000
      },
      children
    };

    serializeXML(root, tokens, this.stripANSIControlSequences);
    const reportString = tokens.join('\n');
    if (this.resolvedOutputFile) {
      await fs.promises.mkdir(path.dirname(this.resolvedOutputFile), { recursive: true });
      await fs.promises.writeFile(this.resolvedOutputFile, reportString);
    } else {
      // eslint-disable-next-line no-console
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

    for (const test of suite.allTests()) {
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

  private async _addTestCase(suiteName: string, namePrefix: string, test: TestCase, entries: XMLEntry[],
  ) {
    const children: XMLEntry[] = [];
    const totalDurationSec = Number(
        (test.results.reduce((sum, r) => sum + (r.duration || 0), 0) / 1000).toFixed(3),
    );
    const entry: XMLEntry = {
      name: 'testcase',
      attributes: {
        // Skip root, project, file
        name: namePrefix + test.titlePath().slice(3).join(' › '),
        classname: suiteName,
        time: totalDurationSec,
        file: path.basename(test.location.file),
        line: String(test.location.line),
      },
      children,
    };
    entries.push(entry);

    if (test.annotations.length) {
      // Xray Test Management supports testcase level properties, where additional metadata may be provided
      // some annotations are encoded as value attributes, other as cdata content; this implementation supports
      // Xray JUnit extensions but it also agnostic, so other tools can also take advantage of this format
      const props: XMLEntry = {
        name: 'properties',
        children: test.annotations.map(a => ({
          name: 'property',
          attributes: { name: a.type, value: a.description || '' },
        })),
      };
      children.push(props);
    }

    if (test.outcome() === 'skipped') {
      children.push({ name: 'skipped' });
      return;
    }

    function hasMatcherResult(
      e: unknown,
    ): e is { matcherResult: { matcherName?: string; message?: string } } {
      return !!e && typeof e === 'object' && 'matcherResult' in e;
    }

    // Handle failed test cases
    if (!test.ok()) {
      const last = test.results.at(-1);
      const err = last?.error;
      const expectStep = last?.steps?.find(s => s.category === 'expect' && s.error);
      const hasExpectFailure = !!expectStep;

      const elementName = hasExpectFailure ? 'failure' : 'error';

      // Determine type and message per JUnit semantics
      let typeAttr = 'Error';
      let messageAttr = '';
      const locationInfo = `${path.basename(test.location.file)}:${test.location.line} ${test.title}`;

      if (hasExpectFailure) {
        const expectError = expectStep!.error;
        let matcherName: string | undefined;
        let matcherMessage: string | undefined;

        if (hasMatcherResult(expectError)) {
          matcherName = expectError.matcherResult.matcherName;
          matcherMessage = expectError.matcherResult.message;
        }

        typeAttr = matcherName ? `expect.${matcherName}` : 'AssertionError';
        const baseMsg =
          matcherMessage || expectError?.message || 'Expectation failed';
        messageAttr = `${locationInfo} ${baseMsg}`;
      } else if (err) {
        typeAttr = (err as any).name || 'Error';
        const baseMsg = err.message || 'Error thrown';
        messageAttr = `${locationInfo} ${baseMsg}`;
      }

      children.push({
        name: elementName,
        attributes: { message: messageAttr, type: typeAttr },
        text: stripAnsiEscapes(formatFailure(nonTerminalScreen, this.config, test)),
      });
    }

    const systemOut: string[] = [];
    const systemErr: string[] = [];

    for (const result of test.results) {
      if (result.stdout.length)
        systemOut.push(...result.stdout.map(s => s.toString()));
      if (result.stderr.length)
        systemErr.push(...result.stderr.map(s => s.toString()));

      for (const att of result.attachments) {
        if (!att.path)
          continue;
        let relPath = path.relative(this.configDir, att.path);
        try {
          if (this.resolvedOutputFile) {
            relPath = path.relative(
                path.dirname(this.resolvedOutputFile),
                att.path,
            );
          }
        } catch {
          systemOut.push(`\nWarning: Unable to make attachment path ${att.path} relative to report output file ${this.resolvedOutputFile}`);
        }

        try {
          await fs.promises.access(att.path);
          systemOut.push(`\n[[ATTACHMENT|${relPath}]]\n`);
        } catch {
          systemErr.push(`\nWarning: attachment ${relPath} is missing`);
        }
      }
    }

    // Note: it is important to only produce a single system-out/system-err entry
    // so that parsers in the wild understand it.    if (systemOut.length)
    children.push({ name: 'system-out', text: systemOut.join('') });
    if (systemErr.length)
      children.push({ name: 'system-err', text: systemErr.join('') });
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

export default JUnitReporter;
