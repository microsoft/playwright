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
import { formatError } from '../reporters/base';
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

export async function createReporters(config: FullConfigInternal, mode: 'list' | 'run' | 'ui' | 'merge', descriptions?: ReporterDescription[]): Promise<ReporterV2[]> {
  const defaultReporters: { [key in BuiltInReporter]: new(arg: any) => ReporterV2 } = {
    blob: BlobReporter,
    dot: mode === 'list' ? ListModeReporter : DotReporter,
    line: mode === 'list' ? ListModeReporter : LineReporter,
    list: mode === 'list' ? ListModeReporter : ListReporter,
    github: GitHubReporter,
    json: JSONReporter,
    junit: JUnitReporter,
    null: EmptyReporter,
    html: mode === 'ui' ? LineReporter : HtmlReporter,
    markdown: MarkdownReporter,
  };
  const reporters: ReporterV2[] = [];
  descriptions ??= config.config.reporter;
  for (const r of descriptions) {
    const [name, arg] = r;
    const options = { ...arg, configDir: config.configDir };
    if (name in defaultReporters) {
      reporters.push(new defaultReporters[name as keyof typeof defaultReporters](options));
    } else {
      const reporterConstructor = await loadReporter(config, name);
      reporters.push(wrapReporterAsV2(new reporterConstructor(options)));
    }
  }
  if (process.env.PW_TEST_REPORTER) {
    const reporterConstructor = await loadReporter(config, process.env.PW_TEST_REPORTER);
    reporters.push(wrapReporterAsV2(new reporterConstructor()));
  }

  const someReporterPrintsToStdio = reporters.some(r => r.printsToStdio());
  if (reporters.length && !someReporterPrintsToStdio) {
    // Add a line/dot/list-mode reporter for convenience.
    // Important to put it first, jsut in case some other reporter stalls onEnd.
    if (mode === 'list')
      reporters.unshift(new ListModeReporter());
    else if (mode !== 'merge')
      reporters.unshift(!process.env.CI ? new LineReporter({ omitFailures: true }) : new DotReporter());
  }
  return reporters;
}

class ListModeReporter extends EmptyReporter {
  private config!: FullConfig;

  override onConfigure(config: FullConfig) {
    this.config = config;
  }

  override onBegin(suite: Suite): void {
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

  override onError(error: TestError) {
    // eslint-disable-next-line no-console
    console.error('\n' + formatError(error, false).message);
  }
}
