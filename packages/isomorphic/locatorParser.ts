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

import { asLocators } from './locatorGenerators';
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from './locatorUtils';
import { parseSelector } from './selectorParser';
import { escapeForAttributeSelector, escapeForTextSelector } from './stringUtils';

import type { Language, Quote } from './locatorGenerators';

// Locator source code is parsed in two steps:
//   1. A language-specific parser turns the source into a language-neutral chain of calls,
//      e.g. `get_by_role("button", name="Submit")` becomes { method: 'getByRole', args: ['button'], options: { name: 'Submit' } }.
//   2. SelectorBuilder turns the chain of calls into a selector.

type Value = string | number | boolean | RegExp | LocatorCall[];

type LocatorCall = {
  method: string;
  args: Value[];
  options: Map<string, Value>;
};

type Token =
  | { kind: 'identifier', value: string }
  | { kind: 'string', value: string, quote: Quote }
  | { kind: 'regex', value: RegExp }
  | { kind: 'number', value: number }
  | { kind: 'punctuation', value: string }
  | { kind: 'end' };

type ParserOptions = {
  quotes: string;
  // Python r"..." strings.
  rawStrings?: boolean;
  // JavaScript /.../flags literals.
  regexLiterals?: boolean;
  booleans?: [string, string];
};

const kEscapes = new Map([['n', '\n'], ['r', '\r'], ['t', '\t'], ['b', '\b'], ['f', '\f']]);
const kIdentifierRegex = /[A-Za-z_$][\w$]*/y;
const kNumberRegex = /-?\d+(\.\d+)?/y;
const kRegexFlagsRegex = /[a-z]*/y;

function tokenize(source: string, options: ParserOptions): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  const match = (re: RegExp) => {
    re.lastIndex = pos;
    const result = re.exec(source)?.[0];
    if (result)
      pos += result.length;
    return result;
  };

  // In raw strings, backslash only escapes the closing quote and is preserved otherwise.
  const readString = (quote: string, raw: boolean) => {
    let text = '';
    ++pos;
    while (pos < source.length && source[pos] !== quote) {
      if (source[pos] !== '\\') {
        text += source[pos++];
        continue;
      }
      const next = source[pos + 1] ?? '';
      pos += 2;
      if (raw) {
        text += next === quote ? next : '\\' + next;
      } else if (next === 'u') {
        text += String.fromCharCode(parseInt(source.substring(pos, pos + 4), 16));
        pos += 4;
      } else {
        text += kEscapes.get(next) ?? next;
      }
    }
    if (pos >= source.length)
      throw new Error(`Unterminated string in ${source}`);
    ++pos;
    return text;
  };

  while (pos < source.length) {
    const char = source[pos];
    let text: string | undefined;
    if (/\s/.test(char)) {
      ++pos;
    } else if (options.quotes.includes(char)) {
      tokens.push({ kind: 'string', value: readString(char, false), quote: char as Quote });
    } else if (options.rawStrings && char === 'r' && options.quotes.includes(source[pos + 1])) {
      const quote = source[++pos] as Quote;
      tokens.push({ kind: 'string', value: readString(quote, true), quote });
    } else if (options.regexLiterals && char === '/') {
      const regexSource = readString('/', true);
      tokens.push({ kind: 'regex', value: new RegExp(regexSource, match(kRegexFlagsRegex)) });
    } else if ('(){}.,:='.includes(char)) {
      tokens.push({ kind: 'punctuation', value: char });
      ++pos;
    } else if ((text = match(kIdentifierRegex))) {
      tokens.push({ kind: 'identifier', value: text });
    } else if ((text = match(kNumberRegex))) {
      tokens.push({ kind: 'number', value: +text });
    } else {
      throw new Error(`Unexpected character "${char}" in ${source}`);
    }
  }
  tokens.push({ kind: 'end' });
  return tokens;
}

function isToken(token: Token, kind: 'identifier' | 'punctuation', value: string): boolean {
  return token.kind === kind && token.value === value;
}

abstract class LocatorParser {
  private _tokens: Token[];
  private _pos = 0;
  private _booleans: [string, string];

