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

import { monotonicTime } from 'playwright-core/lib/utils';
import type { FullResult, TestError } from '../../types/testReporter';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import { collectFilesForProject, filterProjects } from './projectUtils';
import { createErrorCollectingReporter, createReporters } from './reporters';
import { TestRun, createTaskRunner, createTaskRunnerForClearCache, createTaskRunnerForDevServer, createTaskRunnerForList, createTaskRunnerForRelatedTestFiles } from './tasks';
import type { FullConfigInternal } from '../common/config';
import { affectedTestFiles } from '../transform/compilationCache';
import { InternalReporter } from '../reporters/internalReporter';
import { LastRunReporter } from './lastRun';

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

    const reporters = await createReporters(config, listOnly ? 'list' : 'test', false);
    const lastRun = new LastRunReporter(config);
    if (config.cliLastFailed)
      await lastRun.filterLastFailed();

    const reporter = new InternalReporter([...reporters, lastRun]);
    const taskRunner = listOnly ? createTaskRunnerForList(
        config,
        reporter,
        'in-process',
        { failOnLoadErrors: true }) : createTaskRunner(config, reporter);

    const testRun = new TestRun(config);
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

  async findRelatedTestFiles(files: string[]): Promise<FindRelatedTestFilesReport>  {
    const errorReporter = createErrorCollectingReporter();
    const reporter = new InternalReporter([errorReporter]);
    const taskRunner = createTaskRunnerForRelatedTestFiles(this._config, reporter, 'in-process', true);
    const testRun = new TestRun(this._config);
    reporter.onConfigure(this._config.config);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onEnd({ status });
    await reporter.onExit();
    if (status !== 'passed')
      return { errors: errorReporter.errors(), testFiles: [] };
    return { testFiles: affectedTestFiles(files) };
  }

  async runDevServer() {
    const reporter = new InternalReporter([createErrorCollectingReporter(true)]);
    const taskRunner = createTaskRunnerForDevServer(this._config, reporter, 'in-process', true);
    const testRun = new TestRun(this._config);
    reporter.onConfigure(this._config.config);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onEnd({ status });
    await reporter.onExit();
    return { status };
  }

  async clearCache() {
    const reporter = new InternalReporter([createErrorCollectingReporter(true)]);
    const taskRunner = createTaskRunnerForClearCache(this._config, reporter, 'in-process', true);
    const testRun = new TestRun(this._config);
    reporter.onConfigure(this._config.config);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onEnd({ status });
    await reporter.onExit();
    return { status };
  }
}
