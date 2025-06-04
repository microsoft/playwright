/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const t = {};

t.String = function(x, details = {}, path = ['<root>']) {
  if (typeof x === 'string' || typeof x === 'String')
    return true;
  details.error = `Expected "${path.join('.')}" to be |string|; found |${typeof x}| \`${JSON.stringify(x)}\` instead.`;
  return false;
}

t.Number = function(x, details = {}, path = ['<root>']) {
  if (typeof x === 'number')
    return true;
  details.error = `Expected "${path.join('.')}" to be |number|; found |${typeof x}| \`${JSON.stringify(x)}\` instead.`;
  return false;
}

t.Boolean = function(x, details = {}, path = ['<root>']) {
  if (typeof x === 'boolean')
    return true;
  details.error = `Expected "${path.join('.')}" to be |boolean|; found |${typeof x}| \`${JSON.stringify(x)}\` instead.`;
  return false;
}

t.Null = function(x, details = {}, path = ['<root>']) {
  if (Object.is(x, null))
    return true;
  details.error = `Expected "${path.join('.')}" to be \`null\`; found \`${JSON.stringify(x)}\` instead.`;
  return false;
}

t.Undefined = function(x, details = {}, path = ['<root>']) {
  if (Object.is(x, undefined))
    return true;
  details.error = `Expected "${path.join('.')}" to be \`undefined\`; found \`${JSON.stringify(x)}\` instead.`;
  return false;
}

t.Any = x => true,

t.Enum = function(values) {
  return function(x, details = {}, path = ['<root>']) {
    if (values.indexOf(x) !== -1)
      return true;
    details.error = `Expected "${path.join('.')}" to be one of [${values.join(', ')}]; found \`${JSON.stringify(x)}\` (${typeof x}) instead.`;
    return false;
  }
}

t.Nullable = function(scheme) {
  return function(x, details = {}, path = ['<root>']) {
    if (Object.is(x, null))
      return true;
    return checkScheme(scheme, x, details, path);
  }
}

t.Optional = function(scheme) {
  return function(x, details = {}, path = ['<root>']) {
    if (Object.is(x, undefined))
      return true;
    return checkScheme(scheme, x, details, path);
  }
}

t.Array = function(scheme) {
  return function(x, details = {}, path = ['<root>']) {
    if (!Array.isArray(x)) {
      details.error = `Expected "${path.join('.')}" to be an array; found \`${JSON.stringify(x)}\` (${typeof x}) instead.`;
      return false;
    }
    const lastPathElement = path[path.length - 1];
    for (let i = 0; i < x.length; ++i) {
      path[path.length - 1] = lastPathElement + `[${i}]`;
      if (!checkScheme(scheme, x[i], details, path))
        return false;
    }
    path[path.length - 1] = lastPathElement;
    return true;
  }
}

t.Recursive = function(types, schemeName) {
  return function(x, details = {}, path = ['<root>']) {
    const scheme = types[schemeName];
    return checkScheme(scheme, x, details, path);
  }
}

function beauty(path, obj) {
  if (path.length === 1)
    return `object ${JSON.stringify(obj, null, 2)}`;
  return `property "${path.join('.')}" - ${JSON.stringify(obj, null, 2)}`;
}

export function checkScheme(scheme, x, details = {}, path = ['<root>']) {
  if (!scheme)
    throw new Error(`ILLDEFINED SCHEME: ${path.join('.')}`);
  if (typeof scheme === 'object') {
    if (!x) {
      details.error = `Object "${path.join('.')}" is undefined, but has some scheme`;
      return false;
    }
    for (const [propertyName, aScheme] of Object.entries(scheme)) {
      path.push(propertyName);
      const result = checkScheme(aScheme, x[propertyName], details, path);
      path.pop();
      if (!result)
        return false;
    }
    for (const propertyName of Object.keys(x)) {
      if (!scheme[propertyName]) {
        path.push(propertyName);
        details.error = `Found ${beauty(path, x[propertyName])} which is not described in this scheme`;
        return false;
      }
    }
    return true;
  }
  return scheme(x, details, path);
}

/*

function test(scheme, obj) {
  const details = {};
  if (!checkScheme(scheme, obj, details)) {
    dump(`FAILED: ${JSON.stringify(obj)}
      details.error: ${details.error}
    `);
  } else {
    dump(`SUCCESS: ${JSON.stringify(obj)}
`);
  }
}

test(t.Array(t.String), ['a', 'b', 2, 'c']);
test(t.Either(t.String, t.Number), {});

*/

