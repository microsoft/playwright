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

import dotenv from 'dotenv';
import { program } from 'commander';

import { Context } from './browser/context';

/* eslint-disable no-console */

dotenv.config();

const packageJSON = require('../package.json');

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .action(async () => {
      const context = await Context.create();
      const code = await context.runScript(script);
      console.log('Output code:');
      console.log('```javascript');
      console.log(code);
      console.log('```');
      await context.close();
    });

// An example of a failing script.
//
// const script = [
//   'Navigate to https://debs-obrien.github.io/playwright-movies-app/search?searchTerm=Twister&page=1',
//   'Verify that the URL contains the search term "twisters"',
// ];

const script = [
  'Navigate to https://debs-obrien.github.io/playwright-movies-app',
  'Click search icon',
  'Type "Twister" in the search field and hit Enter',
  'Verify that the URL contains the search term "twister"',
  'Verify that the search results contain an image named "Twisters"',
  'Click on the link for the movie "Twisters"',
  'Verify that the main heading on the movie page is "Twisters"',
];

export { program };
