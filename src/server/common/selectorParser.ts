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

import { CSSComplexSelector, CSSComplexSelectorList, CSSFunctionArgument, CSSSimpleSelector, parseCSS } from './cssParser';

export type ParsedSelectorV1 = {
  parts: {
    name: string,
    body: string,
  }[],
  capture?: number,
};

export type ParsedSelector = {
  v1?: ParsedSelectorV1,
  v2?: CSSComplexSelectorList,
  names: string[],
};

export function selectorsV2Enabled() {
  return true;
}

export function selectorsV2EngineNames() {
  return ['not', 'is', 'where', 'has', 'scope', 'light', 'visible', 'text-matches', 'text-is'];
}

export function parseSelector(selector: string, customNames: Set<string>): ParsedSelector {
  const v1 = parseSelectorV1(selector);
  const names = new Set<string>();
  for (const { name } of v1.parts) {
    names.add(name);
    if (!customNames.has(name))
      throw new Error(`Unknown engine "${name}" while parsing selector ${selector}`);
  }

  if (!selectorsV2Enabled()) {
    return {
      v1,
      names: Array.from(names),
    };
  }

  const chain = (from: number, to: number, turnFirstTextIntoScope: boolean): CSSComplexSelector => {
    const result: CSSComplexSelector = { simples: [] };
    for (const part of v1.parts.slice(from, to)) {
      let name = part.name;
      let wrapInLight = false;
      if (['css:light', 'xpath:light', 'text:light', 'id:light', 'data-testid:light', 'data-test-id:light', 'data-test:light'].includes(name)) {
        wrapInLight = true;
        name = name.substring(0, name.indexOf(':'));
      }
      if (name === 'css') {
        const parsed = parseCSS(part.body, customNames);
        parsed.names.forEach(name => names.add(name));
        if (wrapInLight || parsed.selector.length > 1) {
          let simple = callWith('is', parsed.selector);
          if (wrapInLight)
            simple = callWith('light', [simpleToComplex(simple)]);
          result.simples.push({ selector: simple, combinator: '' });
        } else {
          result.simples.push(...parsed.selector[0].simples);
        }
      } else if (name === 'text') {
        let simple = textSelectorToSimple(part.body);
        if (turnFirstTextIntoScope)
          simple.functions.push({ name: 'is', args: [ simpleToComplex(callWith('scope', [])), simpleToComplex({ css: '*', functions: [] }) ]});
        if (result.simples.length)
          result.simples[result.simples.length - 1].combinator = '>=';
        if (wrapInLight)
          simple = callWith('light', [simpleToComplex(simple)]);
        result.simples.push({ selector: simple, combinator: '' });
      } else {
        let simple = callWith(name, [part.body]);
        if (wrapInLight)
          simple = callWith('light', [simpleToComplex(simple)]);
        result.simples.push({ selector: simple, combinator: '' });
      }
      if (name !== 'text')
        turnFirstTextIntoScope = false;
    }
    return result;
  };

  const capture = v1.capture === undefined ? v1.parts.length - 1 : v1.capture;
  const result = chain(0, capture + 1, false);
  if (capture + 1 < v1.parts.length) {
    const has = chain(capture + 1, v1.parts.length, true);
    const last = result.simples[result.simples.length - 1];
    last.selector.functions.push({ name: 'has', args: [has] });
  }
  return { v2: [result], names: Array.from(names) };
}

function callWith(name: string, args: CSSFunctionArgument[]): CSSSimpleSelector {
  return { functions: [{ name, args }] };
}

function simpleToComplex(simple: CSSSimpleSelector): CSSComplexSelector {
  return { simples: [{ selector: simple, combinator: '' }]};
}

function textSelectorToSimple(selector: string): CSSSimpleSelector {
  function unescape(s: string): string {
    if (!s.includes('\\'))
      return s;
    const r: string[] = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === '\\' && i + 1 < s.length)
        i++;
      r.push(s[i++]);
    }
    return r.join('');
  }

  function escapeRegExp(s: string) {
    return s.replace(/[.*+\?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '\\x2d');
  }

  let functionName = 'text-matches';
  let args: string[];
  if (selector.length > 1 && selector[0] === '"' && selector[selector.length - 1] === '"') {
    args = ['^' + escapeRegExp(unescape(selector.substring(1, selector.length - 1))) + '$'];
  } else if (selector.length > 1 && selector[0] === "'" && selector[selector.length - 1] === "'") {
    args = ['^' + escapeRegExp(unescape(selector.substring(1, selector.length - 1))) + '$'];
  } else if (selector[0] === '/' && selector.lastIndexOf('/') > 0) {
    const lastSlash = selector.lastIndexOf('/');
    args = [selector.substring(1, lastSlash), selector.substring(lastSlash + 1)];
  } else {
    functionName = 'text';
    args = [selector];
  }
  return callWith(functionName, args);
}

function parseSelectorV1(selector: string): ParsedSelectorV1 {
  let index = 0;
  let quote: string | undefined;
  let start = 0;
  const result: ParsedSelectorV1 = { parts: [] };
  const append = () => {
    const part = selector.substring(start, index).trim();
    const eqIndex = part.indexOf('=');
    let name: string;
    let body: string;
    if (eqIndex !== -1 && part.substring(0, eqIndex).trim().match(/^[a-zA-Z_0-9-+:*]+$/)) {
      name = part.substring(0, eqIndex).trim();
      body = part.substring(eqIndex + 1);
    } else if (part.length > 1 && part[0] === '"' && part[part.length - 1] === '"') {
      name = 'text';
      body = part;
    } else if (part.length > 1 && part[0] === "'" && part[part.length - 1] === "'") {
      name = 'text';
      body = part;
    } else if (/^\(*\/\//.test(part) || part.startsWith('..')) {
      // If selector starts with '//' or '//' prefixed with multiple opening
      // parenthesis, consider xpath. @see https://github.com/microsoft/playwright/issues/817
      // If selector starts with '..', consider xpath as well.
      name = 'xpath';
      body = part;
    } else {
      name = 'css';
      body = part;
    }
    let capture = false;
    if (name[0] === '*') {
      capture = true;
      name = name.substring(1);
    }
    result.parts.push({ name, body });
    if (capture) {
      if (result.capture !== undefined)
        throw new Error(`Only one of the selectors can capture using * modifier`);
      result.capture = result.parts.length - 1;
    }
  };

  if (!selector.includes('>>')) {
    index = selector.length;
    append();
    return result;
  }

  while (index < selector.length) {
    const c = selector[index];
    if (c === '\\' && index + 1 < selector.length) {
      index += 2;
    } else if (c === quote) {
      quote = undefined;
      index++;
    } else if (!quote && (c === '"' || c === '\'' || c === '`')) {
      quote = c;
      index++;
    } else if (!quote && c === '>' && selector[index + 1] === '>') {
      append();
      index += 2;
      start = index;
    } else {
      index++;
    }
  }
  append();
  return result;
}
