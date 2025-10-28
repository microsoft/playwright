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

import { noColors, escapeRegExp } from 'playwright-core/lib/utils';

import { terminalScreen } from '../../reporters/base';
import ListReporter from '../../reporters/list';
import { StringWriteStream } from './streams';
import { fileExistsAsync } from '../../util';
import { TestRunner, TestRunnerEvent } from '../../runner/testRunner';
import { ensureSeedFile, seedProject } from './seed';

import type { ProgressCallback } from '../sdk/server';
import type { ConfigLocation } from '../../common/config';

export type SeedFile = {
  file: string;
  content: string;
};

export class GeneratorJournal {
  private _rootPath: string;
  private _plan: string;
  private _seed: SeedFile;
  private _steps: { title: string, code: string }[];

  constructor(rootPath: string, plan: string, seed: SeedFile) {
    this._rootPath = rootPath;
    this._plan = plan;
    this._seed = seed;
    this._steps = [];
  }

  logStep(title: string | undefined, code: string) {
    if (title)
      this._steps.push({ title, code });
  }

  journal() {
    const result: string[] = [];
    result.push(`# Plan`);
    result.push(this._plan);
    result.push(`# Seed file: ${path.relative(this._rootPath, this._seed.file)}`);
    result.push('```ts');
    result.push(this._seed.content);
    result.push('```');
    result.push(`# Steps`);
    result.push(this._steps.map(step => `### ${step.title}
\`\`\`ts
${step.code}
\`\`\``).join('\n\n'));
    result.push(bestPracticesMarkdown);
    return result.join('\n\n');
  }
}

export class TestContext {
  private _testRunner: TestRunner | undefined;
  readonly options?: { muteConsole?: boolean, headless?: boolean };
  configLocation!: ConfigLocation;
  rootPath!: string;
  generatorJournal: GeneratorJournal | undefined;

  constructor(options?: { muteConsole?: boolean, headless?: boolean }) {
    this.options = options;
  }

  initialize(rootPath: string | undefined, configLocation: ConfigLocation) {
    this.configLocation = configLocation;
    this.rootPath = rootPath || configLocation.configDir;
  }

  existingTestRunner(): TestRunner | undefined {
    return this._testRunner;
  }

  async createTestRunner(): Promise<TestRunner> {
    if (this._testRunner)
      await this._testRunner.stopTests();
    const testRunner = new TestRunner(this.configLocation!, {});
    await testRunner.initialize({});
    this._testRunner = testRunner;
    testRunner.on(TestRunnerEvent.TestFilesChanged, testFiles => {
      this._testRunner?.emit(TestRunnerEvent.TestFilesChanged, testFiles);
    });
    this._testRunner = testRunner;
    return testRunner;
  }

  async getOrCreateSeedFile(seedFile: string | undefined, projectName: string | undefined) {
    const configDir = this.configLocation.configDir;
    const testRunner = await this.createTestRunner();
    const config = await testRunner.loadConfig();
    const project = seedProject(config, projectName);

    if (!seedFile) {
      seedFile = await ensureSeedFile(project);
    } else {
      const candidateFiles: string[] = [];
      const testDir = project.project.testDir;
      candidateFiles.push(path.resolve(testDir, seedFile));
      candidateFiles.push(path.resolve(configDir, seedFile));
      candidateFiles.push(path.resolve(this.rootPath, seedFile));
      let resolvedSeedFile: string | undefined;
      for (const candidateFile of candidateFiles) {
        if (await fileExistsAsync(candidateFile)) {
          resolvedSeedFile = candidateFile;
          break;
        }
      }
      if (!resolvedSeedFile)
        throw new Error('seed test not found.');
      seedFile = resolvedSeedFile;
    }

    const seedFileContent = await fs.promises.readFile(seedFile, 'utf8');
    return {
      file: seedFile,
      content: seedFileContent,
      projectName: project.project.name,
    };
  }

  async runSeedTest(seedFile: string, projectName: string, progress: ProgressCallback) {
    await this.runWithGlobalSetup(async (testRunner, reporter) => {
      const result = await testRunner.runTests(reporter, {
        headed: !this.options?.headless,
        locations: ['/' + escapeRegExp(seedFile) + '/'],
        projects: [projectName],
        timeout: 0,
        workers: 1,
        pauseAtEnd: true,
        disableConfigReporters: true,
        failOnLoadErrors: true,
      });
      // Ideally, we should check that page was indeed created and browser mcp has kicked in.
      // However, that is handled in the upper layer, so hard to check here.
      if (result.status === 'passed' && !reporter.suite?.allTests().length)
        throw new Error('seed test not found.');

      if (result.status !== 'passed')
        throw new Error('Errors while running the seed test.');
    }, progress);
  }

  async runWithGlobalSetup(
    callback: (testRunner: TestRunner, reporter: ListReporter) => Promise<void>,
    progress: ProgressCallback): Promise<void> {
    const { screen, claimStdio, releaseStdio } = createScreen(progress);
    const configDir = this.configLocation.configDir;
    const testRunner = await this.createTestRunner();

    claimStdio();
    try {
      const setupReporter = new ListReporter({ configDir, screen, includeTestId: true });
      const { status } = await testRunner.runGlobalSetup([setupReporter]);
      if (status !== 'passed')
        throw new Error('Failed to run global setup');
    } finally {
      releaseStdio();
    }

    try {
      const reporter = new ListReporter({ configDir, screen, includeTestId: true });
      return await callback(testRunner, reporter);
    } finally {
      claimStdio();
      await testRunner.runGlobalTeardown().finally(() => {
        releaseStdio();
      });
    }
  }

  async close() {
  }
}

export function createScreen(progress: ProgressCallback) {
  const stdout = new StringWriteStream(progress, 'stdout');
  const stderr = new StringWriteStream(progress, 'stderr');

  const screen = {
    ...terminalScreen,
    isTTY: false,
    colors: noColors,
    stdout: stdout as unknown as NodeJS.WriteStream,
    stderr: stderr as unknown as NodeJS.WriteStream,
  };

  /* eslint-disable no-restricted-properties */
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  const claimStdio = () => {
    process.stdout.write = (chunk: string | Buffer) => {
      stdout.write(chunk);
      return true;
    };
    process.stderr.write = (chunk: string | Buffer) => {
      stderr.write(chunk);
      return true;
    };
  };

  const releaseStdio = () => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  };
  /* eslint-enable no-restricted-properties */

  return { screen, claimStdio, releaseStdio };
}

const bestPracticesMarkdown = `
# Best practices
- Do not improvise, do not add directives that were not asked for
- Use clear, descriptive assertions to validate the expected behavior
- Use reliable locators from this log
- Use local variables for locators that are used multiple times
- Use Playwright waiting assertions and best practices from this log
- NEVER! use page.waitForLoadState()
- NEVER! use page.waitForNavigation()
- NEVER! use page.waitForTimeout()
- NEVER! use page.evaluate()
`;
