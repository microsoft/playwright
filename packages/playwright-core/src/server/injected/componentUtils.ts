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

type Operator = '<truthy>'|'='|'*='|'|='|'^='|'$='|'~=';
export type ParsedComponentAttribute = {
  jsonPath: string[],
  op: Operator,
  value: any,
  caseSensitive: boolean,
};

export type ParsedComponentSelector = {
  name: string,
  attributes: ParsedComponentAttribute[],
};

export function checkComponentAttribute(obj: any, attr: ParsedComponentAttribute) {
  for (const token of attr.jsonPath) {
    if (obj !== undefined && obj !== null)
      obj = obj[token];
  }
  return matchesAttribute(obj, attr);
}

export function matchesAttribute(value: any, attr: ParsedComponentAttribute) {
  const objValue = typeof value === 'string' && !attr.caseSensitive ? value.toUpperCase() : value;
  const attrValue = typeof attr.value === 'string' && !attr.caseSensitive ? attr.value.toUpperCase() : attr.value;

  if (attr.op === '<truthy>')
    return !!objValue;
  if (attr.op === '=') {
    if (attrValue instanceof RegExp)
      return typeof objValue === 'string' && !!objValue.match(attrValue);
    return objValue === attrValue;
  }
  if (typeof objValue !== 'string' || typeof attrValue !== 'string')
    return false;
  if (attr.op === '*=')
    return objValue.includes(attrValue);
  if (attr.op === '^=')
    return objValue.startsWith(attrValue);
  if (attr.op === '$=')
    return objValue.endsWith(attrValue);
  if (attr.op === '|=')
    return objValue === attrValue || objValue.startsWith(attrValue + '-');
  if (attr.op === '~=')
    return objValue.split(' ').includes(attrValue);
  return false;
}

export function parseComponentSelector(selector: string): ParsedComponentSelector {
  let wp = 0;
  let EOL = selector.length === 0;

  const next = () => selector[wp] || '';
  const eat1 = () => {
    const result = next();
    ++wp;
    EOL = wp >= selector.length;
    return result;
  };

  const syntaxError = (stage: string|undefined) => {
    if (EOL)
      throw new Error(`Unexpected end of selector while parsing selector \`${selector}\``);
    throw new Error(`Error while parsing selector \`${selector}\` - unexpected symbol "${next()}" at position ${wp}` + (stage ? ' during ' + stage : ''));
  };

  function skipSpaces() {
    while (!EOL && /\s/.test(next()))
      eat1();
  }

  function readIdentifier() {
    let result = '';
    skipSpaces();
    while (!EOL && /[-$0-9A-Z_]/i.test(next()))
      result += eat1();
    return result;
  }

  function readQuotedString(quote: string) {
    let result = eat1();
    if (result !== quote)
      syntaxError('parsing quoted string');
    while (!EOL && next() !== quote) {
      if (next() === '\\')
        eat1();
      result += eat1();
    }
    if (next() !== quote)
      syntaxError('parsing quoted string');
    result += eat1();
    return result;
  }

  function readRegularExpression() {
    if (eat1() !== '/')
      syntaxError('parsing regular expression');
    let source = '';
    let inClass = false;
    // https://262.ecma-international.org/11.0/#sec-literals-regular-expression-literals
    while (!EOL) {
      if (next() === '\\') {
        source += eat1();
        if (EOL)
          syntaxError('parsing regular expressiion');
      } else if (inClass && next() === ']') {
        inClass = false;
      } else if (!inClass && next() === '[') {
        inClass = true;
      } else if (!inClass && next() === '/') {
        break;
      }
      source += eat1();
    }
    if (eat1() !== '/')
      syntaxError('parsing regular expression');
    let flags = '';
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
    while (!EOL && next().match(/[dgimsuy]/))
      flags += eat1();
    try {
      return new RegExp(source, flags);
    } catch (e) {
      throw new Error(`Error while parsing selector \`${selector}\`: ${e.message}`);
    }
  }

  function readAttributeToken() {
    let token = '';
    skipSpaces();
    if (next() === `'` || next() === `"`)
      token = readQuotedString(next()).slice(1, -1);
    else
      token = readIdentifier();
    if (!token)
      syntaxError('parsing property path');
    return token;
  }

  function readOperator(): Operator {
    skipSpaces();
    let op = '';
    if (!EOL)
      op += eat1();
    if (!EOL && (op !== '='))
      op += eat1();
    if (!['=', '*=', '^=', '$=', '|=', '~='].includes(op))
      syntaxError('parsing operator');
    return (op as Operator);
  }

  function readAttribute(): ParsedComponentAttribute {
    // skip leading [
    eat1();

    // read attribute name:
    // foo.bar
    // 'foo'  . "ba zz"
    const jsonPath = [];
    jsonPath.push(readAttributeToken());
    skipSpaces();
    while (next() === '.') {
      eat1();
      jsonPath.push(readAttributeToken());
      skipSpaces();
    }
    // check property is truthy: [enabled]
    if (next() === ']') {
      eat1();
      return { jsonPath, op: '<truthy>', value: null, caseSensitive: false };
    }

    const operator = readOperator();

    let value = undefined;
    let caseSensitive = true;
    skipSpaces();
    if (next() === '/') {
      if (operator !== '=')
        throw new Error(`Error while parsing selector \`${selector}\` - cannot use ${operator} in attribute with regular expression`);
      value = readRegularExpression();
    } else if (next() === `'` || next() === `"`) {
      value = readQuotedString(next()).slice(1, -1);
      skipSpaces();
      if (next() === 'i' || next() === 'I') {
        caseSensitive = false;
        eat1();
      } else if (next() === 's' || next() === 'S') {
        caseSensitive = true;
        eat1();
      }
    } else {
      value = '';
      while (!EOL && !/\s/.test(next()) && next() !== ']')
        value += eat1();
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else {
        value = +value;
        if (isNaN(value))
          syntaxError('parsing attribute value');
      }
    }
    skipSpaces();
    if (next() !== ']')
      syntaxError('parsing attribute value');

    eat1();
    if (operator !== '=' && typeof value !== 'string')
      throw new Error(`Error while parsing selector \`${selector}\` - cannot use ${operator} in attribute with non-string matching value - ${value}`);
    return { jsonPath, op: operator, value, caseSensitive };
  }

  const result: ParsedComponentSelector = {
    name: '',
    attributes: [],
  };
  result.name = readIdentifier();
  skipSpaces();
  while (next() === '[') {
    result.attributes.push(readAttribute());
    skipSpaces();
  }
  if (!EOL)
    syntaxError(undefined);
  if (!result.name && !result.attributes.length)
    throw new Error(`Error while parsing selector \`${selector}\` - selector cannot be empty`);
  return result;
}
