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

import fs from 'fs';

import dotenv from 'dotenv';
import { program } from 'commander';

import { Context } from './codegen/context';
import { runRecorderLoop } from './recorderLoop';

/* eslint-disable no-console */

dotenv.config();

const packageJSON = require('../package.json');

program
    .command('run <spec>').description('Run a test')
    .version('Version ' + packageJSON.version)
    .option('-o, --output <path>', 'The path to save the generated code')
    .action(async (spec, options) => {
      const content = await fs.promises.readFile(spec, 'utf8');
      const codegenContext = new Context();
      const code = await codegenContext.generateCode(content);
      if (options.output)
        await fs.promises.writeFile(options.output, code);
      else
        console.log(code);
    });

program
    .command('record').description('Record a test')
    .version('Version ' + packageJSON.version)
    .action(async () => {
      await runRecorderLoop();
    });

export { program };
