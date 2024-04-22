/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import path from 'path';
import { monotonicTime } from 'playwright-core/lib/utils';
import type { FullResult, TestError } from '../../types/testReporter';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import { collectFilesForProject, filterProjects } from './projectUtils';
import { createReporters } from './reporters';
import { TestRun, createTaskRunner, createTaskRunnerForList } from './tasks';
import type { FullConfigInternal } from '../common/config';
import { runWatchModeLoop } from './watchMode';
import { InternalReporter } from '../reporters/internalReporter';
import { Multiplexer } from '../reporters/multiplexer';
import type { Suite } from '../common/test';
import { wrapReporterAsV2 } from '../reporters/reporterV2';
import { affectedTestFiles } from '../transform/compilationCache';

type ProjectConfigWithFiles = {
  name: string;
  testDir: string;
  use: { testIdAttribute?: string };
  files: string[];
};

type ConfigListFilesReport = {
  projects: ProjectConfigWithFiles[];
  error?: TestError;
};

export type FindRelatedTestFilesReport = {
  testFiles: string[];
  errors?: TestError[];
};

export class Runner {
  private _config: FullConfigInternal;

  constructor(config: FullConfigInternal) {
    this._config = config;
  }

  async listTestFiles(projectNames?: string[]): Promise<ConfigListFilesReport> {
    const projects = filterProjects(this._config.projects, projectNames);
    const report: ConfigListFilesReport = {
      projects: [],
    };
    for (const project of projects) {
      report.projects.push({
        name: project.project.name,
        testDir: project.project.testDir,
        use: { testIdAttribute: project.project.use.testIdAttribute },
        files: await collectFilesForProject(project)
      });
    }
    return report;
  }

  async runAllTests(): Promise<FullResult['status']> {
    const config = this._config;
    const listOnly = config.cliListOnly;
    const deadline = config.config.globalTimeout ? monotonicTime() + config.config.globalTimeout : 0;

    // Legacy webServer support.
    webServerPluginsForConfig(config).forEach(p => config.plugins.push({ factory: p }));

    const reporter = new InternalReporter(new Multiplexer(await createReporters(config, listOnly ? 'list' : 'test', false)));
    const taskRunner = listOnly ? createTaskRunnerForList(config, reporter, 'in-process', { failOnLoadErrors: true })
      : createTaskRunner(config, reporter);

    const testRun = new TestRun(config, reporter);
    reporter.onConfigure(config.config);

    const taskStatus = await taskRunner.run(testRun, deadline);
    let status: FullResult['status'] = testRun.failureTracker.result();
    if (status === 'passed' && taskStatus !== 'passed')
      status = taskStatus;
    const modifiedResult = await reporter.onEnd({ status });
    if (modifiedResult && modifiedResult.status)
      status = modifiedResult.status;

    await reporter.onExit();

    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    // See https://github.com/nodejs/node/issues/12921
    await new Promise<void>(resolve => process.stdout.write('', () => resolve()));
    await new Promise<void>(resolve => process.stderr.write('', () => resolve()));
    return status;
  }

  async loadAllTests(mode: 'in-process' | 'out-of-process' = 'in-process'): Promise<{ status: FullResult['status'], suite?: Suite, errors: TestError[] }> {
    const config = this._config;
    const errors: TestError[] = [];
    const reporter = new InternalReporter(new Multiplexer([wrapReporterAsV2({
      onError(error: TestError) {
        errors.push(error);
      }
    })]));
    const taskRunner = createTaskRunnerForList(config, reporter, mode, { failOnLoadErrors: true });
    const testRun = new TestRun(config, reporter);
    reporter.onConfigure(config.config);

    const taskStatus = await taskRunner.run(testRun, 0);
    let status: FullResult['status'] = testRun.failureTracker.result();
    if (status === 'passed' && taskStatus !== 'passed')
      status = taskStatus;
    const modifiedResult = await reporter.onEnd({ status });
    if (modifiedResult && modifiedResult.status)
      status = modifiedResult.status;
    await reporter.onExit();
    return { status, suite: testRun.rootSuite, errors };
  }

  async watchAllTests(): Promise<FullResult['status']> {
    const config = this._config;
    webServerPluginsForConfig(config).forEach(p => config.plugins.push({ factory: p }));
    return await runWatchModeLoop(config);
  }

  async findRelatedTestFiles(mode: 'in-process' | 'out-of-process', files: string[]): Promise<FindRelatedTestFilesReport>  {
    const result = await this.loadAllTests(mode);
    if (result.status !== 'passed' || !result.suite)
      return { errors: result.errors, testFiles: [] };

    const resolvedFiles = (files as string[]).map(file => path.resolve(process.cwd(), file));
    const override = (this._config.config as any)['@playwright/test']?.['cli']?.['find-related-test-files'];
    if (override)
      return await override(resolvedFiles, this._config, result.suite);
    return { testFiles: affectedTestFiles(resolvedFiles) };
  }
}
