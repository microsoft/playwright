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

// @ts-check

const path = require('path');
const { parseApi } = require('./api_parser');
const PROJECT_DIR = path.join(__dirname, '..', '..');

{
  const documentation = parseApi(path.join(PROJECT_DIR, 'docs', 'src', 'api'));
  documentation.setLinkRenderer(item => {
    const { clazz, param, option } = item;
    if (param)
      return `\`${param}\``;
    if (option)
      return `\`${option}\``;
    if (clazz)
      return `\`${clazz.name}\``;
  });
  documentation.generateSourceCodeComments();
  const result = serialize(documentation);
  console.log(JSON.stringify(result));
}

/**
 * @param {import('./documentation').Documentation} documentation
 */
function serialize(documentation) {
  return documentation.classesArray.map(serializeClass);
}

/**
 * @param {import('./documentation').Class} clazz
 */
function serializeClass(clazz) {
  const result = { name: clazz.name, spec: clazz.spec };
  if (clazz.extends)
    result.extends = clazz.extends;
  result.langs = clazz.langs;
  if (result.langs && result.langs.types) {
    for (const key in result.langs.types)
      result.langs.types[key] = serializeType(result.langs.types[key]);
  }
  if (clazz.comment)
    result.comment = clazz.comment;
  if (clazz.since)
    result.since = clazz.since;
  result.members = clazz.membersArray.map(serializeMember);
  return result;
}

/**
 * @param {import('./documentation').Member} member
 */
function serializeMember(member) {
  const result = /** @type {any} */ ({ ...member });
  sanitize(result);
  result.args = member.argsArray.map(serializeProperty);
  if (member.type)
    result.type = serializeType(member.type);
  return result;
}

/**
 * @param {import('./documentation').Member} arg
 */
function serializeProperty(arg) {
  const result = { ...arg, parent: undefined };
  sanitize(result);
  if (arg.type)
    result.type = serializeType(arg.type);
  return result;
}

/**
 * @param {object} result
 */
function sanitize(result) {
  delete result.args;
  delete result.argsArray;
  delete result.clazz;
  delete result.enclosingMethod;
}

/**
 * @param {import('./documentation').Type} type
 */
function serializeType(type) {
  /** @type {any} */
  const result = { ...type };
  if (type.properties)
    result.properties = type.properties.map(serializeProperty);
  if (type.union)
    result.union = type.union.map(type => serializeType(type));
  if (type.templates)
    result.templates = type.templates.map(type => serializeType(type));
  if (type.args)
    result.args = type.args.map(type => serializeType(type));
  if (type.returnType)
    result.returnType = serializeType(type.returnType);
  return result;
}
