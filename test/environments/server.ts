/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {TestServer} from './testserver';
import {pageEnv} from 'playwright-runner';
import {Environment} from 'describers';
import path from 'path';

let current_port = 8907;
export const serverEnv = new Environment<void, {server: TestServer, httpsServer: TestServer}>({
  async beforeAll() {
    const assetsPath = path.join(__dirname, '..', 'assets');
    const server = await TestServer.create(assetsPath, ++current_port);
    const httpsServer = await TestServer.createHTTPS(assetsPath, ++current_port);
    return {server, httpsServer};
  },
  async afterAll({server, httpsServer}) {
    await server.stop();
    await httpsServer.stop();
  },
  async beforeEach() {
  },
  async afterEach() {
  }
});


export const it = pageEnv.mixin(serverEnv).it;
