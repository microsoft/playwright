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

import { program } from 'commander';
const packageJSON = require('../package.json');

program
    .version('Version ' + packageJSON.version)
    .name('playwright-grid');

program
    .command('grid')
    .option('--port <port>', 'port to listen to, 3333 by default')
    .option('--access-key <key>', 'access key to the grid')
    .option('--https-cert <cert>', 'path to the HTTPS certificate')
    .option('--https-key <key>', 'path to the HTTPS key')
    .action(async opts => {
      const port = opts.port || +(process.env.PLAYWRIGHT_GRID_PORT || '3333');
      const accessKey = opts.accessKey || process.env.PLAYWRIGHT_GRID_ACCESS_KEY;
      const httpsCert = opts.httpsCert || process.env.PLAYWRIGHT_GRID_HTTPS_CERT;
      const httpsKey = opts.httpsKey || process.env.PLAYWRIGHT_GRID_HTTPS_KEY;
      const { Grid } = await import('./grid/grid.js');
      const grid = await Grid.create({ port, accessKey, httpsCert, httpsKey });
      grid.start();
    });

program
    .command('node')
    .option('--grid <url>', 'grid address', 'localhost:3333')
    .option('--capacity <capacity>', 'node capacity', '1')
    .option('--access-key <key>', 'access key to the grid', '')
    .action(async opts => {
      const { Node } = await import('./node/node.js');
      const accessKey = opts.accessKey || process.env.PLAYWRIGHT_GRID_ACCESS_KEY;
      const node = new Node(opts.grid, +opts.capacity, accessKey);
      await node.connect();
    });

program.parse(process.argv);
