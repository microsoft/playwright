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

const jsBuilder = require('./JSBuilder');
const mdBuilder = require('./MDBuilder');
const Documentation = require('./Documentation');
const Message = require('../Message');

const EXCLUDE_PROPERTIES = new Set([
  'JSHandle.toString',
]);

/**
 * @param {!Page} page
 * @param {!Array<!Source>} mdSources
 * @return {!Promise<!Array<!Message>>}
 */
module.exports = async function lint(page, mdSources, jsSources) {
  const mdResult = await mdBuilder(page, mdSources, true);
  const jsResult = jsBuilder.checkSources(jsSources);
  const jsDocumentation = filterJSDocumentation(jsSources, jsResult.documentation);
  const mdDocumentation = mdResult.documentation;

  const jsErrors = jsResult.errors;
  jsErrors.push(...checkDuplicates(jsDocumentation));

  const mdErrors = mdResult.errors;
  mdErrors.push(...compareDocumentations(mdDocumentation, jsDocumentation));
  mdErrors.push(...checkDuplicates(mdDocumentation));

  // Push all errors with proper prefixes
  const errors = jsErrors.map(error => '[JavaScript] ' + error);
  errors.push(...mdErrors.map(error => '[MarkDown] ' + error));
  return errors.map(error => Message.error(error));
};

/**
 * @param {!Array<!Source>} jsSources
 * @param {!Documentation} jsDocumentation
 * @return {!Documentation}
 */
function filterJSDocumentation(jsSources, jsDocumentation) {
  // Filter private classes and methods.
  const classes = [];
  for (const cls of jsDocumentation.classesArray) {
    const members = cls.membersArray.filter(member => !EXCLUDE_PROPERTIES.has(`${cls.name}.${member.name}`));
    classes.push(new Documentation.Class(cls.name, members));
  }
  return new Documentation(classes);
}

/**
 * @param {!Documentation} doc
 * @return {!Array<string>}
 */
function checkDuplicates(doc) {
  const errors = [];
  const classes = new Set();
  // Report duplicates.
  for (const cls of doc.classesArray) {
    if (classes.has(cls.name))
      errors.push(`Duplicate declaration of class ${cls.name}`);
    classes.add(cls.name);
    const members = new Set();
    for (const member of cls.membersArray) {
      if (members.has(member.kind + ' ' + member.name))
        errors.push(`Duplicate declaration of ${member.kind} ${cls.name}.${member.name}()`);
      members.add(member.kind + ' ' + member.name);
      const args = new Set();
      for (const arg of member.argsArray) {
        if (args.has(arg.name))
          errors.push(`Duplicate declaration of argument ${cls.name}.${member.name} "${arg.name}"`);
        args.add(arg.name);
      }
    }
  }
  return errors;
}

/**
 * @param {!Documentation} actual
 * @param {!Documentation} expected
 * @return {!Array<string>}
 */
