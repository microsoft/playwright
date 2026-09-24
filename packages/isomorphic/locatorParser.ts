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

import { regexFlagNames } from './locatorGenerators';
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from './locatorUtils';
import { parseSelector, stringifySelector } from './selectorParser';
import { escapeForAttributeSelector, escapeForTextSelector } from './stringUtils';

import type { Language } from './locatorGenerators';
import type { ParsedSelector, ParsedSelectorPart } from './selectorParser';

type Value = string | number | boolean | RegExp | ParsedSelector;

// Arguments of a single call, collected until the call is converted into selector parts.
type CallArguments = {
  method: string;
  args: Value[];
  options: Map<string, Value>;
};

type CallHandler = (call: CallArguments, testIdAttributeName: string) => ParsedSelectorPart[];

type Token =
  | { kind: 'identifier', value: string }
  | { kind: 'string', value: string }
  | { kind: 'regex', value: RegExp }
  | { kind: 'number', value: number }
  | { kind: 'punctuation', value: string }
  | { kind: 'end' };

type ParserOptions = {
  methods: Map<string, CallHandler>;
  quotes: string;
  rawStrings?: boolean;
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
      tokens.push({ kind: 'string', value: readString(char, false) });
    } else if (options.rawStrings && char === 'r' && options.quotes.includes(source[pos + 1])) {
      tokens.push({ kind: 'string', value: readString(source[++pos], true) });
    } else if (options.regexLiterals && char === '/') {
      const regexSource = readString('/', true);
      tokens.push({ kind: 'regex', value: new RegExp(regexSource, match(kRegexFlagsRegex)) });
    } else if ('(){}.,:=|'.includes(char)) {
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
  private _methods: Map<string, CallHandler>;
  private _booleans: [string, string];
  private _testIdAttributeName: string;

  constructor(source: string, options: ParserOptions, testIdAttributeName: string) {
    this._tokens = tokenize(source, options);
    this._methods = options.methods;
    this._booleans = options.booleans ?? ['true', 'false'];
    this._testIdAttributeName = testIdAttributeName;
  }

  parse(): ParsedSelector {
    const selector = this.parseLocator();
    if (this.peek().kind !== 'end')
      this.unexpected();
    // Same as in parseSelector(), nested selectors like internal:chain cannot be first.
    if (selector.parts.length && isNestedSelectorPart(selector.parts[0]))
      throw new Error(`"${selector.parts[0].name}" selector cannot be first`);
    return selector;
  }

  // Parses a single argument that is either a positional value or an options bag.
  protected abstract parseArgument(call: CallArguments): void;

  // Parses a language-specific regular expression, e.g. `re.compile(...)`.
  protected abstract parseRegex(): RegExp | undefined;

  protected parseLocator(): ParsedSelector {
    const parts: ParsedSelectorPart[] = [];
    // FrameLocator enters the frame lazily, so that first(), last() and nth() apply to the frame element.
    let inFrameLocator = false;
    do {
      const { handler, call } = this.parseCall();
      if (inFrameLocator && !kFrameElementHandlers.has(handler)) {
        parts.push(selectorPart('internal:control', 'enter-frame'));
        inFrameLocator = false;
      }
      parts.push(...handler(call, this._testIdAttributeName));
      if (handler === contentFrameParts || (handler === frameLocatorParts && call.args.length))
        inFrameLocator = true;
    } while (this.eat('.'));
    if (inFrameLocator)
      parts.push(selectorPart('internal:control', 'enter-frame'));
    return { parts };
  }

  private parseCall(): { handler: CallHandler, call: CallArguments } {
    const method = this.expectIdentifier();
    const handler = this._methods.get(method);
    if (!handler)
      throw new Error(`Unsupported locator method ${method}`);
    const call: CallArguments = { method, args: [], options: new Map() };
    if (this.eat('(') && !this.eat(')')) {
      do
        this.parseArgument(call);
      while (this.eat(','));
      this.expect(')');
    }
    return { handler, call };
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
    return this.parseRegex() ?? this.parseLocator();
  }

  // Parses `{ name <separator> value, ... }` after the opening brace.
  protected parseOptionsBag(call: CallArguments, separator: string, optionName: (identifier: string) => string) {
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

  // Parses `(source[, <flagsEnum>.<flag> ( "|" <flagsEnum>.<flag> )*])`.
  protected parseRegexArguments(flagsEnum: string, flagNames: Record<string, string>): RegExp {
    this.expect('(');
    const source = this.expectString();
    let flags = '';
    if (this.eat(',')) {
      do {
        this.expectIdentifier(flagsEnum);
        this.expect('.');
        const name = this.expectIdentifier();
        const flag = Object.keys(flagNames).find(flag => flagNames[flag] === name);
        if (!flag)
          throw new Error(`Unsupported regular expression flag ${flagsEnum}.${name}`);
        flags += flag;
      } while (this.eat('|'));
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
  constructor(source: string, testIdAttributeName: string) {
    super(source, { methods: kJavaScriptMethods, quotes: '\'"`', regexLiterals: true }, testIdAttributeName);
  }

  protected parseArgument(call: CallArguments) {
    if (this.eat('{'))
      this.parseOptionsBag(call, ':', name => name);
    else
      call.args.push(this.parseValue());
  }

  // Regular expression literals are tokens.
  protected parseRegex(): RegExp | undefined {
    return undefined;
  }
}

// get_by_role("button", name=re.compile(r"submit", re.IGNORECASE), exact=True)
class PythonLocatorParser extends LocatorParser {
  constructor(source: string, testIdAttributeName: string) {
    super(source, { methods: kPythonMethods, quotes: '\'"', rawStrings: true, booleans: ['True', 'False'] }, testIdAttributeName);
  }

  protected parseArgument(call: CallArguments) {
    if (!isToken(this.peek(1), 'punctuation', '=')) {
      call.args.push(this.parseValue());
      return;
    }
    const name = this.expectIdentifier();
    this.expect('=');
    call.options.set(name.replace(/_([a-z])/g, (_, char) => char.toUpperCase()), this.parseValue());
  }

  protected parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('re'))
      return;
    this.expect('.');
    this.expectIdentifier('compile');
    return this.parseRegexArguments('re', regexFlagNames.python);
  }
}

// getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName(Pattern.compile("submit", Pattern.CASE_INSENSITIVE)).setExact(true))
class JavaLocatorParser extends LocatorParser {
  constructor(source: string, testIdAttributeName: string) {
    super(source, { methods: kJavaScriptMethods, quotes: '"' }, testIdAttributeName);
  }

  protected parseArgument(call: CallArguments) {
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

  protected parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('Pattern'))
      return;
    this.expect('.');
    this.expectIdentifier('compile');
    return this.parseRegexArguments('Pattern', regexFlagNames.java);
  }
}