  constructor(source: string, options: ParserOptions) {
    this._tokens = tokenize(source, options);
    this._booleans = options.booleans ?? ['true', 'false'];
  }

  parse(): { calls: LocatorCall[], preferredQuote: Quote | undefined } {
    const calls = this.parseChain();
    if (this.peek().kind !== 'end')
      this.unexpected();
    const preferredQuote = this._tokens.find(token => token.kind === 'string')?.quote;
    return { calls, preferredQuote };
  }

  // Methods are normalized to their JavaScript names, e.g. `get_by_role` => `getByRole`.
  protected methodName(identifier: string): string {
    return identifier;
  }

  // Parses a single argument that is either a positional value or an options bag.
  protected abstract parseArgument(call: LocatorCall): void;

  // Parses a language-specific regular expression, e.g. `re.compile(...)`.
  protected parseRegex(): RegExp | undefined {
    return undefined;
  }

  protected parseChain(): LocatorCall[] {
    const calls = [this.parseCall()];
    while (this.eat('.'))
      calls.push(this.parseCall());
    return calls;
  }

  private parseCall(): LocatorCall {
    const call: LocatorCall = { method: this.methodName(this.expectIdentifier()), args: [], options: new Map() };
    if (this.eat('(') && !this.eat(')')) {
      do
        this.parseArgument(call);
      while (this.eat(','));
      this.expect(')');
    }
    return call;
  }

  protected parseValue(): Value {
    const token = this.peek();
    if (token.kind === 'string' || token.kind === 'number' || token.kind === 'regex') {
      this.next();
      return token.value;
    }
    if (token.kind !== 'identifier')
      this.unexpected();
    const [trueLiteral, falseLiteral] = this._booleans;
    if (this.eatIdentifier(trueLiteral))
      return true;
    if (this.eatIdentifier(falseLiteral))
      return false;
    // Java and C# roles, e.g. `AriaRole.BUTTON`.
    if (this.eatIdentifier('AriaRole')) {
      this.expect('.');
      return this.expectIdentifier().toLowerCase();
    }
    return this.parseRegex() ?? this.parseChain();
  }

  // Parses `{ name <separator> value, ... }` after the opening brace.
  protected parseOptionsBag(call: LocatorCall, separator: string, optionName: (identifier: string) => string) {
    while (!this.eat('}')) {
      const name = optionName(this.expectIdentifier());
      this.expect(separator);
      call.options.set(name, this.parseValue());
      if (!this.eat(',')) {
        this.expect('}');
        break;
      }
    }
  }

  // Parses `(source[, <flagsEnum>.<ignoreCaseFlag>])`.
  protected parseRegexArguments(flagsEnum: string, ignoreCaseFlag: string): RegExp {
    this.expect('(');
    const source = this.expectString();
    let flags = '';
    if (this.eat(',')) {
      this.expectIdentifier(flagsEnum);
      this.expect('.');
      this.expectIdentifier(ignoreCaseFlag);
      flags = 'i';
    }
    this.expect(')');
    return new RegExp(source, flags);
  }

  protected peek(offset = 0): Token {
    return this._tokens[Math.min(this._pos + offset, this._tokens.length - 1)];
  }

  protected next(): Token {
    const token = this.peek();
    if (token.kind !== 'end')
      ++this._pos;
    return token;
  }

  protected eat(punctuation: string): boolean {
    if (!isToken(this.peek(), 'punctuation', punctuation))
      return false;
    this.next();
    return true;
  }

  protected eatIdentifier(identifier: string): boolean {
    if (!isToken(this.peek(), 'identifier', identifier))
      return false;
    this.next();
    return true;
  }

  protected expect(punctuation: string) {
    if (!this.eat(punctuation))
      this.unexpected();
  }

  protected expectIdentifier(identifier?: string): string {
    const token = this.peek();
    if (token.kind !== 'identifier' || (identifier !== undefined && token.value !== identifier))
      this.unexpected();
    this.next();
    return token.value;
  }

