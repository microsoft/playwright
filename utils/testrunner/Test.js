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

function createHook(callback, name) {
  const location = Location.getCallerLocation();
  return { name, body: callback, location };
}

class Environment {
  constructor(name, parentEnvironment = null) {
    this._parentEnvironment = parentEnvironment;
    this._name = name;
    this._hooks = [];
  }

  parentEnvironment() {
    return this._parentEnvironment;
  }

  name() {
    return this._name;
  }

  beforeEach(callback) {
    this._hooks.push(createHook(callback, 'beforeEach'));
    return this;
  }

  afterEach(callback) {
    this._hooks.push(createHook(callback, 'afterEach'));
    return this;
  }

  beforeAll(callback) {
    this._hooks.push(createHook(callback, 'beforeAll'));
    return this;
  }

  afterAll(callback) {
    this._hooks.push(createHook(callback, 'afterAll'));
    return this;
  }

  hooks(name) {
    return this._hooks.filter(hook => !name || hook.name === name);
  }

  isEmpty() {
    return !this._hooks.length;
  }
}

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
    this._defaultEnvironment = new Environment(this._fullName);
    this._environments = [this._defaultEnvironment];
    this.Expectations = { ...TestExpectation };
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

  environment() {
    return this._defaultEnvironment;
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
    this._fullName = (parentSuite ? parentSuite.fullName() + ' ' + name : name).trim();
    this._location = location;
    this._skipped = false;
    this._expectation = TestExpectation.Ok;
    this._defaultEnvironment = new Environment(this._fullName);
    this._environments = [this._defaultEnvironment];
    this.Expectations = { ...TestExpectation };
  }

  parentSuite() {
    return this._parentSuite;
  }

  name() {
    return this._name;
  }

  fullName() {
    return this._fullName;
  }

  skipped() {
    return this._skipped;
  }

  setSkipped(skipped) {
    this._skipped = skipped;
    return this;
  }

  location() {
    return this._location;
  }

  expectation() {
    return this._expectation;
  }

  setExpectation(expectation) {
    this._expectation = expectation;
    return this;
  }

  environment() {
    return this._defaultEnvironment;
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

module.exports = { TestExpectation, Environment, Test, Suite };
