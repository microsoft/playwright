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

const TestRunner  = require('../../../testrunner/');
const runner = new TestRunner();

const {describe, xdescribe, fdescribe} = runner.api();
const {it, fit, xit} = runner.api();
const {beforeAll, beforeEach, afterAll, afterEach} = runner.api();
const {expect} = runner.api();

let browser;
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
  it('check-nullish', testLint);
  it('js-builder-common', testJSBuilder);
  it('js-builder-inheritance', testJSBuilder);
  it('md-builder-common', testMDBuilder);
  it('md-builder-comments', testMDBuilder);
});

runner.run();

async function testLint(state, testRun) {
  const dirPath = path.join(__dirname, testRun.test().name());
  const mdSources = await Source.readdir(dirPath, '.md');
  const tsSources = await Source.readdir(dirPath, '.ts');
  const jsSources = await Source.readdir(dirPath, '.js');
  const messages = await checkPublicAPI(page, mdSources, jsSources.concat(tsSources));
  const errors = messages.map(message => message.text);
  expect(errors.join('\n')).toBeGolden({goldenPath: dirPath, outputPath: dirPath, goldenName: 'result.txt'});
}

async function testMDBuilder(state, testRun) {
  const dirPath = path.join(__dirname, testRun.test().name());
  const sources = await Source.readdir(dirPath, '.md');
  const {documentation} = await mdBuilder(page, sources);
  expect(serialize(documentation)).toBeGolden({goldenPath: dirPath, outputPath: dirPath, goldenName: 'result.txt'});
}

async function testJSBuilder(state, testRun) {
  const dirPath = path.join(__dirname, testRun.test().name());
  const jsSources = await Source.readdir(dirPath, '.js');
  const tsSources = await Source.readdir(dirPath, '.ts');
  const {documentation} = await jsBuilder.checkSources(jsSources.concat(tsSources));
  expect(serialize(documentation)).toBeGolden({goldenPath: dirPath, outputPath: dirPath, goldenName: 'result.txt'});
}

/**
 * @param {import('../Documentation')} doc
 */
function serialize(doc) {
  const result = {
    classes: doc.classesArray.map(cls => ({
      name: cls.name,
      comment: cls.comment || undefined,
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
    comment: member.comment || undefined,
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