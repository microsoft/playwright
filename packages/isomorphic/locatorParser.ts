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
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByRoleSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from './locatorUtils';
import { kAnyFrameSelector, parseSelector, stringifySelector } from './selectorParser';
import { escapeForTextSelector, toSnakeCase, toTitleCase } from './stringUtils';

import type { Language } from './locatorGenerators';
import type { ParsedSelector, ParsedSelectorPart } from './selectorParser';

type Value = string | number | boolean | RegExp | ParsedSelector;

// Arguments of a single call, collected until the call is converted into selector parts.
type CallArguments = {
  method: string;
  args: Value[];
  options: Map<string, Value>;
  hasOptions: boolean;
};

// The object that a method is called on. FrameLocator parts select the frame element.
type Target = {
  type: 'Page' | 'Locator' | 'FrameLocator';
  parts: ParsedSelectorPart[];
};

type Method = (call: CallArguments, target: Target, testIdAttributeName: string) => Target;

type Token =
  | { kind: 'identifier', value: string }
  | { kind: 'string', value: string }
  | { kind: 'regex', value: RegExp }
  | { kind: 'number', value: number }
  | { kind: 'punctuation', value: string }
  | { kind: 'end' };

type Match = (re: RegExp) => string | undefined;

type ParserOptions = {
  methods: Map<string, Method>;
  quotes: string;
  escape: (char: string, match: Match) => string | undefined;
  rawStrings?: boolean;
  verbatimStrings?: boolean;
  regexLiterals?: boolean;
  trailingCommas?: boolean;
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
  const readString = (quote: string, raw: boolean, regexLiteral = false) => {
    let text = '';
    let inCharacterClass = false;
    ++pos;
    while (pos < source.length && (source[pos] !== quote || inCharacterClass)) {
      if (quote === '`' && source.startsWith('${', pos))
        throw new Error(`Template literal placeholders are not supported in ${source}`);
      if (source[pos] !== '\\') {
        const char = source[pos++];
        if (regexLiteral) {
          if (char === '[')
            inCharacterClass = true;
          else if (char === ']')
            inCharacterClass = false;
        }
        text += char;
        continue;
      }
      const next = source[pos + 1] ?? '';
      pos += 2;
      if (raw) {
        text += next === quote ? next : '\\' + next;
        continue;
      }
      const escaped = options.escape(next, match);
      if (escaped === undefined)
        throw new Error(`Invalid escape sequence in ${source}`);
      text += escaped;
    }
    if (pos >= source.length)
      throw new Error(`Unterminated ${regexLiteral ? 'regular expression' : 'string'} in ${source}`);
    ++pos;
    return text;
  };

  // C# verbatim strings only escape the quote by doubling it.
  const readVerbatimString = () => {
    let text = '';
    pos += 2;
    while (pos < source.length) {
      if (source[pos] === '"' && source[pos + 1] !== '"') {
        ++pos;
        return text;
      }
      if (source[pos] === '"')
        ++pos;
      text += source[pos++];
    }
    throw new Error(`Unterminated string in ${source}`);
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
    } else if (options.verbatimStrings && char === '@' && source[pos + 1] === '"') {
      tokens.push({ kind: 'string', value: readVerbatimString() });
    } else if (options.regexLiterals && char === '/') {
      const regexSource = readString('/', true, true);
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

function codePoint(hex: string | undefined): string | undefined {
  const value = parseInt(hex ?? '', 16);
  return Number.isNaN(value) || value > 0x10FFFF ? undefined : String.fromCodePoint(value);
}

function javascriptEscape(char: string, match: Match): string | undefined {
  if (char === 'x')
    return codePoint(match(/[\da-f]{2}/iy));
  if (char === 'u')
    return codePoint(match(/[\da-f]{4}/iy) ?? match(/\{[\da-f]{1,6}\}/iy)?.slice(1, -1));
  return kEscapes.get(char) ?? char;
}

// Unknown escape sequences keep the backslash in Python.
function pythonEscape(char: string, match: Match): string | undefined {
  if (char === 'x')
    return codePoint(match(/[\da-f]{2}/iy));
  if (char === 'u')
    return codePoint(match(/[\da-f]{4}/iy));
  if (char === 'U')
    return codePoint(match(/[\da-f]{8}/iy));
  return kEscapes.get(char) ?? ('\\\'"'.includes(char) ? char : '\\' + char);
}

function javaEscape(char: string, match: Match): string | undefined {
  if (char === 'u')
    return codePoint(match(/[\da-f]{4}/iy));
  return kEscapes.get(char) ?? char;
}

function csharpEscape(char: string, match: Match): string | undefined {
  if (char === 'x')
    return codePoint(match(/[\da-f]{1,4}/iy));
  if (char === 'u')
    return codePoint(match(/[\da-f]{4}/iy));
  if (char === 'U')
    return codePoint(match(/[\da-f]{8}/iy));
  return kEscapes.get(char) ?? char;
}

function isToken(token: Token, kind: 'identifier' | 'punctuation', value: string): boolean {
  return token.kind === kind && token.value === value;
}

abstract class LocatorParser {
  private _tokens: Token[];
  private _pos = 0;
  private _methods: Map<string, Method>;
  private _booleans: [string, string];
  private _trailingCommas: boolean;
  private _testIdAttributeName: string;

  constructor(source: string, options: ParserOptions, testIdAttributeName: string) {
    this._tokens = tokenize(source, options);
    this._methods = options.methods;
    this._booleans = options.booleans ?? ['true', 'false'];
    this._trailingCommas = !!options.trailingCommas;
    this._testIdAttributeName = testIdAttributeName;
  }

  parse(): ParsedSelector {
    const target = this.parseLocator();
    if (this.peek().kind !== 'end')
      this.unexpected();
    return { parts: target.type === 'FrameLocator' ? childParts(target, []) : target.parts };
  }

  // Parses a single argument that is either a positional value or an options bag.
  protected abstract parseArgument(call: CallArguments): void;

  // Parses a language-specific regular expression, e.g. `re.compile(...)`.
  protected abstract parseRegex(): RegExp | undefined;

  protected parseLocator(): Target {
    let target: Target = { type: 'Page', parts: [] };
    do {
      const name = this.expectIdentifier();
      const method = this._methods.get(name);
      if (!method)
        throw new Error(`Unsupported locator method ${name}`);
      target = method(this.parseArguments(name), target, this._testIdAttributeName);
    } while (this.eat('.'));
    return target;
  }

  private parseArguments(method: string): CallArguments {
    const call: CallArguments = { method, args: [], options: new Map(), hasOptions: false };
    if (this.eat('(') && !this.eat(')')) {
      do
        this.parseArgument(call);
      while (this.eat(',') && !(this._trailingCommas && isToken(this.peek(), 'punctuation', ')')));
      this.expect(')');
    }
    return call;
  }

  protected addArgument(call: CallArguments, value: Value) {
    if (call.hasOptions)
      throw new Error(`Unexpected argument after options for ${call.method}`);
    call.args.push(value);
  }

  protected startOptions(call: CallArguments) {
    if (call.hasOptions)
      throw new Error(`Unexpected options for ${call.method}`);
    call.hasOptions = true;
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
    const regex = this.parseRegex();
    if (regex)
      return regex;
    const target = this.parseLocator();
    if (target.type !== 'Locator')
      throw new Error(`Expected a locator, got ${target.type}`);
    return { parts: target.parts };
  }

  // Parses `{ name <separator> value, ... }` after the opening brace.
  protected parseOptionsBag(call: CallArguments, separator: string, optionName: (identifier: string) => string) {
    this.startOptions(call);
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

  // Parses `(source[, [flagsKeyword=]<flagsEnum>.<flag> ( "|" <flagsEnum>.<flag> )*])`.
  protected parseRegexArguments(flagsEnum: string, flagsByName: Map<string, string>, flagsKeyword?: string): RegExp {
    this.expect('(');
    const source = this.expectString();
    let flags = '';
    if (this.eat(',')) {
      if (flagsKeyword && isToken(this.peek(1), 'punctuation', '=')) {
        this.expectIdentifier(flagsKeyword);
        this.expect('=');
      }
      do {
        this.expectIdentifier(flagsEnum);
        this.expect('.');
        const name = this.expectIdentifier();
        const flag = flagsByName.get(name);
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
    super(source, { methods: kJavaScriptMethods, quotes: '\'"`', escape: javascriptEscape, regexLiterals: true, trailingCommas: true }, testIdAttributeName);
  }

  protected parseArgument(call: CallArguments) {
    if (this.eat('{'))
      this.parseOptionsBag(call, ':', name => name);
    else
      this.addArgument(call, this.parseValue());
  }

  // Regular expression literals are tokens, so only `new RegExp(source, flags)` is parsed here.
  protected parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('new'))
      return;
    this.expectIdentifier('RegExp');
    this.expect('(');
    const source = this.expectString();
    const flags = this.eat(',') ? this.expectString() : '';
    this.expect(')');
    return new RegExp(source, flags);
  }
}

// get_by_role("button", name=re.compile(r"submit", re.IGNORECASE), exact=True)
class PythonLocatorParser extends LocatorParser {
  constructor(source: string, testIdAttributeName: string) {
    super(source, { methods: kPythonMethods, quotes: '\'"', escape: pythonEscape, rawStrings: true, trailingCommas: true, booleans: ['True', 'False'] }, testIdAttributeName);
  }

  protected parseArgument(call: CallArguments) {
    if (!isToken(this.peek(1), 'punctuation', '=')) {
      this.addArgument(call, this.parseValue());
      return;
    }
    const name = this.expectIdentifier();
    this.expect('=');
    call.hasOptions = true;
    call.options.set(name.replace(/_([a-z])/g, (_, char) => char.toUpperCase()), this.parseValue());
  }

  protected parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('re'))
      return;
    this.expect('.');
    this.expectIdentifier('compile');
    return this.parseRegexArguments('re', kPythonRegexFlags, 'flags');
  }
}

// getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName(Pattern.compile("submit", Pattern.CASE_INSENSITIVE)).setExact(true))
class JavaLocatorParser extends LocatorParser {
  constructor(source: string, testIdAttributeName: string) {
    super(source, { methods: kJavaScriptMethods, quotes: '"', escape: javaEscape }, testIdAttributeName);
  }

  protected parseArgument(call: CallArguments) {
    if (!this.eatIdentifier('new')) {
      this.addArgument(call, this.parseValue());
      return;
    }
    this.startOptions(call);
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
    return this.parseRegexArguments('Pattern', flagsByName(regexFlagNames.java));
  }
}

// GetByRole(AriaRole.Button, new() { NameRegex = new Regex("submit", RegexOptions.IgnoreCase), Exact = true })
class CSharpLocatorParser extends LocatorParser {
  constructor(source: string, testIdAttributeName: string) {
    super(source, { methods: kCSharpMethods, quotes: '"', escape: csharpEscape, verbatimStrings: true }, testIdAttributeName);
  }

  protected parseArgument(call: CallArguments) {
    if (!this.eatOptionsType()) {
      this.addArgument(call, this.parseValue());
      return;
    }
    this.expect('{');
    // Regular expression options have a "Regex" suffix, e.g. `NameRegex`.
    this.parseOptionsBag(call, '=', name => lowerFirst(name.replace(/Regex$/, '')));
  }

  // `new()`, `new PageGetByRoleOptions` or `new PageGetByRoleOptions()`, while `new Regex(...)` is a value.
  private eatOptionsType(): boolean {
    if (!isToken(this.peek(), 'identifier', 'new'))
      return false;
    const type = this.peek(1);
    if (isToken(type, 'punctuation', '(')) {
      this.next();
      this.expect('(');
      this.expect(')');
      return true;
    }
    if (type.kind !== 'identifier' || !type.value.endsWith('Options'))
      return false;
    this.next();
    this.next();
    if (this.eat('('))
      this.expect(')');
    return true;
  }

  protected parseRegex(): RegExp | undefined {
    if (!this.eatIdentifier('new'))
      return;
    this.expectIdentifier('Regex');
    return this.parseRegexArguments('RegexOptions', flagsByName(regexFlagNames.csharp));
  }
}

const parsers: Partial<Record<Language, new (source: string, testIdAttributeName: string) => LocatorParser>> = {
  javascript: JavaScriptLocatorParser,
  python: PythonLocatorParser,
  java: JavaLocatorParser,
  csharp: CSharpLocatorParser,
};

function flagsByName(flagNames: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(flagNames).map(([flag, name]) => [name, flag]));
}

