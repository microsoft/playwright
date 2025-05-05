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

import { customCSSNames } from '@isomorphic/selectorParser';
import { normalizeWhiteSpace } from '@isomorphic/stringUtils';

import { isElementVisible, parentElementOrShadowHost } from './domUtils';
import { layoutSelectorScore } from './layoutSelectorUtils';
import { elementMatchesText, elementText, shouldSkipForTextMatching } from './selectorUtils';

import type { CSSComplexSelector, CSSComplexSelectorList, CSSFunctionArgument, CSSSimpleSelector } from '@isomorphic/cssParser';
import type { LayoutSelectorName } from './layoutSelectorUtils';
import type { ElementText } from './selectorUtils';

type QueryContext = {
  scope: Element | Document;
  pierceShadow: boolean;
  // When context expands to accommodate :scope matching, original scope is saved here.
  originalScope?: Element | Document;
  // Place for more options, e.g. normalizing whitespace.
};
export type Selector = any; // Opaque selector type.
export interface SelectorEvaluator {
  query(context: QueryContext, selector: Selector): Element[];
  matches(element: Element, selector: Selector, context: QueryContext): boolean;
}
export interface SelectorEngine {
  matches?(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean;
  query?(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): Element[];
}

type QueryCache = Map<any, { rest: any[], result: any }[]>;

export class SelectorEvaluatorImpl implements SelectorEvaluator {
  private _engines: Map<string, SelectorEngine>;
  private _cacheQueryCSS: QueryCache;
  private _cacheMatches: QueryCache;
  private _cacheQuery: QueryCache;
  private _cacheMatchesSimple: QueryCache;
  private _cacheMatchesParents: QueryCache;
  private _cacheCallMatches: QueryCache;
  private _cacheCallQuery: QueryCache;
  private _cacheQuerySimple: QueryCache;
  _cacheText: Map<Element | ShadowRoot, ElementText>;
  private _scoreMap: Map<Element, number> | undefined;
  private _retainCacheCounter = 0;

  constructor() {
    this._cacheText = new Map();
    this._cacheQueryCSS = new Map();
    this._cacheMatches = new Map();
    this._cacheQuery = new Map();
    this._cacheMatchesSimple = new Map();
    this._cacheMatchesParents = new Map();
    this._cacheCallMatches = new Map();
    this._cacheCallQuery = new Map();
    this._cacheQuerySimple = new Map();

    this._engines = new Map();
    this._engines.set('not', notEngine);
    this._engines.set('is', isEngine);
    this._engines.set('where', isEngine);
    this._engines.set('has', hasEngine);
    this._engines.set('scope', scopeEngine);
    this._engines.set('light', lightEngine);
    this._engines.set('visible', visibleEngine);
    this._engines.set('text', textEngine);
    this._engines.set('text-is', textIsEngine);
    this._engines.set('text-matches', textMatchesEngine);
    this._engines.set('has-text', hasTextEngine);
    this._engines.set('right-of', createLayoutEngine('right-of'));
    this._engines.set('left-of', createLayoutEngine('left-of'));
    this._engines.set('above', createLayoutEngine('above'));
    this._engines.set('below', createLayoutEngine('below'));
    this._engines.set('near', createLayoutEngine('near'));
    this._engines.set('nth-match', nthMatchEngine);

    const allNames = [...this._engines.keys()];
    allNames.sort();
    const parserNames = [...customCSSNames];
    parserNames.sort();
    if (allNames.join('|') !== parserNames.join('|'))
      throw new Error(`Please keep customCSSNames in sync with evaluator engines: ${allNames.join('|')} vs ${parserNames.join('|')}`);
  }

  begin() {
    ++this._retainCacheCounter;
  }

  end() {
    --this._retainCacheCounter;
    if (!this._retainCacheCounter) {
      this._cacheQueryCSS.clear();
      this._cacheMatches.clear();
      this._cacheQuery.clear();
      this._cacheMatchesSimple.clear();
      this._cacheMatchesParents.clear();
      this._cacheCallMatches.clear();
      this._cacheCallQuery.clear();
      this._cacheQuerySimple.clear();
      this._cacheText.clear();
    }
  }