function compareDocumentations(actual, expected) {
  const errors = [];

  const actualClasses = Array.from(actual.classes.keys()).sort();
  const expectedClasses = Array.from(expected.classes.keys()).sort();
  const classesDiff = diff(actualClasses, expectedClasses);
  for (const className of classesDiff.extra)
    errors.push(`Non-existing class found: ${className}`);
  for (const className of classesDiff.missing)
    errors.push(`Class not found: ${className}`);

  for (const className of classesDiff.equal) {
    const actualClass = actual.classes.get(className);
    const expectedClass = expected.classes.get(className);
    const actualMethods = Array.from(actualClass.methods.keys()).sort();
    const expectedMethods = Array.from(expectedClass.methods.keys()).sort();
    const methodDiff = diff(actualMethods, expectedMethods);
    for (const methodName of methodDiff.extra)
      errors.push(`Non-existing method found: ${className}.${methodName}()`);
    for (const methodName of methodDiff.missing)
      errors.push(`Method not found: ${className}.${methodName}()`);

    for (const methodName of methodDiff.equal) {
      const actualMethod = actualClass.methods.get(methodName);
      const expectedMethod = expectedClass.methods.get(methodName);
      if (!actualMethod.type !== !expectedMethod.type) {
        if (actualMethod.type)
          errors.push(`Method ${className}.${methodName} has unneeded description of return type`);
        else
          errors.push(`Method ${className}.${methodName} is missing return type description`);
      } else if (actualMethod.type) {
        checkType(`Method ${className}.${methodName} has the wrong return type: `, actualMethod.type, expectedMethod.type);
      }
      const actualArgs = Array.from(actualMethod.args.keys());
      const expectedArgs = Array.from(expectedMethod.args.keys());
      const argsDiff = diff(actualArgs, expectedArgs);
      if (argsDiff.extra.length || argsDiff.missing.length) {
        const text = [`Method ${className}.${methodName}() fails to describe its parameters:`];
        for (const arg of argsDiff.missing)
          text.push(`- Argument not found: ${arg}`);
        for (const arg of argsDiff.extra)
          text.push(`- Non-existing argument found: ${arg}`);
        errors.push(text.join('\n'));
      }

      for (const arg of argsDiff.equal)
        checkProperty(`Method ${className}.${methodName}()`, actualMethod.args.get(arg), expectedMethod.args.get(arg));
    }
    const actualProperties = Array.from(actualClass.properties.keys()).sort();
    const expectedProperties = Array.from(expectedClass.properties.keys()).sort();
    const propertyDiff = diff(actualProperties, expectedProperties);
    for (const propertyName of propertyDiff.extra)
      errors.push(`Non-existing property found: ${className}.${propertyName}`);
    for (const propertyName of propertyDiff.missing) {
      if (propertyName === 'T')
        continue;
      errors.push(`Property not found: ${className}.${propertyName}`);
    }

    const actualEvents = Array.from(actualClass.events.keys()).sort();
    const expectedEvents = Array.from(expectedClass.events.keys()).sort();
    const eventsDiff = diff(actualEvents, expectedEvents);
    for (const eventName of eventsDiff.extra)
      errors.push(`Non-existing event found in class ${className}: '${eventName}'`);
    for (const eventName of eventsDiff.missing)
      errors.push(`Event not found in class ${className}: '${eventName}'`);
  }


  /**
   * @param {string} source
   * @param {!Documentation.Member} actual
   * @param {!Documentation.Member} expected
   */
  function checkProperty(source, actual, expected) {
    if (actual.required !== expected.required)
      errors.push(`${source}: ${actual.name} should be ${expected.required ? 'required' : 'optional'}`);
    checkType(source + '.' + actual.name, actual.type, expected.type);
  }

  /**
   * @param {string} source
   * @param {!Documentation.Type} actual
   * @param {!Documentation.Type} expected
   */
  function checkType(source, actual, expected) {
    // TODO(@JoelEinbinder): check functions and Serializable
    if (actual.name.includes('unction') || actual.name.includes('Serializable'))
      return;
    if (expected.name === 'T' || expected.name.includes('[T]'))
      return;
    /** @type {Parameters<typeof String.prototype.replace>[]} */
    const mdReplacers = [
      [/\ /g, ''],
      // We shortcut ? to null|
      [/\?/g, 'null|'],
    ];
    const tsReplacers = [
      [/\ /g, ''],
      [/ElementHandle\<Element\>/g, 'ElementHandle'],
      [/ElementHandle\<Node\>/g, 'ElementHandle'],
      [/ElementHandle\<T\>/g, 'ElementHandle'],
      [/Handle\<R\>/g, 'JSHandle'],
      [/JSHandle\<Object\>/g, 'JSHandle'],
      [/object/g, 'Object'],
      [/Promise\<T\>/, 'Promise<Object>']
    ]
    let actualName = actual.name;
    for (const replacer of mdReplacers)
      actualName = actualName.replace(...replacer);
    let expectedName = expected.name;
    for (const replacer of tsReplacers)
      expectedName = expectedName.replace(...replacer);
    if (normalizeType(expectedName) !== normalizeType(actualName))
      errors.push(`${source} ${actualName} != ${expectedName}`);
    if (actual.name === 'boolean' || actual.name === 'string')
      return;
    const actualPropertiesMap = new Map(actual.properties.map(property => [property.name, property]));
    const expectedPropertiesMap = new Map(expected.properties.map(property => [property.name, property]));
    const propertiesDiff = diff(Array.from(actualPropertiesMap.keys()).sort(), Array.from(expectedPropertiesMap.keys()).sort());
    for (const propertyName of propertiesDiff.extra)
      errors.push(`${source} has unexpected property '${propertyName}'`);
    for (const propertyName of propertiesDiff.missing)
      errors.push(`${source} is missing property ${propertyName}`);
    for (const propertyName of propertiesDiff.equal)
      checkProperty(source, actualPropertiesMap.get(propertyName), expectedPropertiesMap.get(propertyName));
  }

  return errors;
}

/**
 * @param {!Array<string>} actual
 * @param {!Array<string>} expected
 * @return {{extra: !Array<string>, missing: !Array<string>, equal: !Array<string>}}
 */
function diff(actual, expected) {
  const N = actual.length;
  const M = expected.length;
  if (N === 0 && M === 0)
    return { extra: [], missing: [], equal: []};
  if (N === 0)
    return {extra: [], missing: expected.slice(), equal: []};
  if (M === 0)
    return {extra: actual.slice(), missing: [], equal: []};
  const d = new Array(N);
  const bt = new Array(N);
  for (let i = 0; i < N; ++i) {
    d[i] = new Array(M);
    bt[i] = new Array(M);
    for (let j = 0; j < M; ++j) {
      const top = val(i - 1, j);
      const left = val(i, j - 1);
      if (top > left) {
        d[i][j] = top;
        bt[i][j] = 'extra';
      } else {
        d[i][j] = left;
        bt[i][j] = 'missing';
      }
      const diag = val(i - 1, j - 1);
      if (actual[i] === expected[j] && d[i][j] < diag + 1) {
        d[i][j] = diag + 1;
        bt[i][j] = 'eq';
      }
    }
  }
  // Backtrack results.
  let i = N - 1;
  let j = M - 1;
  const missing = [];
  const extra = [];
  const equal = [];
  while (i >= 0 && j >= 0) {
    switch (bt[i][j]) {
      case 'extra':
        extra.push(actual[i]);
        i -= 1;
        break;
      case 'missing':
        missing.push(expected[j]);
        j -= 1;
        break;
      case 'eq':
        equal.push(actual[i]);
        i -= 1;
        j -= 1;
        break;
    }
  }
  while (i >= 0)
    extra.push(actual[i--]);
  while (j >= 0)
    missing.push(expected[j--]);
  extra.reverse();
  missing.reverse();
  equal.reverse();
  return {extra, missing, equal};

  function val(i, j) {
    return i < 0 || j < 0 ? 0 : d[i][j];
  }
}

function normalizeType(type) {
  let nesting = 0;
  const result = [];
  let word = '';
  for (const c of type) {
    if (c === '<') {
      ++nesting;
    } else if (c === '>') {
      --nesting;
    }
    if (c === '|' && !nesting) {
      result.push(word);
      word = '';
    } else {
      word += c;
    }
  }
  result.sort();
  return result.join('|');
}