const kPythonRegexFlags = new Map([...flagsByName(regexFlagNames.python), ['I', 'i'], ['M', 'm'], ['S', 's']]);

const kLocatorOptions = ['hasText', 'hasNotText', 'has', 'hasNot'];
const kFilterOptions = [...kLocatorOptions, 'visible'];
const kRoleOptions = ['checked', 'disabled', 'selected', 'expanded', 'includeHidden', 'level', 'name', 'description', 'pressed', 'exact'];

function method(types: Target['type'][], handler: Method): Method {
  return (call, target, testIdAttributeName) => {
    if (!types.includes(target.type))
      throw new Error(`Unsupported method ${call.method} for ${target.type}`);
    return handler(call, target, testIdAttributeName);
  };
}

function locator(call: CallArguments, target: Target): Target {
  checkArguments(call, 1, kLocatorOptions);
  const inner = target.type === 'Page' ? arg(call, 0, isString) : arg(call, 0, isStringOrSelector);
  let parts: ParsedSelectorPart[];
  if (isString(inner))
    parts = parseSelector(inner).parts;
  else if (target.type === 'FrameLocator')
    parts = inner.parts;
  else
    parts = [nestedSelectorPart('internal:chain', inner)];
  return { type: 'Locator', parts: [...childParts(target, parts), ...filterSelectorParts(call)] };
}

