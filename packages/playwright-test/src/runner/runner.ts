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
import type { FullResult } from '../../types/testReporter';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import { collectFilesForProject, filterProjects } from './projectUtils';
import { createReporters } from './reporters';
import { TestRun, createTaskRunner, createTaskRunnerForList } from './tasks';
import type { FullConfigInternal } from '../common/config';
import { colors } from 'playwright-core/lib/utilsBundle';
import { runWatchModeLoop } from './watchMode';
import { runUIMode } from './uiMode';
import { InternalReporter } from '../reporters/internalReporter';

type ProjectConfigWithFiles = {
  name: string;
  testDir: string;
  outputDir: string;
  use: { testIdAttribute?: string };
  files: string[];
};

type ConfigListFilesReport = {
  projects: ProjectConfigWithFiles[];
};

export class Runner {
  private _config: FullConfigInternal;

  constructor(config: FullConfigInternal) {
    this._config = config;
  }

  async listTestFiles(projectNames: string[] | undefined): Promise<any> {
    const projects = filterProjects(this._config.projects, projectNames);
    const report: ConfigListFilesReport = {
      projects: []
    };
    for (const project of projects) {
      report.projects.push({
        name: project.project.name,
        testDir: project.project.testDir,
        outputDir: project.project.outputDir,
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

    const reporter = new InternalReporter(await createReporters(config, listOnly ? 'list' : 'run'));
    const taskRunner = listOnly ? createTaskRunnerForList(config, reporter, 'in-process', { failOnLoadErrors: true })
      : createTaskRunner(config, reporter);

    const testRun = new TestRun(config, reporter);
    reporter.onConfigure(config);

    if (!listOnly && config.ignoreSnapshots) {
      reporter.onStdOut(colors.dim([
        'NOTE: running with "ignoreSnapshots" option. All of the following asserts are silently ignored:',
        '- expect().toMatchSnapshot()',
        '- expect().toHaveScreenshot()',
        '',
      ].join('\n')));
    }

    const taskStatus = await taskRunner.run(testRun, deadline);
    let status: FullResult['status'] = 'passed';
    if (testRun.phases.find(p => p.dispatcher.hasWorkerErrors()) || testRun.rootSuite?.allTests().some(test => !test.ok()))
      status = 'failed';
    if (status === 'passed' && taskStatus !== 'passed')
      status = taskStatus;
    await reporter.onExit({ status });

    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    // See https://github.com/nodejs/node/issues/12921
    await new Promise<void>(resolve => process.stdout.write('', () => resolve()));
    await new Promise<void>(resolve => process.stderr.write('', () => resolve()));
    return status;
  }

  async watchAllTests(): Promise<FullResult['status']> {
    const config = this._config;
    webServerPluginsForConfig(config).forEach(p => config.plugins.push({ factory: p }));
    return await runWatchModeLoop(config);
  }

  async uiAllTests(): Promise<FullResult['status']> {
    const config = this._config;
    webServerPluginsForConfig(config).forEach(p => config.plugins.push({ factory: p }));
    return await runUIMode(config);
  }
}
