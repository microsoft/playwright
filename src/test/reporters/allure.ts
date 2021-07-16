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

import { AllureGroup, AllureRuntime, LabelName, Status } from 'allure-js-commons';
import path from 'path';
import { FullConfig, Suite, Test, TestStatus } from '../reporter';
import { stripAscii } from './base';
import EmptyReporter from './empty';

const startTimeSymbol = Symbol('startTime');

class AllureReporter extends EmptyReporter {
  config!: FullConfig;
  suite!: Suite;

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
  }

  onTestBegin(test: Test) {
    (test.results[test.results.length - 1] as any)[startTimeSymbol] = Date.now();
  }

  onTimeout() {
    this.onEnd();
  }

  async onEnd() {
    const resultsDir = path.join(process.cwd(), 'allure-results');
    const runtime = new AllureRuntime({resultsDir});
    const processSuite = (suite: Suite, parent: AllureGroup | AllureRuntime, groupNamePath: string[]) => {
      const groupName = 'Root';
      if (suite.file) {
        // TODO: use suite's project
        const project = this.config.projects[0];
        const groupName = suite.title || path.relative(project.testDir, suite.file);
        groupNamePath = [...groupNamePath, groupName];
      }
      const group = parent.startGroup(groupName);
      for (const test of suite.tests) {
        for (const result of test.results) {
          const startTime = (result as any)[startTimeSymbol];
          const endTime = startTime + result.duration;

          const allureTest = group.startTest(test.fullTitle(), startTime);
          const [parentSuite, suite, ...subSuites] = groupNamePath;
          if (parentSuite)
            allureTest.addLabel(LabelName.PARENT_SUITE, parentSuite);
          if (suite)
            allureTest.addLabel(LabelName.SUITE, suite);
          if (subSuites.length > 0)
            allureTest.addLabel(LabelName.SUB_SUITE, subSuites.join(' > '));

          allureTest.historyId = test.fullTitle();
          allureTest.fullName = test.fullTitle();
          allureTest.status = statusToAllureStats(result.status!);

          if (result.error) {
            const message = result.error.message && stripAscii(result.error.message);
            let trace = result.error.stack && stripAscii(result.error.stack);
            if (trace && message && trace.startsWith(message))
              trace = trace.substr(message.length);
            allureTest.statusDetails = {
              message,
              trace,
            };
          }

          if (test.projectName)
            allureTest.addParameter('project', test.projectName);

          if (result.data['toMatchSnapshot']) {
            const { expectedPath, actualPath, diffPath, mimeType } = result.data['toMatchSnapshot'];
            allureTest.addLabel('testType',  'screenshotDiff');
            allureTest.addAttachment('expected', mimeType, expectedPath);
            allureTest.addAttachment('actual', mimeType, actualPath);
            allureTest.addAttachment('diff', mimeType, diffPath);
          }

          for (const stdout of result.stdout)
            allureTest.addAttachment('stdout', 'text/plain', runtime.writeAttachment(stdout, 'text/plain'));
          for (const stderr of result.stderr)
            allureTest.addAttachment('stderr', 'text/plain', runtime.writeAttachment(stderr, 'text/plain'));
          allureTest.endTest(endTime);
        }
      }
      for (const child of suite.suites)
        processSuite(child, group, groupNamePath);
      group.endGroup();
    };
    processSuite(this.suite, runtime, []);
  }
}

function statusToAllureStats(status: TestStatus): Status {
  switch (status) {
    case 'failed':
      return Status.FAILED;
    case 'passed':
      return Status.PASSED;
    case 'skipped':
      return Status.SKIPPED;
    case 'timedOut':
      return Status.BROKEN;
  }
}

export default AllureReporter;