  protected expectString(): string {
    const token = this.next();
    if (token.kind !== 'string')
      this.unexpected();
    return token.value;
  }

  protected unexpected(): never {
    const token = this.peek();
    throw new Error(`Unexpected ${token.kind === 'end' ? 'end of input' : `token "${token.value}"`}`);
  }
}

// getByRole('button', { name: /submit/i, exact: true })
class JavaScriptLocatorParser extends LocatorParser {
  constructor(source: string) {
    super(source, { quotes: '\'"`', regexLiterals: true });
  }

  protected parseArgument(call: LocatorCall) {
    if (this.eat('{'))
      this.parseOptionsBag(call, ':', name => name);
    else
      call.args.push(this.parseValue());
  }
}

// get_by_role("button", name=re.compile(r"submit", re.IGNORECASE), exact=True)
class PythonLocatorParser extends LocatorParser {
  constructor(source: string) {
    super(source, { quotes: '\'"', rawStrings: true, booleans: ['True', 'False'] });
  }

  protected override methodName(identifier: string): string {
    return snakeToCamelCase(identifier.replace(/_+$/, ''));
  }

  protected parseArgument(call: LocatorCall) {
    if (!isToken(this.peek(1), 'punctuation', '=')) {
      call.args.push(this.parseValue());
      return;
    }
    const name = this.expectIdentifier();
    this.expect('=');
    call.options.set(snakeToCamelCase(name), this.parseValue());
  }

  protected override parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('re'))
      return;
    this.expect('.');
    this.expectIdentifier('compile');
    return this.parseRegexArguments('re', 'IGNORECASE');
  }
}

// getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName(Pattern.compile("submit", Pattern.CASE_INSENSITIVE)).setExact(true))
class JavaLocatorParser extends LocatorParser {
  constructor(source: string) {
    super(source, { quotes: '"' });
  }

  protected parseArgument(call: LocatorCall) {
    if (!this.eatIdentifier('new')) {
      call.args.push(this.parseValue());
      return;
    }
    // Options class, e.g. `Locator.FilterOptions`.
    this.expectIdentifier();
    this.expect('.');
    this.expectIdentifier();
    this.expect('(');
    this.expect(')');
    while (this.eat('.')) {
      const setter = this.expectIdentifier();
      if (!setter.startsWith('set'))
        throw new Error(`Unexpected options method ${setter}`);
      this.expect('(');
      call.options.set(lowerFirst(setter.substring('set'.length)), this.parseValue());
      this.expect(')');
    }
  }

  protected override parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('Pattern'))
      return;
    this.expect('.');
    this.expectIdentifier('compile');
    return this.parseRegexArguments('Pattern', 'CASE_INSENSITIVE');
  }
}

// GetByRole(AriaRole.Button, new() { NameRegex = new Regex("submit", RegexOptions.IgnoreCase), Exact = true })
class CSharpLocatorParser extends LocatorParser {
  constructor(source: string) {
    super(source, { quotes: '"' });
  }

  protected override methodName(identifier: string): string {
    return lowerFirst(identifier);
  }

  protected parseArgument(call: LocatorCall) {
    // `new() { ... }` is an options bag, while `new Regex(...)` is a value.
    if (!isToken(this.peek(), 'identifier', 'new') || !isToken(this.peek(1), 'punctuation', '(')) {
      call.args.push(this.parseValue());
      return;
    }
    this.next();
    this.expect('(');
    this.expect(')');
    this.expect('{');
    // Regular expression options have a "Regex" suffix, e.g. `NameRegex`.
    this.parseOptionsBag(call, '=', name => lowerFirst(name.replace(/Regex$/, '')));
  }

  protected override parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('new'))
      return;
    this.expectIdentifier('Regex');
    return this.parseRegexArguments('RegexOptions', 'IgnoreCase');
  }
}

const parsers: Partial<Record<Language, new (source: string) => LocatorParser>> = {
  javascript: JavaScriptLocatorParser,
  python: PythonLocatorParser,
  java: JavaLocatorParser,
  csharp: CSharpLocatorParser,
};

