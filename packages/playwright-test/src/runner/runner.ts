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
import { createReporter } from './reporters';
import { createTaskRunner, createTaskRunnerForList } from './tasks';
import type { TaskRunnerState } from './tasks';
import type { FullConfigInternal } from '../common/types';
import { colors } from 'playwright-core/lib/utilsBundle';
import { runWatchModeLoop } from './watchMode';

export class Runner {
  private _config: FullConfigInternal;

  constructor(config: FullConfigInternal) {
    this._config = config;
  }

  async listTestFiles(projectNames: string[] | undefined): Promise<any> {
    const projects = filterProjects(this._config.projects, projectNames);
    const report: any = {
      projects: []
    };
    for (const project of projects) {
      report.projects.push({
        ...sanitizeConfigForJSON(project, new Set()),
        files: await collectFilesForProject(project)
      });
    }
    return report;
  }

  async runAllTests(): Promise<FullResult['status']> {
    const config = this._config;
    const listOnly = config._internal.listOnly;
    const deadline = config.globalTimeout ? monotonicTime() + config.globalTimeout : 0;

    // Legacy webServer support.
    webServerPluginsForConfig(config).forEach(p => config._internal.plugins.push({ factory: p }));

    const reporter = await createReporter(config, listOnly ? 'list' : 'run');
    const taskRunner = listOnly ? createTaskRunnerForList(config, reporter)
      : createTaskRunner(config, reporter);

    const context: TaskRunnerState = {
      config,
      reporter,
      phases: [],
    };

    reporter.onConfigure(config);

    if (!listOnly && config._internal.ignoreSnapshots) {
      reporter.onStdOut(colors.dim([
        'NOTE: running with "ignoreSnapshots" option. All of the following asserts are silently ignored:',
        '- expect().toMatchSnapshot()',
        '- expect().toHaveScreenshot()',
        '',
      ].join('\n')));
    }

    const taskStatus = await taskRunner.run(context, deadline);
    let status: FullResult['status'] = 'passed';
    if (context.phases.find(p => p.dispatcher.hasWorkerErrors()) || context.rootSuite?.allTests().some(test => !test.ok()))
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
    webServerPluginsForConfig(config).forEach(p => config._internal.plugins.push({ factory: p }));
    return await runWatchModeLoop(config);
  }
}

function sanitizeConfigForJSON(object: any, visited: Set<any>): any {
  const type = typeof object;
  if (type === 'function' || type === 'symbol')
    return undefined;
  if (!object || type !== 'object')
    return object;

  if (object instanceof RegExp)
    return String(object);
  if (object instanceof Date)
    return object.toISOString();

  if (visited.has(object))
    return undefined;
  visited.add(object);

  if (Array.isArray(object))
    return object.map(a => sanitizeConfigForJSON(a, visited));

  const result: any = {};
  const keys = Object.keys(object).slice(0, 100);
  for (const key of keys) {
    if (key.startsWith('_'))
      continue;
    result[key] = sanitizeConfigForJSON(object[key], visited);
  }
  return result;
}
