/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

const Location = require('./Location');

const TestExpectation = {
  Ok: 'ok',
  Fail: 'fail',
};

class Test {
  constructor(suite, name, callback, location) {
    this._suite = suite;
    this._name = name;
    this._fullName = (suite.fullName() + ' ' + name).trim();
    this._skipped = false;
    this._expectation = TestExpectation.Ok;
    this._body = callback;
    this._location = location;
    this._timeout = 100000000;
    this._environments = [];
    this.Expectations = { ...TestExpectation };
  }

  titles() {
    if (!this._name)
      return this._suite.titles();
    return [...this._suite.titles(), this._name];
  }

  suite() {
    return this._suite;
  }

  name() {
    return this._name;
  }

  fullName() {
    return this._fullName;
  }

  location() {
    return this._location;
  }

  body() {
    return this._body;
  }

  skipped() {
    return this._skipped;
  }

  setSkipped(skipped) {
    this._skipped = skipped;
    return this;
  }

  timeout() {
    return this._timeout;
  }

  setTimeout(timeout) {
    this._timeout = timeout;
    return this;
  }

  expectation() {
    return this._expectation;
  }

  setExpectation(expectation) {
    this._expectation = expectation;
    return this;
  }

  addEnvironment(environment) {
    this._environments.push(environment);
    return this;
  }

  removeEnvironment(environment) {
    const index = this._environments.indexOf(environment);
    if (index === -1)
      throw new Error(`Environment "${environment.name()}" cannot be removed because it was not added to the suite "${this.fullName()}"`);
    this._environments.splice(index, 1);
    return this;
  }
}

class Suite {
  constructor(parentSuite, name, location) {
    this._parentSuite = parentSuite;
    this._name = name;
    const fullName = (parentSuite ? parentSuite.fullName() + ' ' + name : name).trim();
    this._fullName = fullName;
    this._location = location;
    this._skipped = false;
    this._expectation = TestExpectation.Ok;

    this._defaultEnvironment = {
      name() { return fullName; },
    };

    this._environments = [this._defaultEnvironment];
    this.Expectations = { ...TestExpectation };
  }

  _addHook(name, callback) {
    if (this._defaultEnvironment[name])
      throw new Error(`ERROR: cannot re-assign hook "${name}" for suite "${this._fullName}"`);
    this._defaultEnvironment[name] = callback;
  }

  beforeEach(callback) { this._addHook('beforeEach', callback); }
  afterEach(callback) { this._addHook('afterEach', callback); }
  beforeAll(callback) { this._addHook('beforeAll', callback); }
  afterAll(callback) { this._addHook('afterAll', callback); }
  globalSetup(callback) { this._addHook('globalSetup', callback); }
  globalTeardown(callback) { this._addHook('globalTeardown', callback); }

  titles() {
    if (!this._parentSuite)
      return this._name ? [this._name] : [];
    return this._name ? [...this._parentSuite.titles(), this._name] : this._parentSuite.titles();
  }

  parentSuite() { return this._parentSuite; }

  name() { return this._name; }

  fullName() { return this._fullName; }

  skipped() { return this._skipped; }

  setSkipped(skipped) {
    this._skipped = skipped;
    return this;
  }

  location() { return this._location; }

  expectation() { return this._expectation; }

  setExpectation(expectation) {
    this._expectation = expectation;
    return this;
  }

  addEnvironment(environment) {
    this._environments.push(environment);
    return this;
  }

  removeEnvironment(environment) {
    const index = this._environments.indexOf(environment);
    if (index === -1)
      throw new Error(`Environment "${environment.name()}" cannot be removed because it was not added to the suite "${this.fullName()}"`);
    this._environments.splice(index, 1);
    return this;
  }
}

module.exports = { TestExpectation, Test, Suite };