  private _cached<T>(cache: QueryCache, main: any, rest: any[], cb: () => T): T {
    if (!cache.has(main))
      cache.set(main, []);
    const entries = cache.get(main)!;
    const entry = entries.find(e => rest.every((value, index) => e.rest[index] === value));
    if (entry)
      return entry.result as T;
    const result = cb();
    entries.push({ rest, result });
    return result;
  }

  private _checkSelector(s: Selector): CSSComplexSelector | CSSComplexSelectorList {
    const wellFormed = typeof s === 'object' && s &&
      (Array.isArray(s) || ('simples' in s) && (s.simples.length));
    if (!wellFormed)
      throw new Error(`Malformed selector "${s}"`);
    return s as CSSComplexSelector | CSSComplexSelectorList;
  }

  matches(element: Element, s: Selector, context: QueryContext): boolean {
    const selector = this._checkSelector(s);
    this.begin();
    try {
      return this._cached<boolean>(this._cacheMatches, element, [selector, context.scope, context.pierceShadow, context.originalScope], () => {
        if (Array.isArray(selector))
          return this._matchesEngine(isEngine, element, selector, context);
        if (this._hasScopeClause(selector))
          context = this._expandContextForScopeMatching(context);
        if (!this._matchesSimple(element, selector.simples[selector.simples.length - 1].selector, context))
          return false;
        return this._matchesParents(element, selector, selector.simples.length - 2, context);
      });
    } finally {
      this.end();
    }
  }

  query(context: QueryContext, s: any): Element[] {
    const selector = this._checkSelector(s);
    this.begin();
    try {
      return this._cached<Element[]>(this._cacheQuery, selector, [context.scope, context.pierceShadow, context.originalScope], () => {
        if (Array.isArray(selector))
          return this._queryEngine(isEngine, context, selector);
        if (this._hasScopeClause(selector))
          context = this._expandContextForScopeMatching(context);

        // query() recursively calls itself, so we set up a new map for this particular query() call.
        const previousScoreMap = this._scoreMap;
        this._scoreMap = new Map();
        let elements = this._querySimple(context, selector.simples[selector.simples.length - 1].selector);
        elements = elements.filter(element => this._matchesParents(element, selector, selector.simples.length - 2, context));
        if (this._scoreMap.size) {
          elements.sort((a, b) => {
            const aScore = this._scoreMap!.get(a);
            const bScore = this._scoreMap!.get(b);
            if (aScore === bScore)
              return 0;
            if (aScore === undefined)
              return 1;
            if (bScore === undefined)
              return -1;
            return aScore - bScore;
          });
        }
        this._scoreMap = previousScoreMap;

        return elements;
      });
    } finally {
      this.end();
    }
  }

  _markScore(element: Element, score: number) {
    // HACK ALERT: temporary marks an element with a score, to be used
    // for sorting at the end of the query().
    if (this._scoreMap)
      this._scoreMap.set(element, score);
  }

  private _hasScopeClause(selector: CSSComplexSelector): boolean {
    return selector.simples.some(simple => simple.selector.functions.some(f => f.name === 'scope'));
  }

  private _expandContextForScopeMatching(context: QueryContext): QueryContext {
    if (context.scope.nodeType !== 1 /* Node.ELEMENT_NODE */)
      return context;
    const scope = parentElementOrShadowHost(context.scope as Element);
    if (!scope)
      return context;
    return { ...context, scope, originalScope: context.originalScope || context.scope };
  }

  private _matchesSimple(element: Element, simple: CSSSimpleSelector, context: QueryContext): boolean {
    return this._cached<boolean>(this._cacheMatchesSimple, element, [simple, context.scope, context.pierceShadow, context.originalScope], () => {
      if (element === context.scope)
        return false;
      if (simple.css && !this._matchesCSS(element, simple.css))
        return false;
      for (const func of simple.functions) {
        if (!this._matchesEngine(this._getEngine(func.name), element, func.args, context))
          return false;
      }
      return true;
    });
  }