// GetByRole(AriaRole.Button, new() { NameRegex = new Regex("submit", RegexOptions.IgnoreCase), Exact = true })
class CSharpLocatorParser extends LocatorParser {
  constructor(source: string, testIdAttributeName: string) {
    super(source, { methods: kCSharpMethods, quotes: '"' }, testIdAttributeName);
  }

  protected parseArgument(call: CallArguments) {
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

  protected parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('new'))
      return;
    this.expectIdentifier('Regex');
    return this.parseRegexArguments('RegexOptions', regexFlagNames.csharp);
  }
}

const parsers: Partial<Record<Language, new (source: string, testIdAttributeName: string) => LocatorParser>> = {
  javascript: JavaScriptLocatorParser,
  python: PythonLocatorParser,
  java: JavaLocatorParser,
  csharp: CSharpLocatorParser,
};

const kFilterOptions = ['hasText', 'hasNotText', 'has', 'hasNot', 'visible'];

function locatorParts(call: CallArguments): ParsedSelectorPart[] {
  checkArguments(call, 1, kFilterOptions);
  const inner = arg(call, 0, (value): value is string | ParsedSelector => isString(value) || isSelector(value));
  const parts = isString(inner) ? parseSelector(inner).parts : [nestedSelectorPart('internal:chain', inner)];
  return [...parts, ...filterSelectorParts(call)];
}