const kFilterOptions = ['hasText', 'hasNotText', 'has', 'hasNot', 'visible'];
const kFrameLocatorNthMethods = new Set(['first', 'last', 'nth']);
const kTextSelectors: Record<string, (text: string | RegExp, options: { exact?: boolean }) => string> = {
  getByAltText: getByAltTextSelector,
  getByLabel: getByLabelSelector,
  getByPlaceholder: getByPlaceholderSelector,
  getByText: getByTextSelector,
  getByTitle: getByTitleSelector,
};

class SelectorBuilder {
  private _testIdAttributeName: string;

  constructor(testIdAttributeName: string) {
    this._testIdAttributeName = testIdAttributeName;
  }

  build(calls: LocatorCall[]): string {
    const parts: string[] = [];
    // FrameLocator enters the frame lazily, so that first(), last() and nth() apply to the frame element.
    let inFrameLocator = false;
    for (const call of calls) {
      if (inFrameLocator && !kFrameLocatorNthMethods.has(call.method)) {
        parts.push('internal:control=enter-frame');
        inFrameLocator = false;
      }
      if (call.method === 'contentFrame') {
        checkArguments(call, 0, []);
        inFrameLocator = true;
        continue;
      }
      parts.push(...this._callToSelectorParts(call));
      if (call.method === 'frameLocator' && call.args.length)
        inFrameLocator = true;
    }
    if (inFrameLocator)
      parts.push('internal:control=enter-frame');
    return parts.join(' >> ');
  }

  private _callToSelectorParts(call: LocatorCall): string[] {
    const { method } = call;
    switch (method) {
      case 'locator': {
        checkArguments(call, 1, kFilterOptions);
        const inner = arg(call, 0, (value): value is string | LocatorCall[] => isString(value) || isLocator(value));
        const selector = isString(inner) ? inner : 'internal:chain=' + JSON.stringify(this.build(inner));
        return [selector, ...this._filters(call)];
      }
      case 'filter':
        checkArguments(call, 0, kFilterOptions);
        return this._filters(call);
      case 'and':
      case 'or':
        checkArguments(call, 1, []);
        return [`internal:${method}=` + JSON.stringify(this.build(arg(call, 0, isLocator)))];
      case 'frameLocator':
        checkArguments(call, 1, []);
        return [call.args.length ? arg(call, 0, isString) : 'internal:control=any-frame'];
      case 'first':
        checkArguments(call, 0, []);
        return ['nth=0'];
      case 'last':
        checkArguments(call, 0, []);
        return ['nth=-1'];
      case 'nth':
        checkArguments(call, 1, []);
        return [`nth=${arg(call, 0, isNumber)}`];
      case 'visible':
        checkArguments(call, 0, []);
        return ['visible=true'];
      case 'getByRole':
        return [this._role(call)];
      case 'getByTestId':
        checkArguments(call, 1, []);
        return [getByTestIdSelector(this._testIdAttributeName, arg(call, 0, isText))];
      case 'getByAltText':
      case 'getByLabel':
      case 'getByPlaceholder':
      case 'getByText':
      case 'getByTitle':
        checkArguments(call, 1, ['exact']);
        return [kTextSelectors[method](arg(call, 0, isText), { exact: option(call, 'exact', isBoolean) })];
    }
    throw new Error(`Unsupported locator method ${method}`);
  }

  private _filters(call: LocatorCall): string[] {
    const parts: string[] = [];
    const hasText = option(call, 'hasText', isText);
    if (hasText !== undefined)
      parts.push(`internal:has-text=${escapeForTextSelector(hasText, false)}`);
    const hasNotText = option(call, 'hasNotText', isText);
    if (hasNotText !== undefined)
      parts.push(`internal:has-not-text=${escapeForTextSelector(hasNotText, false)}`);
    const has = option(call, 'has', isLocator);
    if (has)
      parts.push(`internal:has=` + JSON.stringify(this.build(has)));
    const hasNot = option(call, 'hasNot', isLocator);
    if (hasNot)
      parts.push(`internal:has-not=` + JSON.stringify(this.build(hasNot)));
    const visible = option(call, 'visible', isBoolean);
    if (visible !== undefined)
      parts.push(`visible=${visible}`);
    return parts;
  }

