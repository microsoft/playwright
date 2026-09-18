/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Plugin } from 'vite';

// Instruments the sources under packages/ for istanbul coverage when PWTEST_COVERAGE is set.
// Requires istanbul-lib-instrument, which is not a dependency of the repo:
//   npm i --no-save istanbul-lib-instrument istanbul-lib-coverage istanbul-lib-report istanbul-reports
// The __PW_COVERAGE__ define lets the sources ship test-only code, e.g. the coverage
// route of the trace viewer service worker, that a normal build drops.
export function istanbul(): Plugin {
  const enabled = !!process.env.PWTEST_COVERAGE;
  const config = () => ({ define: { __PW_COVERAGE__: JSON.stringify(enabled) } });
  if (!enabled)
    return { name: 'playwright-istanbul', config };
  let createInstrumenter: any;
  let parserPlugins: string[];
  return {
    name: 'playwright-istanbul',
    // Instrument the original sources, so that the counters point at them directly.
    enforce: 'pre',
    config,
    async buildStart() {
      // Not repo dependencies, resolved at run time only.
      try {
        createInstrumenter = (await import('istanbul-lib-instrument' as string)).createInstrumenter;
        parserPlugins = (await import('@istanbuljs/schema' as string)).defaults.instrumenter.parserPlugins;
      } catch (error) {
        // Installed without saving, any npm install removes them again.
        throw new Error(`PWTEST_COVERAGE needs the istanbul packages, run:\n  npm i --no-save istanbul-lib-instrument istanbul-lib-coverage istanbul-lib-report istanbul-reports\n${error.message}`);
      }
    },
    transform(code, id) {
      const file = id.split('?')[0];
      if (!/\/packages\/.*\.[jt]sx?$/.test(file) || file.endsWith('.d.ts') || file.includes('/node_modules/'))
        return;
      // The option replaces the default parser plugins rather than extending them.
      const plugins = [...parserPlugins];
      if (/\.tsx?$/.test(file))
        plugins.push('typescript');
      if (/\.[jt]sx$/.test(file))
        plugins.push('jsx');
      const instrumenter = createInstrumenter({ esModules: true, produceSourceMap: true, parserPlugins: plugins });
      return { code: instrumenter.instrumentSync(code, file), map: instrumenter.lastSourceMap() };
    },
  };
}