function filterParts(call: CallArguments): ParsedSelectorPart[] {
  checkArguments(call, 0, kFilterOptions);
  return filterSelectorParts(call);
}

function nestedParts(name: string): CallHandler {
  return call => {
    checkArguments(call, 1, []);
    return [nestedSelectorPart(name, arg(call, 0, isSelector))];
  };
}

function frameLocatorParts(call: CallArguments): ParsedSelectorPart[] {
  checkArguments(call, 1, []);
  return call.args.length ? parseSelector(arg(call, 0, isString)).parts : [selectorPart('internal:control', 'any-frame')];
}

// Entering the frame is deferred by the parser.
function contentFrameParts(call: CallArguments): ParsedSelectorPart[] {
  checkArguments(call, 0, []);
  return [];
}

function fixedNthParts(index: string): CallHandler {
  return call => {
    checkArguments(call, 0, []);
    return [selectorPart('nth', index)];
  };
}

function nthParts(call: CallArguments): ParsedSelectorPart[] {
  checkArguments(call, 1, []);
  return [selectorPart('nth', String(arg(call, 0, isNumber)))];
}

function visibleParts(call: CallArguments): ParsedSelectorPart[] {
  checkArguments(call, 0, []);
  return [selectorPart('visible', 'true')];
}

function getByTestIdParts(call: CallArguments, testIdAttributeName: string): ParsedSelectorPart[] {
  checkArguments(call, 1, []);
  return parseSelector(getByTestIdSelector(testIdAttributeName, arg(call, 0, isText))).parts;
}

function textParts(toSelector: (text: string | RegExp, options: { exact?: boolean }) => string): CallHandler {
  return call => {
    checkArguments(call, 1, ['exact']);
    return parseSelector(toSelector(arg(call, 0, isText), { exact: option(call, 'exact', isBoolean) })).parts;
  };
}

const andParts = nestedParts('internal:and');
const orParts = nestedParts('internal:or');
const firstParts = fixedNthParts('0');
const lastParts = fixedNthParts('-1');
const getByTextParts = textParts(getByTextSelector);
const getByLabelParts = textParts(getByLabelSelector);
const getByAltTextParts = textParts(getByAltTextSelector);
const getByPlaceholderParts = textParts(getByPlaceholderSelector);
const getByTitleParts = textParts(getByTitleSelector);

const kFrameElementHandlers = new Set<CallHandler>([firstParts, lastParts, nthParts]);

// JavaScript and Java share the method names.
const kJavaScriptMethods = new Map<string, CallHandler>([
  ['locator', locatorParts],
  ['filter', filterParts],
  ['and', andParts],
  ['or', orParts],
  ['frameLocator', frameLocatorParts],
  ['contentFrame', contentFrameParts],
  ['first', firstParts],
  ['last', lastParts],
  ['nth', nthParts],
  ['visible', visibleParts],
  ['getByRole', getByRoleParts],
  ['getByText', getByTextParts],
  ['getByLabel', getByLabelParts],
  ['getByTestId', getByTestIdParts],
  ['getByAltText', getByAltTextParts],
  ['getByPlaceholder', getByPlaceholderParts],
  ['getByTitle', getByTitleParts],
]);

const kPythonMethods = new Map<string, CallHandler>([
  ['locator', locatorParts],
  ['filter', filterParts],
  ['and_', andParts],
  ['or_', orParts],
  ['frame_locator', frameLocatorParts],
  ['content_frame', contentFrameParts],
  ['first', firstParts],
  ['last', lastParts],
  ['nth', nthParts],
  ['visible', visibleParts],
  ['get_by_role', getByRoleParts],
  ['get_by_text', getByTextParts],
  ['get_by_label', getByLabelParts],
  ['get_by_test_id', getByTestIdParts],
  ['get_by_alt_text', getByAltTextParts],
  ['get_by_placeholder', getByPlaceholderParts],
  ['get_by_title', getByTitleParts],
]);

