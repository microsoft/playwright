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
import fs from 'fs';
import { calculateSha1 } from '@utils/crypto';

import { loadReporter } from './loadUtils';
import { formatError } from '../reporters/base';
import { BlobReporter } from '../reporters/blob';
import CoverageReporter from '../reporters/coverage';
import DotReporter from '../reporters/dot';
import EmptyReporter from '../reporters/empty';
import GitHubReporter from '../reporters/github';
import HtmlReporter from '../reporters/html';
import JSONReporter from '../reporters/json';
import JUnitReporter from '../reporters/junit';
import LineReporter from '../reporters/line';
import ListReporter from '../reporters/list';
import ListModeReporter from '../reporters/listModeReporter';
import OnlyFailuresTestReporter from '../reporters/onlyFailures';
import PerfettoReporter from '../reporters/perfetto';
import { wrapReporterAsV2 } from '../reporters/reporterV2';

import type { ReporterDescription } from '../../types/test';
import type { TestError } from '../../types/testReporter';
import type { config as commonConfig, FullConfigInternal } from '../common';
import type { CommonReporterOptions, Screen } from '../reporters/base';
import type { ReporterV2 } from '../reporters/reporterV2';
import type { TestRunOptions } from './tasks';

export async function createReporters(config: FullConfigInternal, mode: 'list' | 'test' | 'merge', descriptions?: ReporterDescription[], runOptions?: TestRunOptions): Promise<ReporterV2[]> {
  const defaultReporters: { [key in commonConfig.BuiltInReporter]: new(arg: any) => ReporterV2 } = {
    'blob': BlobReporter,
    'perfetto': PerfettoReporter,
    'dot': mode === 'list' ? ListModeReporter : DotReporter,
    'line': mode === 'list' ? ListModeReporter : LineReporter,
    'list': mode === 'list' ? ListModeReporter : ListReporter,
    'github': GitHubReporter,
    'json': JSONReporter,
    'junit': JUnitReporter,
    'null': EmptyReporter,
    'html': HtmlReporter,
    'coverage': CoverageReporter,
  };
  const reporters: ReporterV2[] = [];
  descriptions ??= config.config.reporter;
  const reportOptions = reporterCommandOptions(config, mode, runOptions);

  function createBuiltInReporter(name: commonConfig.BuiltInReporter, options: CommonReporterOptions): ReporterV2 {
    const reporter = new defaultReporters[name](options);
    if ((reporter instanceof DotReporter || reporter instanceof LineReporter || reporter instanceof ListReporter) && reporter.options.onlyFailures)
      return new OnlyFailuresTestReporter(reporter.options);
    return reporter;
  }

  for (const r of descriptions) {
    const [name, arg] = r;
    const options = resolveReporterOptions(reportOptions, { ...reportOptions, ...arg });
    if (name in defaultReporters) {
      reporters.push(createBuiltInReporter(name as commonConfig.BuiltInReporter, options));
    } else {
      const reporterConstructor = await loadReporter(config, name);
      reporters.push(wrapReporterAsV2(new reporterConstructor(options)));
    }
  }
  if (process.env.PW_TEST_REPORTER) {
    const name = process.env.PW_TEST_REPORTER;
    const options = resolveReporterOptions(reportOptions);
    if (name in defaultReporters) {
      reporters.push(createBuiltInReporter(name as commonConfig.BuiltInReporter, options));
    } else {
      const reporterConstructor = await loadReporter(config, name);
      reporters.push(wrapReporterAsV2(new reporterConstructor(options)));
    }
  }

  const someReporterPrintsToStdio = reporters.some(r => r.printsToStdio ? r.printsToStdio() : true);
  if (reporters.length && !someReporterPrintsToStdio) {
    // Add a line/dot/list-mode reporter for convenience.
    // Important to put it first, just in case some other reporter stalls onEnd.
    if (mode === 'list') {
      reporters.unshift(new ListModeReporter());
    } else if (mode !== 'merge') {
      const name = process.env.CI ? 'dot' : 'line';
      reporters.unshift(createBuiltInReporter(name, resolveReporterOptions(reportOptions)));
    }
  }
  return reporters;
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

function reporterCommandOptions(config: FullConfigInternal, mode: 'list' | 'test' | 'merge', runOptions?: TestRunOptions): CommonReporterOptions {
  return {
    configDir: config.configDir,
    _mode: mode,
    _commandHash: computeCommandHash(config, runOptions),
    onlyFailures: mode !== 'list' && config.configCLIOverrides.reporterOnlyFailures,
  };
}

function resolveReporterOptions(commonOptions: CommonReporterOptions, options: CommonReporterOptions = commonOptions): CommonReporterOptions {
  let onlyFailures = options.onlyFailures;
  if (commonOptions._mode === 'list')
    onlyFailures = false;
  else if (commonOptions.onlyFailures)
    onlyFailures = true;
  return { ...options, onlyFailures };
}

function computeCommandHash(config: FullConfigInternal, runOptions?: TestRunOptions) {
  const parts = [];
  // Include project names for readability.
  if (runOptions?.projectFilter)
    parts.push(...runOptions.projectFilter);
  const command = {} as any;
  if (runOptions?.locations?.length)
    command.locations = runOptions.locations;
  if (runOptions?.grep)
    command.grep = runOptions.grep;
  if (runOptions?.grepInvert)
    command.grepInvert = runOptions.grepInvert;
  if (runOptions?.onlyChanged)
    command.onlyChanged = runOptions.onlyChanged;
  if (config.config.tags.length)
    command.tags = config.config.tags.join(' ');
  if (runOptions?.testList)
    command.testList = calculateSha1(fs.readFileSync(runOptions.testList));
  if (runOptions?.testListInvert)
    command.testListInvert = calculateSha1(fs.readFileSync(runOptions.testListInvert));
  if (Object.keys(command).length)
    parts.push(calculateSha1(JSON.stringify(command)).substring(0, 7));
  return parts.join('-');
}
