/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const path = require('path');
const playwright = require('../../../..');
const checkPublicAPI = require('..');
const Source = require('../../Source');
const mdBuilder = require('../MDBuilder');
const jsBuilder = require('../JSBuilder');
const GoldenUtils = require('../../../../test/golden-utils');

const {TestRunner, Reporter, Matchers}  = require('../../../testrunner/');
const runner = new TestRunner();
const reporter = new Reporter(runner);

const {describe, xdescribe, fdescribe} = runner;
const {it, fit, xit} = runner;
const {beforeAll, beforeEach, afterAll, afterEach} = runner;

let browserContext;
let page;

beforeAll(async function() {
  browser = await playwright.chromium.launch();
  page = await browser.newPage();
});

afterAll(async function() {
  await browser.close();
});

describe('checkPublicAPI', function() {
  it('diff-classes', testLint);
  it('diff-methods', testLint);
  it('diff-properties', testLint);
  it('diff-arguments', testLint);
  it('diff-events', testLint);
  it('check-duplicates', testLint);
  it('check-sorting', testLint);
  it('check-returns', testLint);
  it('js-builder-common', testJSBuilder);
  it('js-builder-inheritance', testJSBuilder);
  it('md-builder-common', testMDBuilder);
});

runner.run();

async function testLint(state, test) {
  const dirPath = path.join(__dirname, test.name);
  const {expect} = new Matchers({
    toBeGolden: GoldenUtils.compare.bind(null, dirPath, dirPath)
  });

  const mdSources = await Source.readdir(dirPath, '.md');
  const tsSources = await Source.readdir(dirPath, '.ts');
  const jsSources = await Source.readdir(dirPath, '.js');
  const messages = await checkPublicAPI(page, mdSources, jsSources.concat(tsSources));
  const errors = messages.map(message => message.text);
  expect(errors.join('\n')).toBeGolden('result.txt');
}

async function testMDBuilder(state, test) {
  const dirPath = path.join(__dirname, test.name);
  const {expect} = new Matchers({
    toBeGolden: GoldenUtils.compare.bind(null, dirPath, dirPath)
  });
  const sources = await Source.readdir(dirPath, '.md');
  const {documentation} = await mdBuilder(page, sources);
  expect(serialize(documentation)).toBeGolden('result.txt');
}

async function testJSBuilder(state, test) {
  const dirPath = path.join(__dirname, test.name);
  const {expect} = new Matchers({
    toBeGolden: GoldenUtils.compare.bind(null, dirPath, dirPath)
  });
  const jsSources = await Source.readdir(dirPath, '.js');
  const tsSources = await Source.readdir(dirPath, '.ts');
  const {documentation} = await jsBuilder.checkSources(jsSources.concat(tsSources));
  expect(serialize(documentation)).toBeGolden('result.txt');
}

/**
 * @param {import('../Documentation')} doc
 */
function serialize(doc) {
  const result = {
    classes: doc.classesArray.map(cls => ({
      name: cls.name,
      members: cls.membersArray.map(serializeMember)
    }))
  };
  return JSON.stringify(result, null, 2);
}
/**
 * @param {import('../Documentation').Member} member
 */
function serializeMember(member) {
  return {
    name: member.name,
    type: serializeType(member.type),
    kind: member.kind,
    args: member.argsArray.length ? member.argsArray.map(serializeMember) : undefined
  }
}
/**
 * @param {import('../Documentation').Type} type
 */
function serializeType(type) {
  if (!type)
    return undefined;
  return {
    name: type.name,
    properties: type.properties.length ? type.properties.map(serializeMember) : undefined
  }
}