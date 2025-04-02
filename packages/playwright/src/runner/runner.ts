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

import { LastRunReporter } from './lastRun';
import { collectFilesForProject, filterProjects } from './projectUtils';
import { createErrorCollectingReporter, createReporters } from './reporters';
import { TestRun, createApplyRebaselinesTask, createClearCacheTask, createGlobalSetupTasks, createLoadTask, createPluginSetupTasks, createReportBeginTask, createRunTestsTasks, createStartDevServerTask, runTasks } from './tasks';
import { addGitCommitInfoPlugin } from '../plugins/gitCommitInfoPlugin';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import { terminalScreen } from '../reporters/base';
import { InternalReporter } from '../reporters/internalReporter';
import { affectedTestFiles } from '../transform/compilationCache';
import { formatTestHeader } from '../reporters/base';
import { loadCodeFrame } from '../util';

import type { TestAnnotation, Location } from '../../types/test';
import type { TestCase } from '../common/test';
import type { FullResult, TestError } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';


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
  private _lastRun?: LastRunReporter;

  constructor(config: FullConfigInternal, lastRun?: LastRunReporter) {
    this._config = config;
    this._lastRun = lastRun;
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

    addGitCommitInfoPlugin(config);

    // Legacy webServer support.
    webServerPluginsForConfig(config).forEach(p => config.plugins.push({ factory: p }));

    const reporters = await createReporters(config, listOnly ? 'list' : 'test', false);
    const lastRun = this._lastRun ?? new LastRunReporter(config);
    if (config.cliLastFailed)
      await lastRun.filterLastFailed();

    const reporter = new InternalReporter([...reporters, lastRun]);
    const tasks = listOnly ? [
      createLoadTask('in-process', { failOnLoadErrors: true, filterOnly: false }),
      createReportBeginTask(),
    ] : [
      createApplyRebaselinesTask(),
      ...createGlobalSetupTasks(config),
      createLoadTask('in-process', { filterOnly: true, failOnLoadErrors: true }),
      ...createRunTestsTasks(config),
    ];
    const status = await runTasks(new TestRun(config, reporter), tasks, config.config.globalTimeout);

    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    // See https://github.com/nodejs/node/issues/12921
    await new Promise<void>(resolve => process.stdout.write('', () => resolve()));
    await new Promise<void>(resolve => process.stderr.write('', () => resolve()));
    return status;
  }

  async findRelatedTestFiles(files: string[]): Promise<FindRelatedTestFilesReport>  {
    const errorReporter = createErrorCollectingReporter(terminalScreen);
    const reporter = new InternalReporter([errorReporter]);
    const status = await runTasks(new TestRun(this._config, reporter), [
      ...createPluginSetupTasks(this._config),
      createLoadTask('in-process', { failOnLoadErrors: true, filterOnly: false, populateDependencies: true }),
    ]);
    if (status !== 'passed')
      return { errors: errorReporter.errors(), testFiles: [] };
    return { testFiles: affectedTestFiles(files) };
  }

  async runDevServer() {
    const reporter = new InternalReporter([createErrorCollectingReporter(terminalScreen, true)]);
    const status = await runTasks(new TestRun(this._config, reporter), [
      ...createPluginSetupTasks(this._config),
      createLoadTask('in-process', { failOnLoadErrors: true, filterOnly: false }),
      createStartDevServerTask(),
      { title: 'wait until interrupted', setup: async () => new Promise(() => {}) },
    ]);
    return { status };
  }

  async clearCache() {
    const reporter = new InternalReporter([createErrorCollectingReporter(terminalScreen, true)]);
    const status = await runTasks(new TestRun(this._config, reporter), [
      ...createPluginSetupTasks(this._config),
      createClearCacheTask(this._config),
    ]);
    return { status };
  }

  async printWarnings(lastRun: LastRunReporter) {
    const reporter = new InternalReporter([createErrorCollectingReporter(terminalScreen, true)]);
    const testRun = new TestRun(this._config, reporter);
    const status = await runTasks(testRun, [
      ...createPluginSetupTasks(this._config),
      createLoadTask('in-process', { failOnLoadErrors: true, filterOnly: false })
    ]);

    const tests = testRun.rootSuite?.allTests() ?? [];
    const testsMap = new Map(tests.map(test => [test.id, test]));

    const lastRunInfo = await lastRun.runInfo();
    const knownWarnings = lastRunInfo?.warningTests ?? {};

    const testToWarnings = Object.entries(knownWarnings).flatMap(([id, warnings]) => {
      const test = testsMap.get(id);
      if (!test)
        return [];

      return { test, warnings };
    });

    const sourceCache = new Map<string, string>();

    const warningMessages = await Promise.all(testToWarnings.map(({ test, warnings }, i) => this._buildWarning(test, warnings, i + 1, sourceCache)));
    if (warningMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`${warningMessages.join('\n')}\n`);
    }

    return { status };
  }

  private async _buildWarning(test: TestCase, warnings: TestAnnotation[], renderIndex: number, sourceCache: Map<string, string>): Promise<string> {
    const encounteredWarnings = new Map<string, Array<Location | undefined>>();
    for (const annotation of warnings) {
      if (annotation.description === undefined)
        continue;
      let matchingWarnings = encounteredWarnings.get(annotation.description);
      if (!matchingWarnings) {
        matchingWarnings = [];
        encounteredWarnings.set(annotation.description, matchingWarnings);
      }
      matchingWarnings.push(annotation.location);
    }

    // Sort warnings by location inside of each category
    for (const locations of encounteredWarnings.values()) {
      locations.sort((a, b) => {
        if (!a)
          return 1;
        if (!b)
          return -1;
        if (a.line !== b.line)
          return a.line - b.line;
        if (a.column !== b.column)
          return a.column - b.column;
        return 0;
      });
    }

    const testHeader = formatTestHeader(terminalScreen, this._config.config, test, { indent: '  ', index: renderIndex });

    const codeFrameIndent = '    ';

    const warningMessages = await Promise.all(encounteredWarnings.entries().map(async ([description, locations]) => {
      const renderedCodeFrames = await Promise.all(locations.flatMap(location => !!location ? loadCodeFrame(location, sourceCache, { highlightCode: true }) : []));
      const indentedCodeFrames = renderedCodeFrames.map(f => f.split('\n').map(line => `${codeFrameIndent}${line}`).join('\n'));

      const warningCount = locations.length > 1 ? ` (x${locations.length})` : '';
      const allFrames = renderedCodeFrames.length > 0 ? `\n\n${indentedCodeFrames.join('\n\n')}` : '';

      return `    ${terminalScreen.colors.yellow(`Warning${warningCount}: ${description}`)}${allFrames}`;
    }));

    return `\n${testHeader}\n\n${warningMessages.join('\n\n')}`;
  }
}
