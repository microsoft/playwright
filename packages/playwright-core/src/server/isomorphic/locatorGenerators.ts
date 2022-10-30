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

import { escapeWithQuotes, toSnakeCase, toTitleCase } from '../../utils/isomorphic/stringUtils';
import { parseAttributeSelector, parseSelector, stringifySelector } from '../isomorphic/selectorParser';
import type { ParsedSelector } from '../isomorphic/selectorParser';

export type Language = 'javascript' | 'python' | 'java' | 'csharp';
export type LocatorType = 'default' | 'role' | 'text' | 'label' | 'placeholder' | 'alt' | 'title' | 'test-id' | 'nth' | 'first' | 'last' | 'has-text';
export type LocatorBase = 'page' | 'locator' | 'frame-locator';

export interface LocatorFactory {
  generateLocator(base: LocatorBase, kind: LocatorType, body: string | RegExp, options?: { attrs?: Record<string, string | boolean>, exact?: boolean }): string;
}

export function asLocator(lang: Language, selector: string, isFrameLocator: boolean = false): string {
  return innerAsLocator(generators[lang], selector, isFrameLocator);
}

function innerAsLocator(factory: LocatorFactory, selector: string, isFrameLocator: boolean = false): string {
  const parsed = parseSelector(selector);
  const tokens: string[] = [];
  for (const part of parsed.parts) {
    const base = part === parsed.parts[0] ? (isFrameLocator ? 'frame-locator' : 'page') : 'locator';
    if (part.name === 'nth') {
      if (part.body === '0')
        tokens.push(factory.generateLocator(base, 'first', ''));
      else if (part.body === '-1')
        tokens.push(factory.generateLocator(base, 'last', ''));
      else
        tokens.push(factory.generateLocator(base, 'nth', part.body as string));
      continue;
    }
    if (part.name === 'internal:text') {
      const { exact, text } = detectExact(part.body as string);
      tokens.push(factory.generateLocator(base, 'text', text, { exact }));
      continue;
    }
    if (part.name === 'internal:has-text') {
      const { exact, text } = detectExact(part.body as string);
      tokens.push(factory.generateLocator(base, 'has-text', text, { exact }));
      continue;
    }
    if (part.name === 'internal:label') {
      const { exact, text } = detectExact(part.body as string);
      tokens.push(factory.generateLocator(base, 'label', text, { exact }));
      continue;
    }
    if (part.name === 'internal:role') {
      const attrSelector = parseAttributeSelector(part.body as string, true);
      const attrs: Record<string, boolean | string> = {};
      for (const attr of attrSelector.attributes!)
        attrs[attr.name === 'include-hidden' ? 'includeHidden' : attr.name] = attr.value;
      tokens.push(factory.generateLocator(base, 'role', attrSelector.name, { attrs }));
      continue;
    }
    if (part.name === 'internal:attr') {
      const attrSelector = parseAttributeSelector(part.body as string, true);
      const { name, value, caseSensitive } = attrSelector.attributes[0];
      if (name === 'data-testid') {
        tokens.push(factory.generateLocator(base, 'test-id', value));
        continue;
      }

      const text = value as string | RegExp;
      const exact = !!caseSensitive;
      if (name === 'placeholder') {
        tokens.push(factory.generateLocator(base, 'placeholder', text, { exact }));
        continue;
      }
      if (name === 'alt') {
        tokens.push(factory.generateLocator(base, 'alt', text, { exact }));
        continue;
      }
      if (name === 'title') {
        tokens.push(factory.generateLocator(base, 'title', text, { exact }));
        continue;
      }
    }
    const p: ParsedSelector = { parts: [part] };
    tokens.push(factory.generateLocator(base, 'default', stringifySelector(p)));
  }
  return tokens.join('.');
}

function detectExact(text: string): { exact?: boolean, text: string | RegExp } {
  let exact = false;
  const match = text.match(/^\/(.*)\/([igm]*)$/);
  if (match)
    return { text: new RegExp(match[1], match[2]) };
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
  return { exact, text };
}