  private _role(call: LocatorCall): string {
    checkArguments(call, 1, ['name', 'description', 'exact', 'checked', 'disabled', 'expanded', 'includeHidden', 'level', 'pressed', 'selected']);
    const exact = !!option(call, 'exact', isBoolean);
    let selector = `internal:role=${arg(call, 0, isString)}`;
    // Keep the attributes in the source order, so that the selector renders back into the same locator.
    for (const name of call.options.keys()) {
      if (name === 'name' || name === 'description')
        selector += `[${name}=${escapeForAttributeSelector(option(call, name, isText)!, exact)}]`;
      else if (name === 'level')
        selector += `[level=${option(call, name, isNumber)}]`;
      else if (name !== 'exact')
        selector += `[${name === 'includeHidden' ? 'include-hidden' : name}=${option(call, name, isBoolean)}]`;
    }
    return selector;
  }
}

function checkArguments(call: LocatorCall, maxArgs: number, allowedOptions: string[]) {
  if (call.args.length > maxArgs)
    throw new Error(`Too many arguments for ${call.method}`);
  for (const name of call.options.keys()) {
    if (!allowedOptions.includes(name))
      throw new Error(`Unsupported option ${name} for ${call.method}`);
  }
}

function arg<T extends Value>(call: LocatorCall, index: number, is: (value: Value) => value is T): T {
  const value = call.args[index];
  if (value === undefined || !is(value))
    throw new Error(`Unexpected argument #${index} for ${call.method}`);
  return value;
}

function option<T extends Value>(call: LocatorCall, name: string, is: (value: Value) => value is T): T | undefined {
  const value = call.options.get(name);
  if (value !== undefined && !is(value))
    throw new Error(`Unexpected ${name} option for ${call.method}`);
  return value;
}

function isString(value: Value): value is string {
  return typeof value === 'string';
}

function isText(value: Value): value is string | RegExp {
  return typeof value === 'string' || value instanceof RegExp;
}

function isNumber(value: Value): value is number {
  return typeof value === 'number';
}

function isBoolean(value: Value): value is boolean {
  return typeof value === 'boolean';
}

function isLocator(value: Value): value is LocatorCall[] {
  return Array.isArray(value);
}

function snakeToCamelCase(identifier: string): string {
  return identifier.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function lowerFirst(identifier: string): string {
  return identifier.charAt(0).toLowerCase() + identifier.substring(1);
}

function parseLocator(language: Language, locator: string, testIdAttributeName: string): { selector: string, preferredQuote: Quote | undefined } {
  const Parser = parsers[language];
  if (!Parser)
    throw new Error(`Parsing ${language} locators is not supported`);
  const { calls, preferredQuote } = new Parser(locator).parse();
  return { selector: new SelectorBuilder(testIdAttributeName).build(calls), preferredQuote };
}

export function locatorOrSelectorAsSelector(language: Language, locator: string, testIdAttributeName: string = 'data-testid'): string {
  try {
    return unsafeLocatorOrSelectorAsSelector(language, locator, testIdAttributeName);
  } catch (e) {
    return '';
  }
}

export function unsafeLocatorOrSelectorAsSelector(language: Language, locator: string, testIdAttributeName: string = 'data-testid'): string {
  try {
    parseSelector(locator);
    return locator;
  } catch (e) {
  }
  const { selector, preferredQuote } = parseLocator(language, locator, testIdAttributeName);
  const locators = asLocators(language, selector, undefined, undefined, preferredQuote);
  const digest = digestForComparison(language, locator);
  if (locators.some(candidate => digestForComparison(language, candidate) === digest))
    return selector;
  return '';
}

function digestForComparison(language: Language, locator: string) {
  locator = locator.replace(/\s/g, '');
  if (language === 'javascript')
    locator = locator.replace(/\\?["`]/g, '\'').replace(/,{}/g, '');
  return locator;
}
