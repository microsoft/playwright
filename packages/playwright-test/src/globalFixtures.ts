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

import { EventEmitter } from 'events';
import { ManualPromise } from 'playwright-core/lib/utils/async';
import { FullConfig, WorkerInfo, TestError, FullProject } from './types';
import { FixturePool, FixtureRegistration, FixtureRunner } from './fixtures';
import { GlobalFixtureSetupRequest, GlobalFixtureSetupResponse } from './ipc';
import { prependToTestError, serializeError } from './util';

type GlobalFixtureData = {
  originalName: string;
  registration: FixtureRegistration;
  value?: Promise<{ stringifiedValue?: string, error?: TestError }>;
};

export class GlobalFixtureRunner {
  private _pool: FixturePool;
  private _runner: FixtureRunner;
  private _idToFixture = new Map<string, GlobalFixtureData>();
  private _config: FullConfig;

  constructor(config: FullConfig) {
    this._config = config;
    this._pool = new FixturePool([]);
    this._runner = new FixtureRunner();
    this._runner.setPool(this._pool);
  }

  registerPool(pool: FixturePool) {
    for (const registration of pool.registrations.values()) {
      if (registration.scope === 'global')
        this.registerFixture(pool, registration);
    }
  }

  private registerFixture(pool: FixturePool, registration: FixtureRegistration): FixtureRegistration {
    const id = pool.persistentId(registration);
    const data = this._idToFixture.get(id);
    if (data)
      return data.registration;
    const parent = registration.super ? this.registerFixture(pool, registration.super) : undefined;
    const newRegistration: FixtureRegistration = {
      ...registration,
      super: parent,
      name: id,
      id,
      deps: registration.deps.map(dep => {
        const oldDep = pool.resolveDependency(registration, dep)!;
        const newDep = this.registerFixture(pool, oldDep);
        return newDep.name;
      }),
    };
    this._pool.registrations.set(id, newRegistration);
    this._idToFixture.set(id, { originalName: registration.name, registration: newRegistration });
    return newRegistration;
  }

  async setupGlobalFixture(payload: GlobalFixtureSetupRequest): Promise<GlobalFixtureSetupResponse> {
    const data = this._idToFixture.get(payload.id);
    if (!data) {
      return {
        id: payload.id,
        error: { message: `Unable to resolve global fixture` },
      };
    }

    if (!data.value) {
      const workerInfo: WorkerInfo = {
        config: this._config,
        project: dummyProject,
        parallelIndex: -1,
        workerIndex: -1,
      };
      data.value = this._runner.setupFixtureForRegistration(data.registration, workerInfo, undefined).then(fixture => {
        try {
          const stringifiedValue = JSON.stringify(fixture.value);
          if (stringifiedValue === undefined)
            return { error: { message: `The value of the global fixture "${data.originalName}" cannot be serialized.` } };
          return { stringifiedValue };
        } catch (e) {
          const error = prependToTestError(serializeError(e), `The value of the global fixture "${data.originalName}" cannot be serialized:\n`);
          return { error };
        }
      }).catch(e => {
        return { error: serializeError(e) };
      });
    }

    const result = await data.value;
    return {
      id: payload.id,
      error: result.error,
      stringifiedValue: result.stringifiedValue,
    };
  }

  async teardown() {
    // TODO: handle timeout here.
    await this._runner.teardownScope('global');
  }
}

export class GlobalFixtureResolver extends EventEmitter {
  private _setupPromises = new Map<string, ManualPromise<any>>();

  async setup(persistentId: string): Promise<any> {
    const id = persistentId;
    const setupPromise = new ManualPromise<any>();
    this._setupPromises.set(id, setupPromise);
    const setupRequest: GlobalFixtureSetupRequest = { id };
    this.emit('globalFixtureSetupRequest', setupRequest);
    const value = await setupPromise;
    this._setupPromises.delete(id);
    return value;
  }

  globalFixtureSetupResponse(response: GlobalFixtureSetupResponse) {
    const promise = this._setupPromises.get(response.id);
    if (!promise)
      return;
    if (response.error) {
      if ('value' in response.error) {
        promise.reject(response.error.value as any);
      } else {
        const e = new Error(response.error.message || '');
        e.stack = response.error.stack;
        promise.reject(e);
      }
    } else {
      promise.resolve(JSON.parse(response.stringifiedValue!));
    }
  }
}

const dummyProject: FullProject = {
  expect: {},
  outputDir: '',
  repeatEach: 1,
  retries: 0,
  metadata: undefined,
  name: '',
  testDir: '',
  snapshotDir: '',
  testIgnore: [],
  testMatch: '',
  timeout: 0,
  use: {},
};
