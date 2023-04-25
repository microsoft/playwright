#!/usr/bin/env node

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

/* eslint-disable no-console */

import program from './program';

{
  const command = program.command('test').allowUnknownOption(true);
  command.description('Run tests with Playwright Test. Available in @playwright/test package.');
  command.action(async () => {
    console.error('Please install @playwright/test package to use Playwright Test.');
    console.error('  npm install -D @playwright/test');
    process.exit(1);
  });
}

{
  const command = program.command('show-report').allowUnknownOption(true);
  command.description('Show Playwright Test HTML report. Available in @playwright/test package.');
  command.action(async () => {
    console.error('Please install @playwright/test package to use Playwright Test.');
    console.error('  npm install -D @playwright/test');
    process.exit(1);
  });
}

{
  const command = program.command('show-trace').allowUnknownOption(true);
  command.description('Show Playwright Trace. Available in @playwright/test package.');
  command.action(async () => {
    console.error('Please install @playwright/test package to use Playwright Test.');
    console.error('  npm install -D @playwright/test');
    process.exit(1);
  });
}

program.parse(process.argv);