  private _querySimple(context: QueryContext, simple: CSSSimpleSelector): Element[] {
    if (!simple.functions.length)
      return this._queryCSS(context, simple.css || '*');

    return this._cached<Element[]>(this._cacheQuerySimple, simple, [context.scope, context.pierceShadow, context.originalScope], () => {
      let css = simple.css;
      const funcs = simple.functions;
      if (css === '*' && funcs.length)
        css = undefined;

      let elements: Element[];
      let firstIndex = -1;
      if (css !== undefined) {
        elements = this._queryCSS(context, css);
      } else {
        firstIndex = funcs.findIndex(func => this._getEngine(func.name).query !== undefined);
        if (firstIndex === -1)
          firstIndex = 0;
        elements = this._queryEngine(this._getEngine(funcs[firstIndex].name), context, funcs[firstIndex].args);
      }
      for (let i = 0; i < funcs.length; i++) {
        if (i === firstIndex)
          continue;
        const engine = this._getEngine(funcs[i].name);
        if (engine.matches !== undefined)
          elements = elements.filter(e => this._matchesEngine(engine, e, funcs[i].args, context));
      }
      for (let i = 0; i < funcs.length; i++) {
        if (i === firstIndex)
          continue;
        const engine = this._getEngine(funcs[i].name);
        if (engine.matches === undefined)
          elements = elements.filter(e => this._matchesEngine(engine, e, funcs[i].args, context));
      }
      return elements;
    });
  }

  private _matchesParents(element: Element, complex: CSSComplexSelector, index: number, context: QueryContext): boolean {
    if (index < 0)
      return true;
    return this._cached<boolean>(this._cacheMatchesParents, element, [complex, index, context.scope, context.pierceShadow, context.originalScope], () => {
      const { selector: simple, combinator } = complex.simples[index];
      if (combinator === '>') {
        const parent = parentElementOrShadowHostInContext(element, context);
        if (!parent || !this._matchesSimple(parent, simple, context))
          return false;
        return this._matchesParents(parent, complex, index - 1, context);
      }
      if (combinator === '+') {
        const previousSibling = previousSiblingInContext(element, context);
        if (!previousSibling || !this._matchesSimple(previousSibling, simple, context))
          return false;
        return this._matchesParents(previousSibling, complex, index - 1, context);
      }
      if (combinator === '') {
        let parent = parentElementOrShadowHostInContext(element, context);
        while (parent) {
          if (this._matchesSimple(parent, simple, context)) {
            if (this._matchesParents(parent, complex, index - 1, context))
              return true;
            if (complex.simples[index - 1].combinator === '')
              break;
          }
          parent = parentElementOrShadowHostInContext(parent, context);
        }
        return false;
      }
      if (combinator === '~') {
        let previousSibling = previousSiblingInContext(element, context);
        while (previousSibling) {
          if (this._matchesSimple(previousSibling, simple, context)) {
            if (this._matchesParents(previousSibling, complex, index - 1, context))
              return true;
            if (complex.simples[index - 1].combinator === '~')
              break;
          }
          previousSibling = previousSiblingInContext(previousSibling, context);
        }
        return false;
      }
      if (combinator === '>=') {
        let parent: Element | undefined = element;
        while (parent) {
          if (this._matchesSimple(parent, simple, context)) {
            if (this._matchesParents(parent, complex, index - 1, context))
              return true;
            if (complex.simples[index - 1].combinator === '')
              break;
          }
          parent = parentElementOrShadowHostInContext(parent, context);
        }
        return false;
      }
      throw new Error(`Unsupported combinator "${combinator}"`);
    });
  }

  private _matchesEngine(engine: SelectorEngine, element: Element, args: CSSFunctionArgument[], context: QueryContext): boolean {
    if (engine.matches)
      return this._callMatches(engine, element, args, context);
    if (engine.query)
      return this._callQuery(engine, args, context).includes(element);
    throw new Error(`Selector engine should implement "matches" or "query"`);
  }

  private _queryEngine(engine: SelectorEngine, context: QueryContext, args: CSSFunctionArgument[]): Element[] {
    if (engine.query)
      return this._callQuery(engine, args, context);
    if (engine.matches)
      return this._queryCSS(context, '*').filter(element => this._callMatches(engine, element, args, context));
    throw new Error(`Selector engine should implement "matches" or "query"`);
  }

  private _callMatches(engine: SelectorEngine, element: Element, args: CSSFunctionArgument[], context: QueryContext): boolean {
    return this._cached<boolean>(this._cacheCallMatches, element, [engine, context.scope, context.pierceShadow, context.originalScope, ...args], () => {
      return engine.matches!(element, args, context, this);
    });
  }