function filter(call: CallArguments, target: Target): Target {
  checkArguments(call, 0, kFilterOptions);
  return { type: 'Locator', parts: [...target.parts, ...filterSelectorParts(call)] };
}

function within(call: CallArguments, target: Target): Target {
  checkArguments(call, 1, []);
  return { type: 'Locator', parts: [...arg(call, 0, isSelector).parts, nestedSelectorPart('internal:chain', { parts: target.parts })] };
}

function nested(name: string): Method {
  return (call, target) => {
    checkArguments(call, 1, []);
    return { type: 'Locator', parts: [...target.parts, nestedSelectorPart(name, arg(call, 0, isSelector))] };
  };
}

function frameLocator(call: CallArguments, target: Target): Target {
  checkArguments(call, 1, []);
  if (target.type === 'Page' && !call.args.length)
    return { type: 'FrameLocator', parts: parseSelector(kAnyFrameSelector).parts };
  return { type: 'FrameLocator', parts: childParts(target, parseSelector(arg(call, 0, isString)).parts) };
}

function contentFrame(call: CallArguments, target: Target): Target {
  checkArguments(call, 0, []);
  return { type: 'FrameLocator', parts: target.parts };
}

function owner(call: CallArguments, target: Target): Target {
  checkArguments(call, 0, []);
  return { type: 'Locator', parts: target.parts };
}

