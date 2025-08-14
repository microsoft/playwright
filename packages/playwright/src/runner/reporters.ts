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

import { calculateSha1 } from 'playwright-core/lib/utils';

import { loadReporter } from './loadUtils';
import { formatError } from '../reporters/base';
import { BlobReporter } from '../reporters/blob';
import DotReporter from '../reporters/dot';
import EmptyReporter from '../reporters/empty';
import GitHubReporter from '../reporters/github';
import HtmlReporter from '../reporters/html';
import JSONReporter from '../reporters/json';
import JUnitReporter from '../reporters/junit';
import LineReporter from '../reporters/line';
import ListReporter from '../reporters/list';
import ListModeReporter from '../reporters/listModeReporter';
import { wrapReporterAsV2 } from '../reporters/reporterV2';

import type { ReporterDescription } from '../../types/test';
import type { TestError } from '../../types/testReporter';
import type { BuiltInReporter, FullConfigInternal } from '../common/config';
import type { CommonReporterOptions, Screen } from '../reporters/base';
import type { ReporterV2 } from '../reporters/reporterV2';

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
      reporters.unshift(!process.env.CI ? new LineReporter() : new DotReporter());
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

export function createErrorCollectingReporter(screen: Screen): ErrorCollectingReporter {
  const errors: TestError[] = [];
  return {
    version: () => 'v2',
    onError(error: TestError) {
      errors.push(error);
      screen.stderr?.write(formatError(screen, error).message + '\n');
    },
    errors: () => errors,
  };
}

function reporterOptions(config: FullConfigInternal, mode: 'list' | 'test' | 'merge', isTestServer: boolean): CommonReporterOptions {
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