  private _callQuery(engine: SelectorEngine, args: CSSFunctionArgument[], context: QueryContext): Element[] {
    return this._cached<Element[]>(this._cacheCallQuery, engine, [context.scope, context.pierceShadow, context.originalScope, ...args], () => {
      return engine.query!(context, args, this);
    });
  }

  private _matchesCSS(element: Element, css: string): boolean {
    return element.matches(css);
  }

  _queryCSS(context: QueryContext, css: string): Element[] {
    return this._cached<Element[]>(this._cacheQueryCSS, css, [context.scope, context.pierceShadow, context.originalScope], () => {
      let result: Element[] = [];
      function query(root: Element | ShadowRoot | Document) {
        result = result.concat([...root.querySelectorAll(css)]);
        if (!context.pierceShadow)
          return;
        if ((root as Element).shadowRoot)
          query((root as Element).shadowRoot!);
        for (const element of root.querySelectorAll('*')) {
          if (element.shadowRoot)
            query(element.shadowRoot);
        }
      }
      query(context.scope);
      return result;
    });
  }

  private _getEngine(name: string): SelectorEngine {
    const engine = this._engines.get(name);
    if (!engine)
      throw new Error(`Unknown selector engine "${name}"`);
    return engine;
  }
}

const isEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length === 0)
      throw new Error(`"is" engine expects non-empty selector list`);
    return args.some(selector => evaluator.matches(element, selector, context));
  },

  query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): Element[] {
    if (args.length === 0)
      throw new Error(`"is" engine expects non-empty selector list`);
    let elements: Element[] = [];
    for (const arg of args)
      elements = elements.concat(evaluator.query(context, arg));
    return args.length === 1 ? elements : sortInDOMOrder(elements);
  },
};

const hasEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length === 0)
      throw new Error(`"has" engine expects non-empty selector list`);
    return evaluator.query({ ...context, scope: element }, args).length > 0;
  },

  // TODO: we can implement efficient "query" by matching "args" and returning
  // all parents/descendants, just have to be careful with the ":scope" matching.
};

const scopeEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length !== 0)
      throw new Error(`"scope" engine expects no arguments`);
    const actualScope = context.originalScope || context.scope;
    if (actualScope.nodeType === 9 /* Node.DOCUMENT_NODE */)
      return element === (actualScope as Document).documentElement;
    return element === actualScope;
  },

  query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): Element[] {
    if (args.length !== 0)
      throw new Error(`"scope" engine expects no arguments`);
    const actualScope = context.originalScope || context.scope;
    if (actualScope.nodeType === 9 /* Node.DOCUMENT_NODE */) {
      const root = (actualScope as Document).documentElement;
      return root ? [root] : [];
    }
    if (actualScope.nodeType === 1 /* Node.ELEMENT_NODE */)
      return [actualScope as Element];
    return [];
  },
};

const notEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length === 0)
      throw new Error(`"not" engine expects non-empty selector list`);
    return !evaluator.matches(element, args, context);
  },
};

const lightEngine: SelectorEngine = {
  query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): Element[] {
    return evaluator.query({ ...context, pierceShadow: false }, args);
  },

  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    return evaluator.matches(element, args, { ...context, pierceShadow: false });
  }
};

const visibleEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length)
      throw new Error(`"visible" engine expects no arguments`);
    return isElementVisible(element);
  }
};

const textEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length !== 1 || typeof args[0] !== 'string')
      throw new Error(`"text" engine expects a single string`);
    const text = normalizeWhiteSpace(args[0]).toLowerCase();
    const matcher = (elementText: ElementText) => elementText.normalized.toLowerCase().includes(text);
    return elementMatchesText((evaluator as SelectorEvaluatorImpl)._cacheText, element, matcher) === 'self';
  },
};

const textIsEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length !== 1 || typeof args[0] !== 'string')
      throw new Error(`"text-is" engine expects a single string`);
    const text = normalizeWhiteSpace(args[0]);
    const matcher = (elementText: ElementText) => {
      if (!text && !elementText.immediate.length)
        return true;
      return elementText.immediate.some(s => normalizeWhiteSpace(s) === text);
    };
    return elementMatchesText((evaluator as SelectorEvaluatorImpl)._cacheText, element, matcher) !== 'none';
  },
};

const textMatchesEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length === 0 || typeof args[0] !== 'string' || args.length > 2 || (args.length === 2 && typeof args[1] !== 'string'))
      throw new Error(`"text-matches" engine expects a regexp body and optional regexp flags`);
    const re = new RegExp(args[0], args.length === 2 ? args[1] : undefined);
    const matcher = (elementText: ElementText) => re.test(elementText.full);
    return elementMatchesText((evaluator as SelectorEvaluatorImpl)._cacheText, element, matcher) === 'self';
  },
};

const hasTextEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length !== 1 || typeof args[0] !== 'string')
      throw new Error(`"has-text" engine expects a single string`);
    if (shouldSkipForTextMatching(element))
      return false;
    const text = normalizeWhiteSpace(args[0]).toLowerCase();
    const matcher = (elementText: ElementText) => elementText.normalized.toLowerCase().includes(text);
    return matcher(elementText((evaluator as SelectorEvaluatorImpl)._cacheText, element));
  },
};

function createLayoutEngine(name: LayoutSelectorName): SelectorEngine {
  return {
    matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
      const maxDistance = args.length && typeof args[args.length - 1] === 'number' ? args[args.length - 1] : undefined;
      const queryArgs = maxDistance === undefined ? args : args.slice(0, args.length - 1);
      if (args.length < 1 + (maxDistance === undefined ? 0 : 1))
        throw new Error(`"${name}" engine expects a selector list and optional maximum distance in pixels`);
      const inner = evaluator.query(context, queryArgs);
      const score = layoutSelectorScore(name, element, inner, maxDistance);
      if (score === undefined)
        return false;
      (evaluator as SelectorEvaluatorImpl)._markScore(element, score);
      return true;
    }
  };
}

const nthMatchEngine: SelectorEngine = {
  query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): Element[] {
    let index = args[args.length - 1];
    if (args.length < 2)
      throw new Error(`"nth-match" engine expects non-empty selector list and an index argument`);
    if (typeof index !== 'number' || index < 1)
      throw new Error(`"nth-match" engine expects a one-based index as the last argument`);
    const elements = isEngine.query!(context, args.slice(0, args.length - 1), evaluator);
    index--;  // one-based
    return index < elements.length ? [elements[index]] : [];
  },
};

function parentElementOrShadowHostInContext(element: Element, context: QueryContext): Element | undefined {
  if (element === context.scope)
    return;
  if (!context.pierceShadow)
    return element.parentElement || undefined;
  return parentElementOrShadowHost(element);
}

function previousSiblingInContext(element: Element, context: QueryContext): Element | undefined {
  if (element === context.scope)
    return;
  return element.previousElementSibling || undefined;
}

export function sortInDOMOrder(elements: Iterable<Element>): Element[] {
  type SortEntry = { children: Element[], taken: boolean };

  const elementToEntry = new Map<Element, SortEntry>();
  const roots: Element[] = [];
  const result: Element[] = [];

  function append(element: Element): SortEntry {
    let entry = elementToEntry.get(element);
    if (entry)
      return entry;
    const parent = parentElementOrShadowHost(element);
    if (parent) {
      const parentEntry = append(parent);
      parentEntry.children.push(element);
    } else {
      roots.push(element);
    }
    entry = { children: [], taken: false };
    elementToEntry.set(element, entry);
    return entry;
  }
  for (const e of elements)
    append(e).taken = true;

  function visit(element: Element) {
    const entry = elementToEntry.get(element)!;
    if (entry.taken)
      result.push(element);
    if (entry.children.length > 1) {
      const set = new Set(entry.children);
      entry.children = [];
      let child = element.firstElementChild;
      while (child && entry.children.length < set.size) {
        if (set.has(child))
          entry.children.push(child);
        child = child.nextElementSibling;
      }
      child = element.shadowRoot ? element.shadowRoot.firstElementChild : null;
      while (child && entry.children.length < set.size) {
        if (set.has(child))
          entry.children.push(child);
        child = child.nextElementSibling;
      }
    }
    entry.children.forEach(visit);
  }
  roots.forEach(visit);

  return result;
}
