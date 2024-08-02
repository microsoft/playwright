"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PythonLocatorFactory = exports.JsonlLocatorFactory = exports.JavaScriptLocatorFactory = exports.JavaLocatorFactory = exports.CSharpLocatorFactory = void 0;
exports.asLocator = asLocator;
exports.asLocators = asLocators;
var _stringUtils = require("./stringUtils");
var _selectorParser = require("./selectorParser");
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

function asLocator(lang, selector, isFrameLocator = false) {
  return asLocators(lang, selector, isFrameLocator)[0];
}
function asLocators(lang, selector, isFrameLocator = false, maxOutputSize = 20, preferredQuote) {
  try {
    return innerAsLocators(new generators[lang](preferredQuote), (0, _selectorParser.parseSelector)(selector), isFrameLocator, maxOutputSize);
  } catch (e) {
    // Tolerate invalid input.
    return [selector];
  }
}
function innerAsLocators(factory, parsed, isFrameLocator = false, maxOutputSize = 20) {
  const parts = [...parsed.parts];
  // frameLocator('iframe').first is actually "iframe >> nth=0 >> internal:control=enter-frame"
  // To make it easier to parse, we turn it into "iframe >> internal:control=enter-frame >> nth=0"
  for (let index = 0; index < parts.length - 1; index++) {
    if (parts[index].name === 'nth' && parts[index + 1].name === 'internal:control' && parts[index + 1].body === 'enter-frame') {
      // Swap nth and enter-frame.
      const [nth] = parts.splice(index, 1);
      parts.splice(index + 1, 0, nth);
    }
  }
  const tokens = [];
  let nextBase = isFrameLocator ? 'frame-locator' : 'page';
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const base = nextBase;
    nextBase = 'locator';
    if (part.name === 'nth') {
      if (part.body === '0') tokens.push([factory.generateLocator(base, 'first', ''), factory.generateLocator(base, 'nth', '0')]);else if (part.body === '-1') tokens.push([factory.generateLocator(base, 'last', ''), factory.generateLocator(base, 'nth', '-1')]);else tokens.push([factory.generateLocator(base, 'nth', part.body)]);
      continue;
    }
    if (part.name === 'internal:text') {
      const {
        exact,
        text
      } = detectExact(part.body);
      tokens.push([factory.generateLocator(base, 'text', text, {
        exact
      })]);
      continue;
    }
    if (part.name === 'internal:has-text') {
      const {
        exact,
        text
      } = detectExact(part.body);
      // There is no locator equivalent for strict has-text, leave it as is.
      if (!exact) {
        tokens.push([factory.generateLocator(base, 'has-text', text, {
          exact
        })]);
        continue;
      }
    }
    if (part.name === 'internal:has-not-text') {
      const {
        exact,
        text
      } = detectExact(part.body);
      // There is no locator equivalent for strict has-not-text, leave it as is.
      if (!exact) {
        tokens.push([factory.generateLocator(base, 'has-not-text', text, {
          exact
        })]);
        continue;
      }
    }
    if (part.name === 'internal:has') {
      const inners = innerAsLocators(factory, part.body.parsed, false, maxOutputSize);
      tokens.push(inners.map(inner => factory.generateLocator(base, 'has', inner)));
      continue;
    }
    if (part.name === 'internal:has-not') {
      const inners = innerAsLocators(factory, part.body.parsed, false, maxOutputSize);
      tokens.push(inners.map(inner => factory.generateLocator(base, 'hasNot', inner)));
      continue;
    }
    if (part.name === 'internal:and') {
      const inners = innerAsLocators(factory, part.body.parsed, false, maxOutputSize);
      tokens.push(inners.map(inner => factory.generateLocator(base, 'and', inner)));
      continue;
    }
    if (part.name === 'internal:or') {
      const inners = innerAsLocators(factory, part.body.parsed, false, maxOutputSize);
      tokens.push(inners.map(inner => factory.generateLocator(base, 'or', inner)));
      continue;
    }
    if (part.name === 'internal:chain') {
      const inners = innerAsLocators(factory, part.body.parsed, false, maxOutputSize);
      tokens.push(inners.map(inner => factory.generateLocator(base, 'chain', inner)));
      continue;
    }
    if (part.name === 'internal:label') {
      const {
        exact,
        text
      } = detectExact(part.body);
      tokens.push([factory.generateLocator(base, 'label', text, {
        exact
      })]);
      continue;
    }
    if (part.name === 'internal:role') {
      const attrSelector = (0, _selectorParser.parseAttributeSelector)(part.body, true);
      const options = {
        attrs: []
      };
      for (const attr of attrSelector.attributes) {
        if (attr.name === 'name') {
          options.exact = attr.caseSensitive;
          options.name = attr.value;
        } else {
          if (attr.name === 'level' && typeof attr.value === 'string') attr.value = +attr.value;
          options.attrs.push({
            name: attr.name === 'include-hidden' ? 'includeHidden' : attr.name,
            value: attr.value
          });
        }
      }
      tokens.push([factory.generateLocator(base, 'role', attrSelector.name, options)]);
      continue;
    }
    if (part.name === 'internal:testid') {
      const attrSelector = (0, _selectorParser.parseAttributeSelector)(part.body, true);
      const {
        value
      } = attrSelector.attributes[0];
      tokens.push([factory.generateLocator(base, 'test-id', value)]);
      continue;
    }
    if (part.name === 'internal:attr') {
      const attrSelector = (0, _selectorParser.parseAttributeSelector)(part.body, true);
      const {
        name,
        value,
        caseSensitive
      } = attrSelector.attributes[0];
      const text = value;
      const exact = !!caseSensitive;
      if (name === 'placeholder') {
        tokens.push([factory.generateLocator(base, 'placeholder', text, {
          exact
        })]);
        continue;
      }
      if (name === 'alt') {
        tokens.push([factory.generateLocator(base, 'alt', text, {
          exact
        })]);
        continue;
      }
      if (name === 'title') {
        tokens.push([factory.generateLocator(base, 'title', text, {
          exact
        })]);
        continue;
      }
    }
    let locatorType = 'default';
    const nextPart = parts[index + 1];
    if (nextPart && nextPart.name === 'internal:control' && nextPart.body === 'enter-frame') {
      locatorType = 'frame';
      nextBase = 'frame-locator';
      index++;
    }
    const selectorPart = (0, _selectorParser.stringifySelector)({
      parts: [part]
    });
    const locatorPart = factory.generateLocator(base, locatorType, selectorPart);
    if (locatorType === 'default' && nextPart && ['internal:has-text', 'internal:has-not-text'].includes(nextPart.name)) {
      const {
        exact,
        text
      } = detectExact(nextPart.body);
      // There is no locator equivalent for strict has-text and has-not-text, leave it as is.
      if (!exact) {
        const nextLocatorPart = factory.generateLocator('locator', nextPart.name === 'internal:has-text' ? 'has-text' : 'has-not-text', text, {
          exact
        });
        const options = {};
        if (nextPart.name === 'internal:has-text') options.hasText = text;else options.hasNotText = text;
        const combinedPart = factory.generateLocator(base, 'default', selectorPart, options);
        // Two options:
        // - locator('div').filter({ hasText: 'foo' })
        // - locator('div', { hasText: 'foo' })
        tokens.push([factory.chainLocators([locatorPart, nextLocatorPart]), combinedPart]);
        index++;
        continue;
      }
    }

    // Selectors can be prefixed with engine name, e.g. xpath=//foo
    let locatorPartWithEngine;
    if (['xpath', 'css'].includes(part.name)) {
      const selectorPart = (0, _selectorParser.stringifySelector)({
        parts: [part]
      }, /* forceEngineName */true);
      locatorPartWithEngine = factory.generateLocator(base, locatorType, selectorPart);
    }
    tokens.push([locatorPart, locatorPartWithEngine].filter(Boolean));
  }
  return combineTokens(factory, tokens, maxOutputSize);
}
function combineTokens(factory, tokens, maxOutputSize) {
  const currentTokens = tokens.map(() => '');
  const result = [];
  const visit = index => {
    if (index === tokens.length) {
      result.push(factory.chainLocators(currentTokens));
      return currentTokens.length < maxOutputSize;
    }
    for (const taken of tokens[index]) {
      currentTokens[index] = taken;
      if (!visit(index + 1)) return false;
    }
    return true;
  };
  visit(0);
  return result;
}
function detectExact(text) {
  let exact = false;
  const match = text.match(/^\/(.*)\/([igm]*)$/);
  if (match) return {
    text: new RegExp(match[1], match[2])
  };
  if (text.endsWith('"')) {
    text = JSON.parse(text);
    exact = true;
  } else if (text.endsWith('"s')) {
    text = JSON.parse(text.substring(0, text.length - 1));
    exact = true;
  } else if (text.endsWith('"i')) {
    text = JSON.parse(text.substring(0, text.length - 1));
    exact = false;
  }
  return {
    exact,
    text
  };
}
class JavaScriptLocatorFactory {
  constructor(preferredQuote) {
    this.preferredQuote = preferredQuote;
  }
  generateLocator(base, kind, body, options = {}) {
    switch (kind) {
      case 'default':
        if (options.hasText !== undefined) return `locator(${this.quote(body)}, { hasText: ${this.toHasText(options.hasText)} })`;
        if (options.hasNotText !== undefined) return `locator(${this.quote(body)}, { hasNotText: ${this.toHasText(options.hasNotText)} })`;
        return `locator(${this.quote(body)})`;
      case 'frame':
        return `frameLocator(${this.quote(body)})`;
      case 'nth':
        return `nth(${body})`;
      case 'first':
        return `first()`;
      case 'last':
        return `last()`;
      case 'role':
        const attrs = [];
        if (isRegExp(options.name)) {
          attrs.push(`name: ${this.regexToSourceString(options.name)}`);
        } else if (typeof options.name === 'string') {
          attrs.push(`name: ${this.quote(options.name)}`);
          if (options.exact) attrs.push(`exact: true`);
        }
        for (const {
          name,
          value
        } of options.attrs) attrs.push(`${name}: ${typeof value === 'string' ? this.quote(value) : value}`);
        const attrString = attrs.length ? `, { ${attrs.join(', ')} }` : '';
        return `getByRole(${this.quote(body)}${attrString})`;
      case 'has-text':
        return `filter({ hasText: ${this.toHasText(body)} })`;
      case 'has-not-text':
        return `filter({ hasNotText: ${this.toHasText(body)} })`;
      case 'has':
        return `filter({ has: ${body} })`;
      case 'hasNot':
        return `filter({ hasNot: ${body} })`;
      case 'and':
        return `and(${body})`;
      case 'or':
        return `or(${body})`;
      case 'chain':
        return `locator(${body})`;
      case 'test-id':
        return `getByTestId(${this.toTestIdValue(body)})`;
      case 'text':
        return this.toCallWithExact('getByText', body, !!options.exact);
      case 'alt':
        return this.toCallWithExact('getByAltText', body, !!options.exact);
      case 'placeholder':
        return this.toCallWithExact('getByPlaceholder', body, !!options.exact);
      case 'label':
        return this.toCallWithExact('getByLabel', body, !!options.exact);
      case 'title':
        return this.toCallWithExact('getByTitle', body, !!options.exact);
      default:
        throw new Error('Unknown selector kind ' + kind);
    }
  }
  chainLocators(locators) {
    return locators.join('.');
  }
  regexToSourceString(re) {
    return (0, _stringUtils.normalizeEscapedRegexQuotes)(String(re));
  }
  toCallWithExact(method, body, exact) {
    if (isRegExp(body)) return `${method}(${this.regexToSourceString(body)})`;
    return exact ? `${method}(${this.quote(body)}, { exact: true })` : `${method}(${this.quote(body)})`;
  }
  toHasText(body) {
    if (isRegExp(body)) return this.regexToSourceString(body);
    return this.quote(body);
  }
  toTestIdValue(value) {
    if (isRegExp(value)) return this.regexToSourceString(value);
    return this.quote(value);
  }
  quote(text) {
    var _this$preferredQuote;
    return (0, _stringUtils.escapeWithQuotes)(text, (_this$preferredQuote = this.preferredQuote) !== null && _this$preferredQuote !== void 0 ? _this$preferredQuote : '\'');
  }
}
exports.JavaScriptLocatorFactory = JavaScriptLocatorFactory;
class PythonLocatorFactory {
  generateLocator(base, kind, body, options = {}) {
    switch (kind) {
      case 'default':
        if (options.hasText !== undefined) return `locator(${this.quote(body)}, has_text=${this.toHasText(options.hasText)})`;
        if (options.hasNotText !== undefined) return `locator(${this.quote(body)}, has_not_text=${this.toHasText(options.hasNotText)})`;
        return `locator(${this.quote(body)})`;
      case 'frame':
        return `frame_locator(${this.quote(body)})`;
      case 'nth':
        return `nth(${body})`;
      case 'first':
        return `first`;
      case 'last':
        return `last`;
      case 'role':
        const attrs = [];
        if (isRegExp(options.name)) {
          attrs.push(`name=${this.regexToString(options.name)}`);
        } else if (typeof options.name === 'string') {
          attrs.push(`name=${this.quote(options.name)}`);
          if (options.exact) attrs.push(`exact=True`);
        }
        for (const {
          name,
          value
        } of options.attrs) {
          let valueString = typeof value === 'string' ? this.quote(value) : value;
          if (typeof value === 'boolean') valueString = value ? 'True' : 'False';
          attrs.push(`${(0, _stringUtils.toSnakeCase)(name)}=${valueString}`);
        }
        const attrString = attrs.length ? `, ${attrs.join(', ')}` : '';
        return `get_by_role(${this.quote(body)}${attrString})`;
      case 'has-text':
        return `filter(has_text=${this.toHasText(body)})`;
      case 'has-not-text':
        return `filter(has_not_text=${this.toHasText(body)})`;
      case 'has':
        return `filter(has=${body})`;
      case 'hasNot':
        return `filter(has_not=${body})`;
      case 'and':
        return `and_(${body})`;
      case 'or':
        return `or_(${body})`;
      case 'chain':
        return `locator(${body})`;
      case 'test-id':
        return `get_by_test_id(${this.toTestIdValue(body)})`;
      case 'text':
        return this.toCallWithExact('get_by_text', body, !!options.exact);
      case 'alt':
        return this.toCallWithExact('get_by_alt_text', body, !!options.exact);
      case 'placeholder':
        return this.toCallWithExact('get_by_placeholder', body, !!options.exact);
      case 'label':
        return this.toCallWithExact('get_by_label', body, !!options.exact);
      case 'title':
        return this.toCallWithExact('get_by_title', body, !!options.exact);
      default:
        throw new Error('Unknown selector kind ' + kind);
    }
  }
  chainLocators(locators) {
    return locators.join('.');
  }
  regexToString(body) {
    const suffix = body.flags.includes('i') ? ', re.IGNORECASE' : '';
    return `re.compile(r"${(0, _stringUtils.normalizeEscapedRegexQuotes)(body.source).replace(/\\\//, '/').replace(/"/g, '\\"')}"${suffix})`;
  }
  toCallWithExact(method, body, exact) {
    if (isRegExp(body)) return `${method}(${this.regexToString(body)})`;
    if (exact) return `${method}(${this.quote(body)}, exact=True)`;
    return `${method}(${this.quote(body)})`;
  }
  toHasText(body) {
    if (isRegExp(body)) return this.regexToString(body);
    return `${this.quote(body)}`;
  }
  toTestIdValue(value) {
    if (isRegExp(value)) return this.regexToString(value);
    return this.quote(value);
  }
  quote(text) {
    return (0, _stringUtils.escapeWithQuotes)(text, '\"');
  }
}
exports.PythonLocatorFactory = PythonLocatorFactory;
class JavaLocatorFactory {
  generateLocator(base, kind, body, options = {}) {
    let clazz;
    switch (base) {
      case 'page':
        clazz = 'Page';
        break;
      case 'frame-locator':
        clazz = 'FrameLocator';
        break;
      case 'locator':
        clazz = 'Locator';
        break;
    }
    switch (kind) {
      case 'default':
        if (options.hasText !== undefined) return `locator(${this.quote(body)}, new ${clazz}.LocatorOptions().setHasText(${this.toHasText(options.hasText)}))`;
        if (options.hasNotText !== undefined) return `locator(${this.quote(body)}, new ${clazz}.LocatorOptions().setHasNotText(${this.toHasText(options.hasNotText)}))`;
        return `locator(${this.quote(body)})`;
      case 'frame':
        return `frameLocator(${this.quote(body)})`;
      case 'nth':
        return `nth(${body})`;
      case 'first':
        return `first()`;
      case 'last':
        return `last()`;
      case 'role':
        const attrs = [];
        if (isRegExp(options.name)) {
          attrs.push(`.setName(${this.regexToString(options.name)})`);
        } else if (typeof options.name === 'string') {
          attrs.push(`.setName(${this.quote(options.name)})`);
          if (options.exact) attrs.push(`.setExact(true)`);
        }
        for (const {
          name,
          value
        } of options.attrs) attrs.push(`.set${(0, _stringUtils.toTitleCase)(name)}(${typeof value === 'string' ? this.quote(value) : value})`);
        const attrString = attrs.length ? `, new ${clazz}.GetByRoleOptions()${attrs.join('')}` : '';
        return `getByRole(AriaRole.${(0, _stringUtils.toSnakeCase)(body).toUpperCase()}${attrString})`;
      case 'has-text':
        return `filter(new ${clazz}.FilterOptions().setHasText(${this.toHasText(body)}))`;
      case 'has-not-text':
        return `filter(new ${clazz}.FilterOptions().setHasNotText(${this.toHasText(body)}))`;
      case 'has':
        return `filter(new ${clazz}.FilterOptions().setHas(${body}))`;
      case 'hasNot':
        return `filter(new ${clazz}.FilterOptions().setHasNot(${body}))`;
      case 'and':
        return `and(${body})`;
      case 'or':
        return `or(${body})`;
      case 'chain':
        return `locator(${body})`;
      case 'test-id':
        return `getByTestId(${this.toTestIdValue(body)})`;
      case 'text':
        return this.toCallWithExact(clazz, 'getByText', body, !!options.exact);
      case 'alt':
        return this.toCallWithExact(clazz, 'getByAltText', body, !!options.exact);
      case 'placeholder':
        return this.toCallWithExact(clazz, 'getByPlaceholder', body, !!options.exact);
      case 'label':
        return this.toCallWithExact(clazz, 'getByLabel', body, !!options.exact);
      case 'title':
        return this.toCallWithExact(clazz, 'getByTitle', body, !!options.exact);
      default:
        throw new Error('Unknown selector kind ' + kind);
    }
  }
  chainLocators(locators) {
    return locators.join('.');
  }
  regexToString(body) {
    const suffix = body.flags.includes('i') ? ', Pattern.CASE_INSENSITIVE' : '';
    return `Pattern.compile(${this.quote((0, _stringUtils.normalizeEscapedRegexQuotes)(body.source))}${suffix})`;
  }
  toCallWithExact(clazz, method, body, exact) {
    if (isRegExp(body)) return `${method}(${this.regexToString(body)})`;
    if (exact) return `${method}(${this.quote(body)}, new ${clazz}.${(0, _stringUtils.toTitleCase)(method)}Options().setExact(true))`;
    return `${method}(${this.quote(body)})`;
  }
  toHasText(body) {
    if (isRegExp(body)) return this.regexToString(body);
    return this.quote(body);
  }
  toTestIdValue(value) {
    if (isRegExp(value)) return this.regexToString(value);
    return this.quote(value);
  }
  quote(text) {
    return (0, _stringUtils.escapeWithQuotes)(text, '\"');
  }
}
exports.JavaLocatorFactory = JavaLocatorFactory;
class CSharpLocatorFactory {
  generateLocator(base, kind, body, options = {}) {
    switch (kind) {
      case 'default':
        if (options.hasText !== undefined) return `Locator(${this.quote(body)}, new() { ${this.toHasText(options.hasText)} })`;
        if (options.hasNotText !== undefined) return `Locator(${this.quote(body)}, new() { ${this.toHasNotText(options.hasNotText)} })`;
        return `Locator(${this.quote(body)})`;
      case 'frame':
        return `FrameLocator(${this.quote(body)})`;
      case 'nth':
        return `Nth(${body})`;
      case 'first':
        return `First`;
      case 'last':
        return `Last`;
      case 'role':
        const attrs = [];
        if (isRegExp(options.name)) {
          attrs.push(`NameRegex = ${this.regexToString(options.name)}`);
        } else if (typeof options.name === 'string') {
          attrs.push(`Name = ${this.quote(options.name)}`);
          if (options.exact) attrs.push(`Exact = true`);
        }
        for (const {
          name,
          value
        } of options.attrs) attrs.push(`${(0, _stringUtils.toTitleCase)(name)} = ${typeof value === 'string' ? this.quote(value) : value}`);
        const attrString = attrs.length ? `, new() { ${attrs.join(', ')} }` : '';
        return `GetByRole(AriaRole.${(0, _stringUtils.toTitleCase)(body)}${attrString})`;
      case 'has-text':
        return `Filter(new() { ${this.toHasText(body)} })`;
      case 'has-not-text':
        return `Filter(new() { ${this.toHasNotText(body)} })`;
      case 'has':
        return `Filter(new() { Has = ${body} })`;
      case 'hasNot':
        return `Filter(new() { HasNot = ${body} })`;
      case 'and':
        return `And(${body})`;
      case 'or':
        return `Or(${body})`;
      case 'chain':
        return `Locator(${body})`;
      case 'test-id':
        return `GetByTestId(${this.toTestIdValue(body)})`;
      case 'text':
        return this.toCallWithExact('GetByText', body, !!options.exact);
      case 'alt':
        return this.toCallWithExact('GetByAltText', body, !!options.exact);
      case 'placeholder':
        return this.toCallWithExact('GetByPlaceholder', body, !!options.exact);
      case 'label':
        return this.toCallWithExact('GetByLabel', body, !!options.exact);
      case 'title':
        return this.toCallWithExact('GetByTitle', body, !!options.exact);
      default:
        throw new Error('Unknown selector kind ' + kind);
    }
  }
  chainLocators(locators) {
    return locators.join('.');
  }
  regexToString(body) {
    const suffix = body.flags.includes('i') ? ', RegexOptions.IgnoreCase' : '';
    return `new Regex(${this.quote((0, _stringUtils.normalizeEscapedRegexQuotes)(body.source))}${suffix})`;
  }
  toCallWithExact(method, body, exact) {
    if (isRegExp(body)) return `${method}(${this.regexToString(body)})`;
    if (exact) return `${method}(${this.quote(body)}, new() { Exact = true })`;
    return `${method}(${this.quote(body)})`;
  }
  toHasText(body) {
    if (isRegExp(body)) return `HasTextRegex = ${this.regexToString(body)}`;
    return `HasText = ${this.quote(body)}`;
  }
  toTestIdValue(value) {
    if (isRegExp(value)) return this.regexToString(value);
    return this.quote(value);
  }
  toHasNotText(body) {
    if (isRegExp(body)) return `HasNotTextRegex = ${this.regexToString(body)}`;
    return `HasNotText = ${this.quote(body)}`;
  }
  quote(text) {
    return (0, _stringUtils.escapeWithQuotes)(text, '\"');
  }
}
exports.CSharpLocatorFactory = CSharpLocatorFactory;
class JsonlLocatorFactory {
  generateLocator(base, kind, body, options = {}) {
    return JSON.stringify({
      kind,
      body,
      options
    });
  }
  chainLocators(locators) {
    const objects = locators.map(l => JSON.parse(l));
    for (let i = 0; i < objects.length - 1; ++i) objects[i].next = objects[i + 1];
    return JSON.stringify(objects[0]);
  }
}
exports.JsonlLocatorFactory = JsonlLocatorFactory;
const generators = {
  javascript: JavaScriptLocatorFactory,
  python: PythonLocatorFactory,
  java: JavaLocatorFactory,
  csharp: CSharpLocatorFactory,
  jsonl: JsonlLocatorFactory
};
function isRegExp(obj) {
  return obj instanceof RegExp;
}