const kCSharpMethods = new Map<string, CallHandler>([
  ['Locator', locatorParts],
  ['Filter', filterParts],
  ['And', andParts],
  ['Or', orParts],
  ['FrameLocator', frameLocatorParts],
  ['ContentFrame', contentFrameParts],
  ['First', firstParts],
  ['Last', lastParts],
  ['Nth', nthParts],
  ['Visible', visibleParts],
  ['GetByRole', getByRoleParts],
  ['GetByText', getByTextParts],
  ['GetByLabel', getByLabelParts],
  ['GetByTestId', getByTestIdParts],
  ['GetByAltText', getByAltTextParts],
  ['GetByPlaceholder', getByPlaceholderParts],
  ['GetByTitle', getByTitleParts],
]);

function filterSelectorParts(call: CallArguments): ParsedSelectorPart[] {
  const parts: ParsedSelectorPart[] = [];
  const hasText = option(call, 'hasText', isText);
  if (hasText !== undefined)
    parts.push(selectorPart('internal:has-text', escapeForTextSelector(hasText, false)));
  const hasNotText = option(call, 'hasNotText', isText);
  if (hasNotText !== undefined)
    parts.push(selectorPart('internal:has-not-text', escapeForTextSelector(hasNotText, false)));
  const has = option(call, 'has', isSelector);
  if (has)
    parts.push(nestedSelectorPart('internal:has', has));
  const hasNot = option(call, 'hasNot', isSelector);
  if (hasNot)
    parts.push(nestedSelectorPart('internal:has-not', hasNot));
  const visible = option(call, 'visible', isBoolean);
  if (visible !== undefined)
    parts.push(selectorPart('visible', String(visible)));
  return parts;
}

function getByRoleParts(call: CallArguments): ParsedSelectorPart[] {
  checkArguments(call, 1, ['name', 'description', 'exact', 'checked', 'disabled', 'expanded', 'includeHidden', 'level', 'pressed', 'selected']);
  const exact = !!option(call, 'exact', isBoolean);
  let body = arg(call, 0, isString);
  for (const name of call.options.keys()) {
    if (name === 'name' || name === 'description')
      body += `[${name}=${escapeForAttributeSelector(option(call, name, isText)!, exact)}]`;
    else if (name === 'level')
      body += `[level=${option(call, name, isNumber)}]`;
    else if (name !== 'exact')
      body += `[${name === 'includeHidden' ? 'include-hidden' : name}=${option(call, name, isBoolean)}]`;
  }
  return [selectorPart('internal:role', body)];
}

function selectorPart(name: string, body: string): ParsedSelectorPart {
  return { name, body, source: body };
}

function nestedSelectorPart(name: string, parsed: ParsedSelector): ParsedSelectorPart {
  return { name, body: { parsed }, source: JSON.stringify(stringifySelector(parsed)) };
}

function isNestedSelectorPart(part: ParsedSelectorPart): boolean {
  return typeof part.body === 'object' && 'parsed' in part.body;
}

function checkArguments(call: CallArguments, maxArgs: number, allowedOptions: string[]) {
  if (call.args.length > maxArgs)
    throw new Error(`Too many arguments for ${call.method}`);
  for (const name of call.options.keys()) {
    if (!allowedOptions.includes(name))
      throw new Error(`Unsupported option ${name} for ${call.method}`);
  }
}

function arg<T extends Value>(call: CallArguments, index: number, is: (value: Value) => value is T): T {
  const value = call.args[index];
  if (value === undefined || !is(value))
    throw new Error(`Unexpected argument #${index} for ${call.method}`);
  return value;
}

function option<T extends Value>(call: CallArguments, name: string, is: (value: Value) => value is T): T | undefined {
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

function isSelector(value: Value): value is ParsedSelector {
  return typeof value === 'object' && !(value instanceof RegExp);
}

function lowerFirst(identifier: string): string {
  return identifier.charAt(0).toLowerCase() + identifier.substring(1);
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
  const Parser = parsers[language];
  if (!Parser)
    return '';
  return stringifySelector(new Parser(locator, testIdAttributeName).parse());
}
