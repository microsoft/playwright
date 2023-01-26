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
import type { FullResult } from '../types/testReporter';
import { ConfigLoader } from './configLoader';
import type { TestRunnerPlugin } from './plugins';
import { setRunnerToAddPluginsTo } from './plugins';
import { dockerPlugin } from './plugins/dockerPlugin';
import { webServerPluginsForConfig } from './plugins/webServerPlugin';
import { collectFilesForProjects, collectProjects } from './runner/projectUtils';
import { createReporter } from './runner/reporters';
import { createTaskRunner } from './runner/tasks';
import type { TaskRunnerState } from './runner/tasks';
import type { Config, FullConfigInternal } from './types';
import type { Matcher, TestFileFilter } from './util';

export type ConfigCLIOverrides = {
  forbidOnly?: boolean;
  fullyParallel?: boolean;
  globalTimeout?: number;
  maxFailures?: number;
  outputDir?: string;
  quiet?: boolean;
  repeatEach?: number;
  retries?: number;
  reporter?: string;
  shard?: { current: number, total: number };
  timeout?: number;
  ignoreSnapshots?: boolean;
  updateSnapshots?: 'all'|'none'|'missing';
  workers?: number;
  projects?: { name: string, use?: any }[],
  use?: any;
};

export type RunOptions = {
  listOnly: boolean;
  testFileFilters: TestFileFilter[];
  testTitleMatcher: Matcher;
  projectFilter?: string[];
  passWithNoTests?: boolean;
};

export class Runner {
  private _configLoader: ConfigLoader;
  private _plugins: TestRunnerPlugin[] = [];

  constructor(configCLIOverrides?: ConfigCLIOverrides) {
    this._configLoader = new ConfigLoader(configCLIOverrides);
    setRunnerToAddPluginsTo(this);
  }

  addPlugin(plugin: TestRunnerPlugin) {
    this._plugins.push(plugin);
  }

  async loadConfigFromResolvedFile(resolvedConfigFile: string): Promise<FullConfigInternal> {
    return await this._configLoader.loadConfigFile(resolvedConfigFile);
  }

  loadEmptyConfig(configFileOrDirectory: string): Promise<Config> {
    return this._configLoader.loadEmptyConfig(configFileOrDirectory);
  }

  async listTestFiles(projectNames: string[] | undefined): Promise<any> {
    const projects = collectProjects(this._configLoader.fullConfig(), projectNames);
    const filesByProject = await collectFilesForProjects(projects, []);
    const report: any = {
      projects: []
    };
    for (const [project, files] of filesByProject) {
      report.projects.push({
        ...sanitizeConfigForJSON(project, new Set()),
        files
      });
    }
    return report;
  }

  async runAllTests(options: RunOptions): Promise<FullResult['status']> {
    const config = this._configLoader.fullConfig();
    const deadline = config.globalTimeout ? monotonicTime() + config.globalTimeout : 0;

    // Legacy webServer support.
    this._plugins.push(...webServerPluginsForConfig(config));
    // Docker support.
    this._plugins.push(dockerPlugin);

    const reporter = await createReporter(this._configLoader, options.listOnly);
    const taskRunner = createTaskRunner(config, reporter, this._plugins, options);

    const context: TaskRunnerState = {
      config,
      configLoader: this._configLoader,
      options,
      reporter,
    };

    reporter.onConfigure(config);
    const taskStatus = await taskRunner.run(context, deadline);
    let status: FullResult['status'] = 'passed';
    if (context.dispatcher?.hasWorkerErrors() || context.rootSuite?.allTests().some(test => !test.ok()))
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
