/**
 * Copyright Microsoft Corporation. All rights reserved.
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
import type { FullConfig, TestError } from '../../types/testReporter';
import { colors, formatError } from '../reporters/base';
import DotReporter from '../reporters/dot';
import EmptyReporter from '../reporters/empty';
import GitHubReporter from '../reporters/github';
import HtmlReporter from '../reporters/html';
import JSONReporter from '../reporters/json';
import JUnitReporter from '../reporters/junit';
import LineReporter from '../reporters/line';
import ListReporter from '../reporters/list';
import MarkdownReporter from '../reporters/markdown';
import type { Suite } from '../common/test';
import type { BuiltInReporter, FullConfigInternal } from '../common/config';
import { loadReporter } from './loadUtils';
import { BlobReporter } from '../reporters/blob';
import type { ReporterDescription } from '../../types/test';
import { type ReporterV2, wrapReporterAsV2 } from '../reporters/reporterV2';
import { calculateSha1 } from 'playwright-core/lib/utils';

export async function createReporters(config: FullConfigInternal, mode: 'list' | 'test' | 'merge', isTestServer: boolean, descriptions?: ReporterDescription[]): Promise<ReporterV2[]> {
  const defaultReporters: { [key in BuiltInReporter]: new(arg: any) => ReporterV2 } = {
    blob: BlobReporter,
    dot: mode === 'list' ? ListModeReporter : DotReporter,
    line: mode === 'list' ? ListModeReporter : LineReporter,
    list: mode === 'list' ? ListModeReporter : ListReporter,
    github: GitHubReporter,
    json: JSONReporter,
    junit: JUnitReporter,
    null: EmptyReporter,
    html: HtmlReporter,
    markdown: MarkdownReporter,
  };
  const reporters: ReporterV2[] = [];
  descriptions ??= config.config.reporter;
  if (config.configCLIOverrides.additionalReporters)
    descriptions = [...descriptions, ...config.configCLIOverrides.additionalReporters];
  const runOptions = reporterOptions(config, mode, isTestServer);
  for (const r of descriptions) {
    const [name, arg] = r;
    const options = { ...runOptions, ...arg };
    if (name in defaultReporters) {
      reporters.push(new defaultReporters[name as keyof typeof defaultReporters](options));
    } else {
      const reporterConstructor = await loadReporter(config, name);
      reporters.push(wrapReporterAsV2(new reporterConstructor(options)));
    }
  }
  if (process.env.PW_TEST_REPORTER) {
    const reporterConstructor = await loadReporter(config, process.env.PW_TEST_REPORTER);
    reporters.push(wrapReporterAsV2(new reporterConstructor(runOptions)));
  }

  const someReporterPrintsToStdio = reporters.some(r => r.printsToStdio ? r.printsToStdio() : true);
  if (reporters.length && !someReporterPrintsToStdio) {
    // Add a line/dot/list-mode reporter for convenience.
    // Important to put it first, just in case some other reporter stalls onEnd.
    if (mode === 'list')
      reporters.unshift(new ListModeReporter());
    else if (mode !== 'merge')
      reporters.unshift(!process.env.CI ? new LineReporter({ omitFailures: true }) : new DotReporter());
  }
  return reporters;
}

export async function createReporterForTestServer(file: string, messageSink: (message: any) => void): Promise<ReporterV2> {
  const reporterConstructor = await loadReporter(null, file);
  return wrapReporterAsV2(new reporterConstructor({
    _send: messageSink,
  }));
}

interface ErrorCollectingReporter extends ReporterV2 {
  errors(): TestError[];
}

export function createErrorCollectingReporter(writeToConsole?: boolean): ErrorCollectingReporter {
  const errors: TestError[] = [];
  return {
    version: () => 'v2',
    onError(error: TestError) {
      errors.push(error);
      if (writeToConsole)
        process.stdout.write(formatError(error, colors.enabled).message + '\n');
    },
    errors: () => errors,
  };
}

function reporterOptions(config: FullConfigInternal, mode: 'list' | 'test' | 'merge', isTestServer: boolean) {
  return {
    configDir: config.configDir,
    _mode: mode,
    _isTestServer: isTestServer,
    _commandHash: computeCommandHash(config),
  };
}

function computeCommandHash(config: FullConfigInternal) {
  const parts = [];
  // Include project names for readability.
  if (config.cliProjectFilter)
    parts.push(...config.cliProjectFilter);
  const command = {} as any;
  if (config.cliArgs.length)
    command.cliArgs = config.cliArgs;
  if (config.cliGrep)
    command.cliGrep = config.cliGrep;
  if (config.cliGrepInvert)
    command.cliGrepInvert = config.cliGrepInvert;
  if (config.cliOnlyChanged)
    command.cliOnlyChanged = config.cliOnlyChanged;
  if (Object.keys(command).length)
    parts.push(calculateSha1(JSON.stringify(command)).substring(0, 7));
  return parts.join('-');
}

class ListModeReporter implements ReporterV2 {
  private config!: FullConfig;

  version(): 'v2' {
    return 'v2';
  }

  onConfigure(config: FullConfig) {
    this.config = config;
  }

  onBegin(suite: Suite): void {
    // eslint-disable-next-line no-console
    console.log(`Listing tests:`);
    const tests = suite.allTests();
    const files = new Set<string>();
    for (const test of tests) {
      // root, project, file, ...describes, test
      const [, projectName, , ...titles] = test.titlePath();
      const location = `${path.relative(this.config.rootDir, test.location.file)}:${test.location.line}:${test.location.column}`;
      const projectTitle = projectName ? `[${projectName}] › ` : '';
      // eslint-disable-next-line no-console
      console.log(`  ${projectTitle}${location} › ${titles.join(' › ')}`);
      files.add(test.location.file);
    }
    // eslint-disable-next-line no-console
    console.log(`Total: ${tests.length} ${tests.length === 1 ? 'test' : 'tests'} in ${files.size} ${files.size === 1 ? 'file' : 'files'}`);
  }

  onError(error: TestError) {
    // eslint-disable-next-line no-console
    console.error('\n' + formatError(error, false).message);
  }
}