function nth(maxArgs: number, index: (call: CallArguments) => string): Method {
  return (call, target) => {
    checkArguments(call, maxArgs, []);
    if (isAnyFrame(target))
      throw new Error(`Selecting the nth frame is not allowed on frameLocator()`);
    return { type: target.type, parts: [...target.parts, selectorPart('nth', index(call))] };
  };
}

function visible(call: CallArguments, target: Target): Target {
  checkArguments(call, 0, []);
  return { type: 'Locator', parts: [...target.parts, selectorPart('visible', 'true')] };
}

function describe(call: CallArguments, target: Target): Target {
  checkArguments(call, 1, []);
  return { type: 'Locator', parts: [...target.parts, selectorPart('internal:describe', JSON.stringify(arg(call, 0, isString)))] };
}

function getBy(selector: (call: CallArguments, testIdAttributeName: string) => string): Method {
  return (call, target, testIdAttributeName) => ({ type: 'Locator', parts: childParts(target, parseSelector(selector(call, testIdAttributeName)).parts) });
}

function textSelector(toSelector: (text: string | RegExp, options: { exact?: boolean }) => string) {
  return (call: CallArguments) => {
    checkArguments(call, 1, ['exact']);
    return toSelector(arg(call, 0, isText), { exact: option(call, 'exact', isBoolean) });
  };
}

