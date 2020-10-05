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

const fs = require('fs');
const path = require('path');
const playwright = require('../../../../');
const checkPublicAPI = require('..');
const Source = require('../../Source');
const mdBuilder = require('../MDBuilder');
const jsBuilder = require('../JSBuilder');
const { fixtures } = require('@playwright/test-runner');
const { defineWorkerFixtures, describe, it, expect } = fixtures;

defineWorkerFixtures({
  page: async({}, test) => {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    await test(page);
    await browser.close();
  }
});

describe('checkPublicAPI', function() {
  testLint('diff-classes');
  testLint('diff-methods');
  testLint('diff-properties');
  testLint('diff-arguments');
  testLint('diff-events');
  testLint('check-duplicates');
  testLint('check-sorting');
  testLint('check-returns');
  testLint('check-nullish');
  testJSBuilder('js-builder-common');
  testJSBuilder('js-builder-inheritance');
  testMDBuilder('md-builder-common');
  testMDBuilder('md-builder-comments');
});

async function testLint(name) {
  it(name, async({page}) => {
    const dirPath = path.join(__dirname, name);
    const mdSources = await Source.readdir(dirPath, '.md');
    const tsSources = await Source.readdir(dirPath, '.ts');
    const jsSources = await Source.readdir(dirPath, '.js');
    const messages = await checkPublicAPI(page, mdSources, jsSources.concat(tsSources));
    const errors = messages.map(message => message.text);
    expect(errors.join('\n')).toBe(fs.readFileSync(path.join(dirPath, 'result.txt')).toString());
  });
}

async function testMDBuilder(name) {
  it(name, async({page}) => {
    const dirPath = path.join(__dirname, name);
    const sources = await Source.readdir(dirPath, '.md');
    const {documentation} = await mdBuilder(page, sources, true);
    expect(serialize(documentation)).toBe(fs.readFileSync(path.join(dirPath, 'result.txt')).toString());
  });
}

async function testJSBuilder(name) {
  it(name, async() => {
    const dirPath = path.join(__dirname, name);
    const jsSources = await Source.readdir(dirPath, '.js');
    const tsSources = await Source.readdir(dirPath, '.ts');
    const {documentation} = await jsBuilder.checkSources(jsSources.concat(tsSources));
    expect(serialize(documentation)).toBe(fs.readFileSync(path.join(dirPath, 'result.txt')).toString());
  });
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
