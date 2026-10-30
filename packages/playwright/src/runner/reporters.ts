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
import { secretsKey } from '@isomorphic/secrets';
import { calculateSha1 } from '@utils/crypto';

import { loadReporter } from './loadUtils';
import { config as commonConfig } from '../common';
import { formatError } from '../reporters/base';
import { BlobReporter } from '../reporters/blob';
import CoverageReporter from '../reporters/coverage';
import DotReporter from '../reporters/dot';
import EmptyReporter from '../reporters/empty';
import FailuresReporter from '../reporters/failures';
import GitHubReporter from '../reporters/github';
import HtmlReporter from '../reporters/html';
import JSONReporter from '../reporters/json';
import JUnitReporter from '../reporters/junit';
import LineReporter from '../reporters/line';
import ListReporter from '../reporters/list';
import ListModeReporter from '../reporters/listModeReporter';
import PerfettoReporter from '../reporters/perfetto';
import { SecretsRedactor, RedactingReporter } from '../reporters/redactingReporter';
import { wrapReporterAsV2 } from '../reporters/reporterV2';

import type { ReporterDescription } from '../../types/test';
import type { TestError } from '../../types/testReporter';
import type { FullConfigInternal } from '../common';
import type { CommonReporterOptions, Screen } from '../reporters/base';
import type { ReporterV2 } from '../reporters/reporterV2';
import type { Secrets } from '@isomorphic/secrets';
import type { TestRunOptions } from './tasks';

export async function createReporters(config: FullConfigInternal, mode: 'list' | 'test' | 'merge', descriptions?: ReporterDescription[], runOptions?: TestRunOptions): Promise<ReporterV2[]> {
  const defaultReporters: { [key in commonConfig.BuiltInReporter]: new(arg: any) => ReporterV2 } = {
    'blob': BlobReporter,
    'perfetto': PerfettoReporter,
    'dot': mode === 'list' ? ListModeReporter : DotReporter,
    'failures': mode === 'list' ? ListModeReporter : FailuresReporter,
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
  descriptions ??= config.reporterDescriptions;
  const reportOptions = reporterCommandOptions(config, mode, runOptions);
  for (const r of descriptions) {
    const [name, arg] = commonConfig.stripReporterSecrets(r);
    const options = { ...reportOptions, ...arg };
    if (mode === 'list')
      options.onlyFailures = false;
    if (name in defaultReporters) {
      reporters.push(new defaultReporters[name as commonConfig.BuiltInReporter](options));
    } else {
      const reporterConstructor = await loadReporter(config, name);
      reporters.push(wrapReporterAsV2(new reporterConstructor(options)));
    }
  }
  const allSecretsRedactor = wrapReportersWithSecrets(reporters, descriptions);
  if (process.env.PW_TEST_REPORTER) {
    const name = process.env.PW_TEST_REPORTER;
    if (name in defaultReporters) {
      reporters.push(new defaultReporters[name as commonConfig.BuiltInReporter](reportOptions));
    } else {
      const reporterConstructor = await loadReporter(config, name);
      reporters.push(wrapReporterAsV2(new reporterConstructor(reportOptions)));
    }
  }

  const someReporterPrintsToStdio = reporters.some(r => r.printsToStdio ? r.printsToStdio() : true);
  if (reporters.length && !someReporterPrintsToStdio) {
    // Add a line/dot/list-mode reporter for convenience.
    // Important to put it first, just in case some other reporter stalls onEnd.
    let reporter: ReporterV2 | undefined;
    if (mode === 'list')
      reporter = new ListModeReporter();
    else if (mode !== 'merge')
      reporter = !process.env.CI ? new LineReporter() : new DotReporter();
    if (reporter)
      reporters.unshift(allSecretsRedactor ? new RedactingReporter(reporter, allSecretsRedactor) : reporter);
  }
  return reporters;
}

function wrapReportersWithSecrets(reporters: ReporterV2[], descriptions: ReporterDescription[]): SecretsRedactor | undefined {
  const redactors = new Map<string, SecretsRedactor>();
  const redactorFor = (secrets: Secrets) => {
    const key = secretsKey(secrets);
    let redactor = redactors.get(key);
    if (!redactor) {
      redactor = new SecretsRedactor(secrets);
      redactors.set(key, redactor);
    }
    return redactor;
  };
  let allSecrets: Secrets | undefined = reporters.length ? [] : undefined;
  for (let i = 0; i < reporters.length; i++) {
    const secrets: Secrets | undefined = descriptions[i][1]?.secrets;
    if (secrets) {
      reporters[i] = new RedactingReporter(reporters[i], redactorFor(secrets));
      allSecrets = allSecrets ? [...allSecrets, ...secrets] : undefined;
    } else {
      allSecrets = undefined;
    }
  }
  return allSecrets ? redactorFor(allSecrets) : undefined;
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
  };
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