function roleSelector(call: CallArguments): string {
  checkArguments(call, 1, kRoleOptions);
  return getByRoleSelector(arg(call, 0, isString), {
    checked: option(call, 'checked', isBooleanOrMixed),
    disabled: option(call, 'disabled', isBoolean),
    selected: option(call, 'selected', isBoolean),
    expanded: option(call, 'expanded', isBoolean),
    includeHidden: option(call, 'includeHidden', isBoolean),
    level: option(call, 'level', isNumber),
    name: option(call, 'name', isText),
    description: option(call, 'description', isText),
    pressed: option(call, 'pressed', isBooleanOrMixed),
    exact: option(call, 'exact', isBoolean),
  });
}

function testIdSelector(call: CallArguments, testIdAttributeName: string): string {
  checkArguments(call, 1, []);
  return getByTestIdSelector(testIdAttributeName, arg(call, 0, isText));
}

function getByRef(call: CallArguments): Target {
  checkArguments(call, 1, []);
  return { type: 'Locator', parts: [selectorPart('aria-ref', arg(call, 0, isString))] };
}

const kMethods: Record<string, Method> = {
  locator: method(['Page', 'Locator', 'FrameLocator'], locator),
  filter: method(['Locator'], filter),
  within: method(['Locator'], within),
  and: method(['Locator'], nested('internal:and')),
  or: method(['Locator'], nested('internal:or')),
  frameLocator: method(['Page', 'Locator', 'FrameLocator'], frameLocator),
  contentFrame: method(['Locator'], contentFrame),
  owner: method(['FrameLocator'], owner),
  first: method(['Locator', 'FrameLocator'], nth(0, () => '0')),
  last: method(['Locator', 'FrameLocator'], nth(0, () => '-1')),
  nth: method(['Locator', 'FrameLocator'], nth(1, call => String(arg(call, 0, isNumber)))),
  visible: method(['Locator'], visible),
  describe: method(['Locator'], describe),
  getByRole: method(['Page', 'Locator', 'FrameLocator'], getBy(roleSelector)),
  getByText: method(['Page', 'Locator', 'FrameLocator'], getBy(textSelector(getByTextSelector))),
  getByLabel: method(['Page', 'Locator', 'FrameLocator'], getBy(textSelector(getByLabelSelector))),
  getByTestId: method(['Page', 'Locator', 'FrameLocator'], getBy(testIdSelector)),
  getByRef: method(['Page'], getByRef),
  getByAltText: method(['Page', 'Locator', 'FrameLocator'], getBy(textSelector(getByAltTextSelector))),
  getByPlaceholder: method(['Page', 'Locator', 'FrameLocator'], getBy(textSelector(getByPlaceholderSelector))),
  getByTitle: method(['Page', 'Locator', 'FrameLocator'], getBy(textSelector(getByTitleSelector))),
};

// JavaScript and Java share the method names.
const kJavaScriptMethods = new Map(Object.entries(kMethods));
const kPythonMethods = new Map(Object.entries(kMethods).map(([name, method]) => [name === 'and' || name === 'or' ? name + '_' : toSnakeCase(name), method]));
const kCSharpMethods = new Map(Object.entries(kMethods).map(([name, method]) => [toTitleCase(name), method]));

// Selector parts of a locator created by the target, e.g. `frameLocator.locator()`.
function childParts(target: Target, parts: ParsedSelectorPart[]): ParsedSelectorPart[] {
  if (target.type !== 'FrameLocator' || isAnyFrame(target))
    return [...target.parts, ...parts];
  return [...target.parts, selectorPart('internal:control', 'enter-frame'), ...parts];
}

function isAnyFrame(target: Target): boolean {
  return target.type === 'FrameLocator' && stringifySelector({ parts: target.parts }) === kAnyFrameSelector;
}

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

function selectorPart(name: string, body: string): ParsedSelectorPart {
  return { name, body, source: body };
}

function nestedSelectorPart(name: string, parsed: ParsedSelector): ParsedSelectorPart {
  return { name, body: { parsed }, source: JSON.stringify(stringifySelector(parsed)) };
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

function isBooleanOrMixed(value: Value): value is boolean | 'mixed' {
  return isBoolean(value) || value === 'mixed';
}

function isSelector(value: Value): value is ParsedSelector {
  return typeof value === 'object' && !(value instanceof RegExp);
}

function isStringOrSelector(value: Value): value is string | ParsedSelector {
  return isString(value) || isSelector(value);
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
