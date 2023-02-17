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
import type { Reporter, TestError } from '../../types/testReporter';
import { formatError } from '../reporters/base';
import DotReporter from '../reporters/dot';
import EmptyReporter from '../reporters/empty';
import GitHubReporter from '../reporters/github';
import HtmlReporter from '../reporters/html';
import JSONReporter from '../reporters/json';
import JUnitReporter from '../reporters/junit';
import LineReporter from '../reporters/line';
import ListReporter from '../reporters/list';
import { Multiplexer } from '../reporters/multiplexer';
import type { Suite } from '../common/test';
import type { FullConfigInternal } from '../common/types';
import { loadReporter } from './loadUtils';
import type { BuiltInReporter } from '../common/configLoader';

export async function createReporter(config: FullConfigInternal, mode: 'list' | 'watch' | 'run') {
  const defaultReporters: {[key in BuiltInReporter]: new(arg: any) => Reporter} = {
    dot: mode === 'list' ? ListModeReporter : DotReporter,
    line: mode === 'list' ? ListModeReporter : LineReporter,
    list: mode === 'list' ? ListModeReporter : ListReporter,
    github: GitHubReporter,
    json: JSONReporter,
    junit: JUnitReporter,
    null: EmptyReporter,
    html: HtmlReporter,
  };
  const reporters: Reporter[] = [];
  if (mode === 'watch') {
    reporters.push(new ListReporter());
  } else {
    for (const r of config.reporter) {
      const [name, arg] = r;
      if (name in defaultReporters) {
        reporters.push(new defaultReporters[name as keyof typeof defaultReporters](arg));
      } else {
        const reporterConstructor = await loadReporter(config, name);
        reporters.push(new reporterConstructor(arg));
      }
    }
    if (process.env.PW_TEST_REPORTER) {
      const reporterConstructor = await loadReporter(config, process.env.PW_TEST_REPORTER);
      reporters.push(new reporterConstructor());
    }
  }

  const someReporterPrintsToStdio = reporters.some(r => {
    const prints = r.printsToStdio ? r.printsToStdio() : true;
    return prints;
  });
  if (reporters.length && !someReporterPrintsToStdio) {
    // Add a line/dot/list-mode reporter for convenience.
    // Important to put it first, jsut in case some other reporter stalls onEnd.
    if (mode === 'list')
      reporters.unshift(new ListModeReporter());
    else
      reporters.unshift(!process.env.CI ? new LineReporter({ omitFailures: true }) : new DotReporter());
  }
  return new Multiplexer(reporters);
}

export class ListModeReporter implements Reporter {
  private config!: FullConfigInternal;

  onBegin(config: FullConfigInternal, suite: Suite): void {
    this.config = config;
    // eslint-disable-next-line no-console
    console.log(`Listing tests:`);
    const tests = suite.allTests();
    const files = new Set<string>();
    for (const test of tests) {
      // root, project, file, ...describes, test
      const [, projectName, , ...titles] = test.titlePath();
      const location = `${path.relative(config.rootDir, test.location.file)}:${test.location.line}:${test.location.column}`;
      const projectTitle = projectName ? `[${projectName}] › ` : '';
      // eslint-disable-next-line no-console
      console.log(`  ${projectTitle}${location} › ${titles.join(' ')}`);
      files.add(test.location.file);
    }
    // eslint-disable-next-line no-console
    console.log(`Total: ${tests.length} ${tests.length === 1 ? 'test' : 'tests'} in ${files.size} ${files.size === 1 ? 'file' : 'files'}`);
  }

  onError(error: TestError) {
    // eslint-disable-next-line no-console
    console.error('\n' + formatError(this.config, error, false).message);
  }
}