export class JavaScriptLocatorFactory implements LocatorFactory {
  generateLocator(base: LocatorBase, kind: LocatorType, body: string | RegExp, options: { attrs?: Record<string, string | boolean>, exact?: boolean } = {}): string {
    switch (kind) {
      case 'default':
        return `locator(${this.quote(body as string)})`;
      case 'nth':
        return `nth(${body})`;
      case 'first':
        return `first()`;
      case 'last':
        return `last()`;
      case 'role':
        const attrs: string[] = [];
        for (const [name, value] of Object.entries(options.attrs!))
          attrs.push(`${name}: ${typeof value === 'string' ? this.quote(value) : value}`);
        const attrString = attrs.length ? `, { ${attrs.join(', ')} }` : '';
        return `getByRole(${this.quote(body as string)}${attrString})`;
      case 'has-text':
        return `filter({ hasText: ${this.toHasText(body as string)} })`;
      case 'test-id':
        return `getByTestId(${this.quote(body as string)})`;
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

  private toCallWithExact(method: string, body: string | RegExp, exact?: boolean) {
    if (isRegExp(body))
      return `${method}(${body})`;
    return exact ? `${method}(${this.quote(body)}, { exact: true })` : `${method}(${this.quote(body)})`;
  }

  private toHasText(body: string | RegExp) {
    if (isRegExp(body))
      return String(body);
    return this.quote(body);
  }

  private quote(text: string) {
    return escapeWithQuotes(text, '\'');
  }
}

export class PythonLocatorFactory implements LocatorFactory {
  generateLocator(base: LocatorBase, kind: LocatorType, body: string | RegExp, options: { attrs?: Record<string, string | boolean>, exact?: boolean } = {}): string {
    switch (kind) {
      case 'default':
        return `locator(${this.quote(body as string)})`;
      case 'nth':
        return `nth(${body})`;
      case 'first':
        return `first`;
      case 'last':
        return `last`;
      case 'role':
        const attrs: string[] = [];
        for (const [name, value] of Object.entries(options.attrs!))
          attrs.push(`${toSnakeCase(name)}=${typeof value === 'string' ? this.quote(value) : value}`);
        const attrString = attrs.length ? `, ${attrs.join(', ')}` : '';
        return `get_by_role(${this.quote(body as string)}${attrString})`;
      case 'has-text':
        return `filter(has_text=${this.toHasText(body as string)})`;
      case 'test-id':
        return `get_by_test_id(${this.quote(body as string)})`;
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

  private toCallWithExact(method: string, body: string | RegExp, exact: boolean) {
    if (isRegExp(body)) {
      const suffix = body.flags.includes('i') ? ', re.IGNORECASE' : '';
      return `${method}(re.compile(r"${body.source.replace(/\\\//, '/').replace(/"/g, '\\"')}"${suffix}))`;
    }
    if (exact)
      return `${method}(${this.quote(body)}, exact=true)`;
    return `${method}(${this.quote(body)})`;
  }

  private toHasText(body: string | RegExp) {
    if (isRegExp(body)) {
      const suffix = body.flags.includes('i') ? ', re.IGNORECASE' : '';
      return `re.compile(r"${body.source.replace(/\\\//, '/').replace(/"/g, '\\"')}"${suffix})`;
    }
    return `${this.quote(body)}`;
  }

  private quote(text: string) {
    return escapeWithQuotes(text, '\"');
  }
}

export class JavaLocatorFactory implements LocatorFactory {
  generateLocator(base: LocatorBase, kind: LocatorType, body: string | RegExp, options: { attrs?: Record<string, string | boolean>, exact?: boolean } = {}): string {
    let clazz: string;
    switch (base) {
      case 'page': clazz = 'Page'; break;
      case 'frame-locator': clazz = 'FrameLocator'; break;
      case 'locator': clazz = 'Locator'; break;
    }
    switch (kind) {
      case 'default':
        return `locator(${this.quote(body as string)})`;
      case 'nth':
        return `nth(${body})`;
      case 'first':
        return `first()`;
      case 'last':
        return `last()`;
      case 'role':
        const attrs: string[] = [];
        for (const [name, value] of Object.entries(options.attrs!))
          attrs.push(`.set${toTitleCase(name)}(${typeof value === 'string' ? this.quote(value) : value})`);
        const attrString = attrs.length ? `, new ${clazz}.GetByRoleOptions()${attrs.join('')}` : '';
        return `getByRole(AriaRole.${toSnakeCase(body as string).toUpperCase()}${attrString})`;
      case 'has-text':
        return `filter(new ${clazz}.LocatorOptions().setHasText(${this.toHasText(body)}))`;
      case 'test-id':
        return `getByTestId(${this.quote(body as string)})`;
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

  private toCallWithExact(clazz: string, method: string, body: string | RegExp, exact: boolean) {
    if (isRegExp(body)) {
      const suffix = body.flags.includes('i') ? ', Pattern.CASE_INSENSITIVE' : '';
      return `${method}(Pattern.compile(${this.quote(body.source)}${suffix}))`;
    }
    if (exact)
      return `${method}(${this.quote(body)}, new ${clazz}.${toTitleCase(method)}Options().setExact(true))`;
    return `${method}(${this.quote(body)})`;
  }

  private toHasText(body: string | RegExp) {
    if (isRegExp(body)) {
      const suffix = body.flags.includes('i') ? ', Pattern.CASE_INSENSITIVE' : '';
      return `Pattern.compile(${this.quote(body.source)}${suffix})`;
    }
    return this.quote(body);
  }

  private quote(text: string) {
    return escapeWithQuotes(text, '\"');
  }
}

export class CSharpLocatorFactory implements LocatorFactory {
  generateLocator(base: LocatorBase, kind: LocatorType, body: string | RegExp, options: { attrs?: Record<string, string | boolean>, exact?: boolean } = {}): string {
    switch (kind) {
      case 'default':
        return `Locator(${this.quote(body as string)})`;
      case 'nth':
        return `Nth(${body})`;
      case 'first':
        return `First`;
      case 'last':
        return `Last`;
      case 'role':
        const attrs: string[] = [];
        for (const [name, value] of Object.entries(options.attrs!)) {
          const optionKey = name === 'name' ? 'NameString' : toTitleCase(name);
          attrs.push(`${optionKey} = ${typeof value === 'string' ? this.quote(value) : value}`);
        }
        const attrString = attrs.length ? `, new() { ${attrs.join(', ')} }` : '';
        return `GetByRole(AriaRole.${toTitleCase(body as string)}${attrString})`;
      case 'has-text':
        return `Filter(new() { HasTextString: ${this.toHasText(body)} })`;
      case 'test-id':
        return `GetByTestId(${this.quote(body as string)})`;
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

  private toCallWithExact(method: string, body: string | RegExp, exact: boolean) {
    if (isRegExp(body)) {
      const suffix = body.flags.includes('i') ? ', RegexOptions.IgnoreCase' : '';
      return `${method}(new Regex(${this.quote(body.source)}${suffix}))`;
    }
    if (exact)
      return `${method}(${this.quote(body)}, new() { Exact: true })`;
    return `${method}(${this.quote(body)})`;
  }

  private toHasText(body: string | RegExp) {
    if (isRegExp(body)) {
      const suffix = body.flags.includes('i') ? ', RegexOptions.IgnoreCase' : '';
      return `new Regex(${this.quote(body.source)}${suffix})`;
    }
    return this.quote(body);
  }

  private quote(text: string) {
    return escapeWithQuotes(text, '\"');
  }
}

const generators: Record<Language, LocatorFactory> = {
  javascript: new JavaScriptLocatorFactory(),
  python: new PythonLocatorFactory(),
  java: new JavaLocatorFactory(),
  csharp: new CSharpLocatorFactory(),
};

export function isRegExp(obj: any): obj is RegExp {
  return obj instanceof RegExp;
}
