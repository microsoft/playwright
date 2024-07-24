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

import fs from 'fs';
import path from 'path';
import { monotonicTime } from 'playwright-core/lib/utils';
import type { FullResult, TestError } from '../../types/testReporter';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import { collectFilesForProject, filterProjects } from './projectUtils';
import { createReporters } from './reporters';
import { TestRun, createTaskRunner, createTaskRunnerForList } from './tasks';
import type { FullConfigInternal } from '../common/config';
import { runWatchModeLoop } from './watchMode';
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

    const reporters = await createReporters(config, listOnly ? 'list' : 'test', false);
    const taskRunner = listOnly ? createTaskRunnerForList(
        config,
        reporters,
        'in-process',
        { failOnLoadErrors: true }) : createTaskRunner(config, reporters);

    const testRun = new TestRun(config);
    taskRunner.reporter.onConfigure(config.config);

    const taskStatus = await taskRunner.run(testRun, deadline);
    let status: FullResult['status'] = testRun.failureTracker.result();
    if (status === 'passed' && taskStatus !== 'passed')
      status = taskStatus;
    const modifiedResult = await taskRunner.reporter.onEnd({ status });
    if (modifiedResult && modifiedResult.status)
      status = modifiedResult.status;

    if (!listOnly)
      await writeLastRunInfo(testRun, status);

    await taskRunner.reporter.onExit();

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
    const reporters = [wrapReporterAsV2({
      onError(error: TestError) {
        errors.push(error);
      }
    })];
    const taskRunner = createTaskRunnerForList(config, reporters, mode, { failOnLoadErrors: true });
    const testRun = new TestRun(config);
    taskRunner.reporter.onConfigure(config.config);

    const taskStatus = await taskRunner.run(testRun, 0);
    let status: FullResult['status'] = testRun.failureTracker.result();
    if (status === 'passed' && taskStatus !== 'passed')
      status = taskStatus;
    const modifiedResult = await taskRunner.reporter.onEnd({ status });
    if (modifiedResult && modifiedResult.status)
      status = modifiedResult.status;
    await taskRunner.reporter.onExit();
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
      return await override(resolvedFiles, this._config);
    return { testFiles: affectedTestFiles(resolvedFiles) };
  }
}

export type LastRunInfo = {
  status: FullResult['status'];
  failedTests: string[];
};

async function writeLastRunInfo(testRun: TestRun, status: FullResult['status']) {
  const [project] = filterProjects(testRun.config.projects, testRun.config.cliProjectFilter);
  if (!project)
    return;
  const outputDir = project.project.outputDir;
  await fs.promises.mkdir(outputDir, { recursive: true });
  const lastRunReportFile = path.join(outputDir, '.last-run.json');
  const failedTests = testRun.rootSuite?.allTests().filter(t => !t.ok()).map(t => t.id);
  const lastRunReport = JSON.stringify({ status, failedTests }, undefined, 2);
  await fs.promises.writeFile(lastRunReportFile, lastRunReport);
}

export async function readLastRunInfo(config: FullConfigInternal): Promise<LastRunInfo> {
  const [project] = filterProjects(config.projects, config.cliProjectFilter);
  if (!project)
    return { status: 'passed', failedTests: [] };
  const outputDir = project.project.outputDir;
  try {
    const lastRunReportFile = path.join(outputDir, '.last-run.json');
    return JSON.parse(await fs.promises.readFile(lastRunReportFile, 'utf8')) as LastRunInfo;
  } catch {
  }
  return { status: 'passed', failedTests: [] };
}
