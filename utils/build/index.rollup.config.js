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

import { config, projectRoot } from './common-template.rollup.config';
import path from 'path';

export default {
  ...config({
    shebangs: {
      'cli.js': '#!/usr/bin/env node',
    }
  }),
  input: {
    events: path.join(projectRoot, 'src', 'client', 'events.ts'),
    api: path.join(projectRoot, 'src', 'client', 'api.ts'),
    inprocess: path.join(projectRoot, 'src', 'inprocess.ts'),
    testExports: path.join(projectRoot, 'src', 'testExports.ts'),
    service: path.join(projectRoot, 'src', 'service.ts'),
    cliTestExports: path.join(projectRoot, 'src', 'cli', 'cliTestExports.ts'),
    cli: path.join(projectRoot, 'src', 'cli', 'cli.ts'),
    installer: path.join(projectRoot, 'src', 'install', 'installer.ts'),
  },
};
