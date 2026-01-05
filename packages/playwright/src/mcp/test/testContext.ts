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
import os from 'os';
import path from 'path';

import { noColors, escapeRegExp, ManualPromise, toPosixPath } from 'playwright-core/lib/utils';

import { terminalScreen } from '../../reporters/base';
import ListReporter from '../../reporters/list';
import { StringWriteStream } from './streams';
import { fileExistsAsync } from '../../util';
import { TestRunner, TestRunnerEvent } from '../../runner/testRunner';
import { ensureSeedFile, seedProject } from './seed';
import { firstRootPath } from '../sdk/exports';
import { resolveConfigLocation } from '../../common/configLoader';
import { parseResponse } from '../browser/response';
import { logUnhandledError } from '../log';

import type { TerminalScreen } from '../../reporters/base';
import type { FullResultStatus, RunTestsParams } from '../../runner/testRunner';
import type { ConfigLocation } from '../../common/config';
import type { ClientInfo } from '../sdk/exports';
import type { BrowserMCPRequest, BrowserMCPResponse } from './browserBackend';

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
    result.push(`# Seed file: ${toPosixPath(path.relative(this._rootPath, this._seed.file))}`);
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

type TestRunnerAndScreen = {
  testRunner: TestRunner;
  screen: TerminalScreen;
  claimStdio: () => void;
  releaseStdio: () => void;
  output: string[];
  waitForTestPaused: () => Promise<void>;
  sendMessageToPausedTest?: (params: { request: BrowserMCPRequest }) => Promise<{ response: BrowserMCPResponse, error?: any }>;
};

export class TestContext {
  private _clientInfo: ClientInfo;
  private _testRunnerAndScreen: TestRunnerAndScreen | undefined;
  readonly computedHeaded: boolean;
  private readonly _configLocation: ConfigLocation;
  readonly rootPath: string;
  generatorJournal: GeneratorJournal | undefined;

  constructor(clientInfo: ClientInfo, configPath: string | undefined, options?: { muteConsole?: boolean, headless?: boolean }) {
    this._clientInfo = clientInfo;

    const rootPath = firstRootPath(clientInfo);
    this._configLocation = resolveConfigLocation(configPath || rootPath);
    this.rootPath = rootPath || this._configLocation.configDir;

    if (options?.headless !== undefined)
      this.computedHeaded = !options.headless;
    else
      this.computedHeaded = !process.env.CI && !(os.platform() === 'linux' && !process.env.DISPLAY);
  }

  existingTestRunner(): TestRunner | undefined {
    return this._testRunnerAndScreen?.testRunner;
  }

  private async _cleanupTestRunner() {
    if (!this._testRunnerAndScreen)
      return;
    await this._testRunnerAndScreen.testRunner.stopTests();
    this._testRunnerAndScreen.claimStdio();
    try {
      await this._testRunnerAndScreen.testRunner.runGlobalTeardown();
    } finally {
      this._testRunnerAndScreen.releaseStdio();
      this._testRunnerAndScreen = undefined;
    }
  }

  async createTestRunner() {
    await this._cleanupTestRunner();

    const testRunner = new TestRunner(this._configLocation, {});
    await testRunner.initialize({});
    const testPaused = new ManualPromise<void>();
    const testRunnerAndScreen: TestRunnerAndScreen = {
      ...createScreen(),
      testRunner,
      waitForTestPaused: () => testPaused,
    };
    this._testRunnerAndScreen = testRunnerAndScreen;

    testRunner.on(TestRunnerEvent.TestPaused, params => {
      testRunnerAndScreen.sendMessageToPausedTest = params.sendMessage;
      testPaused.resolve();
    });
    return testRunnerAndScreen;
  }

  async getOrCreateSeedFile(seedFile: string | undefined, projectName: string | undefined) {
    const configDir = this._configLocation.configDir;
    const { testRunner } = await this.createTestRunner();
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

  async runSeedTest(seedFile: string, projectName: string): Promise<{ output: string, status: FullResultStatus | 'paused' }> {
    const result = await this.runTestsWithGlobalSetupAndPossiblePause({
      headed: this.computedHeaded,
      locations: ['/' + escapeRegExp(seedFile) + '/'],
      projects: [projectName],
      timeout: 0,
      workers: 1,
      pauseAtEnd: true,
      disableConfigReporters: true,
      failOnLoadErrors: true,
    });
    if (result.status === 'passed')
      result.output += '\nError: seed test not found.';
    else if (result.status !== 'paused')
      result.output += '\nError while running the seed test.';
    return result;
  }

  async runTestsWithGlobalSetupAndPossiblePause(params: RunTestsParams): Promise<{ output: string, status: FullResultStatus | 'paused' }> {
    const configDir = this._configLocation.configDir;
    const testRunnerAndScreen = await this.createTestRunner();
    const { testRunner, screen, claimStdio, releaseStdio } = testRunnerAndScreen;

    claimStdio();
    try {
      const setupReporter = new MCPListReporter({ configDir, screen, includeTestId: true });
      const { status } = await testRunner.runGlobalSetup([setupReporter]);
      if (status !== 'passed')
        return { output: testRunnerAndScreen.output.join('\n'), status };
    } finally {
      releaseStdio();
    }

    let status: FullResultStatus | 'paused' = 'passed';

    const cleanup = async () => {
      claimStdio();
      try {
        const result = await testRunner.runGlobalTeardown();
        if (status === 'passed')
          status = result.status;
      } finally {
        releaseStdio();
      }
    };

    try {
      const reporter = new MCPListReporter({ configDir, screen, includeTestId: true });
      status = await Promise.race([
        testRunner.runTests(reporter, params).then(result => result.status),
        testRunnerAndScreen.waitForTestPaused().then(() => 'paused' as const),
      ]);

      if (status === 'paused') {
        const response = await testRunnerAndScreen.sendMessageToPausedTest!({ request: { initialize: { clientInfo: this._clientInfo } } });
        if (response.error)
          throw new Error(response.error.message);
        testRunnerAndScreen.output.push(response.response.initialize!.pausedMessage);
        return { output: testRunnerAndScreen.output.join('\n'), status };
      }
    } catch (e) {
      status = 'failed';
      testRunnerAndScreen.output.push(String(e));
      await cleanup();
      return { output: testRunnerAndScreen.output.join('\n'), status };
    }

    await cleanup();
    return { output: testRunnerAndScreen.output.join('\n'), status };
  }

  async close() {
    await this._cleanupTestRunner().catch(logUnhandledError);
  }

  async sendMessageToPausedTest(request: BrowserMCPRequest): Promise<BrowserMCPResponse> {
    const sendMessage = this._testRunnerAndScreen?.sendMessageToPausedTest;
    if (!sendMessage)
      throw new Error('Must setup test before interacting with the page');
    const result = await sendMessage({ request });
    if (result.error)
      throw new Error(result.error.message);
    if (typeof request?.callTool?.arguments?.['intent'] === 'string') {
      const response = parseResponse(result.response.callTool!);
      if (response && !response.isError && response.code)
        this.generatorJournal?.logStep(request.callTool.arguments['intent'], response.code);
    }
    return result.response;
  }
}

export function createScreen() {
  const output: string[] = [];
  const stdout = new StringWriteStream(output, 'stdout');
  const stderr = new StringWriteStream(output, 'stderr');

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

  return { screen, claimStdio, releaseStdio, output };
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

class MCPListReporter extends ListReporter {
  async onTestPaused() {
    // ListReporter waits for user input to resume, we don't want that in MCP.
    await new Promise<void>(() => {});
  }
}
