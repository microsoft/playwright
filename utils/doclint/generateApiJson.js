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

const playwright = require('../..');
const path = require('path');
const Source = require('./Source');
const mdBuilder = require('./check_public_api/MDBuilder');
const PROJECT_DIR = path.join(__dirname, '..', '..');

(async () => {
  const api = await Source.readFile(path.join(PROJECT_DIR, 'docs', 'api.md'));
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const { documentation } = await mdBuilder(page, [api], false);
  const result = serialize(documentation);
  console.log(JSON.stringify(result));
  await browser.close();
})()

function serialize(documentation) {
  const result = {};
  for (const clazz of documentation.classesArray)
    result[clazz.name] = serializeClass(clazz);
  return result;
}

function serializeClass(clazz) {
  const result = { name: clazz.name };
  if (clazz.extends)
    result.extends = clazz.extends;
  result.members = {};
  for (const member of clazz.membersArray)
    result.members[member.name] = serializeMember(member);
  return result;
}

function serializeMember(member) {
  const result = { ...member };
  sanitize(result);
  result.args = {};
  for (const arg of member.argsArray)
    result.args[arg.name] = serializeProperty(arg);
  if (member.type)
    result.type = serializeType(member.type)
  return result;
}

function serializeProperty(arg) {
  const result = { ...arg };
  sanitize(result);
  if (arg.type)
    result.type = serializeType(arg.type)
  return result;
}

function sanitize(result) {
  delete result.args;
  delete result.argsArray;
  delete result.templates;
  if (result.properties && !Object.keys(result.properties).length)
    delete result.properties;
}

function serializeType(type) {
  const result = { ...type };
  if (type.properties && type.properties.length) {
    result.properties = {};
    for (const prop of type.properties)
      result.properties[prop.name] = serializeProperty(prop);
  } else {
    delete result.properties;
  }
  return result;
}
