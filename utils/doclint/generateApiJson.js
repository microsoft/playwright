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
const Documentation = require('./Documentation');
const { MDOutline } = require('./MDBuilder');
const PROJECT_DIR = path.join(__dirname, '..', '..');

{
  const outline = new MDOutline(path.join(PROJECT_DIR, 'docs', 'src', 'api-body.md'), path.join(PROJECT_DIR, 'docs', 'src', 'api-params.md'));
  outline.setLinkRenderer(item => {
    const { clazz, member, param, option } = item;
    if (param)
      return `\`${param}\``;
    if (option)
      return `\`${option}\``;
    if (clazz)
      return `\`${clazz.name}\``;
  });
  outline.copyDocsFromSuperclasses([]);
  outline.generateSourceCodeComments();
  const result = serialize(outline);
  console.log(JSON.stringify(result));
}

/**
 * @param {Documentation} documentation
 */
function serialize(documentation) {
  return documentation.classesArray.map(serializeClass);
}

/**
 * @param {Documentation.Class} clazz
 */
function serializeClass(clazz) {
  const result = { name: clazz.name };
  if (clazz.extends)
    result.extends = clazz.extends;
  if (clazz.comment)
    result.comment = clazz.comment;
  result.members = clazz.membersArray.map(serializeMember);
  return result;
}

/**
 * @param {Documentation.Member} member
 */
function serializeMember(member) {
  const result = /** @type {any} */ ({ ...member });
  sanitize(result);
  result.args = member.argsArray.map(serializeProperty);
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
  delete result.clazz;
  delete result.spec;
}

/**
 * @param {Documentation.Type} type
 */
function serializeType(type) {
  /** @type {any} */
  const result = { ...type };
  if (type.properties)
    result.properties = type.properties.map(serializeProperty);
  if (type.union)
    result.union = type.union.map(serializeType);
  if (type.templates)
    result.templates = type.templates.map(serializeType);
  if (type.args)
    result.args = type.args.map(serializeType);
  if (type.returnType)
    result.returnType = serializeType(type.returnType);
  return result;
}
