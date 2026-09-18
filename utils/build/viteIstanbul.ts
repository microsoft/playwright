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

import { defaults } from '@istanbuljs/schema';
import { createInstrumenter } from 'istanbul-lib-instrument';

import type { Plugin } from 'vite';

// Instruments the sources under packages/ for istanbul coverage when PWTEST_COVERAGE is set.
// Runs before the other transforms, so that the counters point at the original sources.
// The __PW_COVERAGE__ define lets the sources ship test-only code, e.g. the coverage
// route of the trace viewer service worker, that a normal build drops.
export function istanbul(): Plugin {
  const enabled = !!process.env.PWTEST_COVERAGE;
  return {
    name: 'playwright-istanbul',
    enforce: 'pre',
    config: () => ({ define: { __PW_COVERAGE__: JSON.stringify(enabled) } }),
    transform(code, id) {
      const file = id.split('?')[0];
      if (!enabled || !/\/packages\/.*\.[jt]sx?$/.test(file) || file.endsWith('.d.ts') || file.includes('/node_modules/'))
        return;
      // The option replaces the default parser plugins rather than extending them.
      const parserPlugins = [...defaults.instrumenter.parserPlugins];
      if (/\.tsx?$/.test(file))
        parserPlugins.push('typescript');
      if (/\.[jt]sx$/.test(file))
        parserPlugins.push('jsx');
      const instrumenter = createInstrumenter({ esModules: true, produceSourceMap: true, parserPlugins });
      return { code: instrumenter.instrumentSync(code, file), map: instrumenter.lastSourceMap() };
    },
  };
}
