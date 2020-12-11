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

import { CSSComplexSelector, CSSSimpleSelector, CSSComplexSelectorList, CSSFunctionArgument } from '../common/cssParser';

export type QueryContext = {
  scope: Element | Document;
  pierceShadow: boolean;
  // Place for more options, e.g. normalizing whitespace.
};
export type Selector = any; // Opaque selector type.
export type QueryResult = { element: Element, score: number };
export interface SelectorEvaluator {
  query(context: QueryContext, selector: Selector): QueryResult[];
  matches(element: Element, selector: Selector, context: QueryContext): number;
}
export interface SelectorEngine {
  matches?(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number;
  query?(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): QueryResult[];
}

type QueryCache = Map<any, { rest: any[], result: any }[]>;
const kNoMatchThreshold = 0.01;
export class SelectorEvaluatorImpl implements SelectorEvaluator {
  private _engines = new Map<string, SelectorEngine>();
  private _cacheQueryCSS: QueryCache = new Map();
  private _cacheMatches: QueryCache = new Map();
  private _cacheQuery: QueryCache = new Map();
  private _cacheMatchesSimple: QueryCache = new Map();
  private _cacheMatchesParents: QueryCache = new Map();
  private _cacheCallMatches: QueryCache = new Map();
  private _cacheCallQuery: QueryCache = new Map();
  private _cacheQuerySimple: QueryCache = new Map();

  constructor(extraEngines: Map<string, SelectorEngine>) {
    // Note: keep predefined names in sync with Selectors class.
    for (const [name, engine] of extraEngines)
      this._engines.set(name, engine);
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
    this._engines.set('xpath', xpathEngine);
    for (const attr of ['id', 'data-testid', 'data-test-id', 'data-test'])
      this._engines.set(attr, createAttributeEngine(attr));
  }

  // This is the only function we should use for querying, because it does
  // the right thing with caching.
  evaluate(context: QueryContext, s: CSSComplexSelectorList): Element[] {
    const results = this.query(context, s);
    this._cacheQueryCSS.clear();
    this._cacheMatches.clear();
    this._cacheQuery.clear();
    this._cacheMatchesSimple.clear();
    this._cacheMatchesParents.clear();
    this._cacheCallMatches.clear();
    this._cacheCallQuery.clear();
    this._cacheQuerySimple.clear();
    return results.map(result => result.element);
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

  matches(element: Element, s: Selector, context: QueryContext): number {
    const selector = this._checkSelector(s);
    return this._cached<number>(this._cacheMatches, element, [selector, context], () => {
      if (Array.isArray(selector)) {
        const scores = selector.map(s => this.matches(element, s, context));
        return Math.max(...scores);
      }
      let score = this._matchesSimple(element, selector.simples[selector.simples.length - 1].selector, context);
      if (score <= kNoMatchThreshold)
        return 0;
      score *= this._matchesParents(element, selector, selector.simples.length - 2, context);
      return score > kNoMatchThreshold ? score : 0;
    });
  }

  query(context: QueryContext, s: any): QueryResult[] {
    const selector = this._checkSelector(s);
    return this._cached<QueryResult[]>(this._cacheQuery, selector, [context], () => {
      let results: QueryResult[] = [];
      let pureCSS = false;
      if (Array.isArray(selector)) {
        if (selector.length === 1)
          return this.query(context, selector[0]);
        const bestScore = new Map<Element, number>();
        for (const s of selector) {
          for (const result of this.query(context, s))
            bestScore.set(result.element, Math.max(bestScore.get(result.element) || 0, result.score));
        }
        for (const [element, score] of bestScore)
          results.push({ element, score });
      } else {
        results = this._querySimple(context, selector.simples[selector.simples.length - 1].selector);
        for (const result of results)
          result.score *= this._matchesParents(result.element, selector, selector.simples.length - 2, context);
        pureCSS = selector.simples.every(simple => !simple.selector.functions.length);
      }
      results = results.filter(result => result.score > kNoMatchThreshold);
      if (!pureCSS)
        results = sortInDOMOrder(results);
      return results;
    });
  }

  private _matchesSimple(element: Element, simple: CSSSimpleSelector, context: QueryContext): number {
    return this._cached<number>(this._cacheMatchesSimple, element, [simple, context], () => {
      const isPossiblyScopeClause = simple.functions.some(f => f.name === 'scope' || f.name === 'is');
      if (!isPossiblyScopeClause && element === context.scope)
        return 0;
      if (simple.css && !this._matchesCSS(element, simple.css))
        return 0;
      let score = 1;
      for (const func of simple.functions) {
        score *= this._matchesEngine(this._getEngine(func.name), element, func.args, context);
        if (score <= kNoMatchThreshold)
          return 0;
      }
      return score;
    });
  }

  private _querySimple(context: QueryContext, simple: CSSSimpleSelector): QueryResult[] {
    if (!simple.functions.length)
      return this._queryCSS(context, simple.css || '*').map(element => ({ element, score: 1 }));

    return this._cached<QueryResult[]>(this._cacheQuerySimple, simple, [context], () => {
      let css = simple.css;
      const funcs = simple.functions;
      if (css === '*' && funcs.length)
        css = undefined;

      let results: QueryResult[];
      let firstIndex = -1;
      if (css !== undefined) {
        results = this._queryCSS(context, css).map(element => ({ element, score: 1 }));
      } else {
        firstIndex = funcs.findIndex(func => this._getEngine(func.name).query !== undefined);
        if (firstIndex === -1)
          firstIndex = 0;
        results = this._queryEngine(this._getEngine(funcs[firstIndex].name), context, funcs[firstIndex].args);
      }
      for (let i = 0; i < funcs.length; i++) {
        if (i === firstIndex)
          continue;
        const engine = this._getEngine(funcs[i].name);
        if (engine.matches !== undefined) {
          results.forEach(result => result.score *= this._matchesEngine(engine, result.element, funcs[i].args, context));
          results = results.filter(result => result.score > kNoMatchThreshold);
        }
      }
      for (let i = 0; i < funcs.length; i++) {
        if (i === firstIndex)
          continue;
        const engine = this._getEngine(funcs[i].name);
        if (engine.matches === undefined) {
          results.forEach(result => result.score *= this._matchesEngine(engine, result.element, funcs[i].args, context));
          results = results.filter(result => result.score > kNoMatchThreshold);
        }
      }
      return results;
    });
  }

  private _matchesParents(element: Element, complex: CSSComplexSelector, index: number, context: QueryContext): number {
    if (index < 0)
      return 1;
    return this._cached<number>(this._cacheMatchesParents, element, [complex, index, context], () => {
      const { selector: simple, combinator } = complex.simples[index];
      if (combinator === '>') {
        const parent = parentElementOrShadowHostInContext(element, context);
        if (!parent)
          return 0;
        let score = this._matchesSimple(parent, simple, context);
        if (score <= kNoMatchThreshold)
          return 0;
        score *= this._matchesParents(parent, complex, index - 1, context);
        return score > kNoMatchThreshold ? score : 0;
      }
      if (combinator === '+') {
        const previousSibling = previousSiblingInContext(element, context);
        if (!previousSibling)
          return 0;
        let score = this._matchesSimple(previousSibling, simple, context);
        if (score <= kNoMatchThreshold)
          return 0;
        score *= this._matchesParents(previousSibling, complex, index - 1, context);
        return score > kNoMatchThreshold ? score : 0;
      }
      if (combinator === '') {
        let parent = parentElementOrShadowHostInContext(element, context);
        while (parent) {
          let score = this._matchesSimple(parent, simple, context);
          if (score > kNoMatchThreshold) {
            score *= this._matchesParents(parent, complex, index - 1, context);
            if (score > kNoMatchThreshold)
              return score;
            if (complex.simples[index - 1].combinator === '')
              break;
          }
          parent = parentElementOrShadowHostInContext(parent, context);
        }
        return 0;
      }
      if (combinator === '~') {
        let previousSibling = previousSiblingInContext(element, context);
        while (previousSibling) {
          let score = this._matchesSimple(previousSibling, simple, context);
          if (score > kNoMatchThreshold) {
            score *= this._matchesParents(previousSibling, complex, index - 1, context);
            if (score > kNoMatchThreshold)
              return score;
            if (complex.simples[index - 1].combinator === '~')
              break;
          }
          previousSibling = previousSiblingInContext(previousSibling, context);
        }
        return 0;
      }
      if (combinator === '>=') {
        let parent: Element | undefined = element;
        while (parent) {
          let score = this._matchesSimple(parent, simple, context);
          if (score > kNoMatchThreshold) {
            score *= this._matchesParents(parent, complex, index - 1, context);
            if (score > kNoMatchThreshold)
              return score;
            if (complex.simples[index - 1].combinator === '')
              break;
          }
          parent = parentElementOrShadowHostInContext(parent, context);
        }
        return 0;
      }
      throw new Error(`Unsupported combinator "${combinator}"`);
    });
  }

  private _matchesEngine(engine: SelectorEngine, element: Element, args: CSSFunctionArgument[], context: QueryContext): number {
    if (engine.matches)
      return this._callMatches(engine, element, args, context);
    if (engine.query) {
      const result = this._callQuery(engine, args, context).find(result => result.element === element);
      return result ? result.score : 0;
    }
    throw new Error(`Selector engine should implement "matches" or "query"`);
  }

  private _queryEngine(engine: SelectorEngine, context: QueryContext, args: CSSFunctionArgument[]): QueryResult[] {
    if (engine.query)
      return this._callQuery(engine, args, context);
    if (engine.matches) {
      return this._queryCSS(context, '*').map(element => {
        const score = this._callMatches(engine, element, args, context);
        return { element, score };
      }).filter(result => result.score > kNoMatchThreshold);
    }
    throw new Error(`Selector engine should implement "matches" or "query"`);
  }

  private _callMatches(engine: SelectorEngine, element: Element, args: CSSFunctionArgument[], context: QueryContext): number {
    return this._cached<number>(this._cacheCallMatches, element, [engine, args, context.scope, context.pierceShadow], () => {
      const score = engine.matches!(element, args, context, this);
      return score > kNoMatchThreshold ? score : 0;
    });
  }

  private _callQuery(engine: SelectorEngine, args: CSSFunctionArgument[], context: QueryContext): QueryResult[] {
    return this._cached<QueryResult[]>(this._cacheCallQuery, args, [engine, context.scope, context.pierceShadow], () => {
      return engine.query!(context, args, this);
    });
  }

  private _matchesCSS(element: Element, css: string): boolean {
    return element.matches(css);
  }

  _queryCSS(context: QueryContext, css: string): Element[] {
    return this._cached<Element[]>(this._cacheQueryCSS, css, [context], () => {
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
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    if (args.length === 0)
      throw new Error(`"is" engine expects non-empty selector list`);
    return evaluator.matches(element, args, context);
  },

  query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): QueryResult[] {
    if (args.length === 0)
      throw new Error(`"is" engine expects non-empty selector list`);
    return evaluator.query(context, args);
  },
};

const hasEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    if (args.length === 0)
      throw new Error(`"has" engine expects non-empty selector list`);
    const results = evaluator.query({ ...context, scope: element }, args);
    return results.length ? results[0].score : 0;
  },

  // TODO: we do not implement "relative selectors", as in "div:has(> span)" or "div:has(+ span)".

  // TODO: we can implement efficient "query" by matching "args" and returning
  // all parents/descendants, just have to be careful with the ":scope" matching.
};

const scopeEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    if (args.length !== 0)
      throw new Error(`"scope" engine expects no arguments`);
    if (context.scope.nodeType === 9 /* Node.DOCUMENT_NODE */)
      return element === (context.scope as Document).documentElement ? 1 : 0;
    return element === context.scope ? 1 : 0;
  },

  query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): QueryResult[] {
    if (args.length !== 0)
      throw new Error(`"scope" engine expects no arguments`);
    if (context.scope.nodeType === 9 /* Node.DOCUMENT_NODE */) {
      const root = (context.scope as Document).documentElement;
      return root ? [{ element: root, score: 1 }] : [];
    }
    if (context.scope.nodeType === 1 /* Node.ELEMENT_NODE */)
      return [{ element: context.scope as Element, score: 1}];
    return [];
  },
};

const notEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    if (args.length === 0)
      throw new Error(`"not" engine expects non-empty selector list`);
    return evaluator.matches(element, args, context) <= kNoMatchThreshold ? 1 : 0;
  },
};

const lightEngine: SelectorEngine = {
  query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): QueryResult[] {
    return evaluator.query({ ...context, pierceShadow: false }, args);
  },

  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    return evaluator.matches(element, args, { ...context, pierceShadow: false });
  }
};

const visibleEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    if (args.length)
      throw new Error(`"visible" engine expects no arguments`);
    return isVisible(element) ? 1 : 0;
  }
};

const textEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    if (args.length === 0 || typeof args[0] !== 'string')
      throw new Error(`"text" engine expects a single string`);
    return elementMatchesText(element, context, textMatcher(args[0], true)) ? 1 : 0;
  },
};

const textIsEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    if (args.length === 0 || typeof args[0] !== 'string')
      throw new Error(`"text-is" engine expects a single string`);
    return elementMatchesText(element, context, textMatcher(args[0], false)) ? 1 : 0;
  },
};

const textMatchesEngine: SelectorEngine = {
  matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
    if (args.length === 0 || typeof args[0] !== 'string' || args.length > 2 || (args.length === 2 && typeof args[1] !== 'string'))
      throw new Error(`"text-matches" engine expects a regexp body and optional regexp flags`);
    const re = new RegExp(args[0], args.length === 2 ? args[1] : undefined);
    return elementMatchesText(element, context, s => re.test(s)) ? 1 : 0;
  },
};

function textMatcher(text: string, substring: boolean): (s: string) => boolean {
  text = text.trim().replace(/\s+/g, ' ');
  text = text.toLowerCase();
  return (s: string) => {
    s = s.trim().replace(/\s+/g, ' ');
    s = s.toLowerCase();
    return substring ? s.includes(text) : s === text;
  };
}

// TODO: make this return a number?
function elementMatchesText(element: Element, context: QueryContext, matcher: (s: string) => boolean) {
  if (element.nodeName === 'SCRIPT' || element.nodeName === 'STYLE' || document.head && document.head.contains(element))
    return false;
  if ((element instanceof HTMLInputElement) && (element.type === 'submit' || element.type === 'button') && matcher(element.value))
    return true;
  let lastText = '';
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 3 /* Node.TEXT_NODE */) {
      lastText += child.nodeValue;
    } else {
      if (lastText && matcher(lastText))
        return true;
      lastText = '';
    }
  }
  return !!lastText && matcher(lastText);
}

const xpathEngine: SelectorEngine = {
  query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): QueryResult[] {
    if (args.length !== 1 || typeof args[0] !== 'string')
      throw new Error(`"xpath" engine expects a single string`);
    const document = context.scope.nodeType === 9 /* Node.DOCUMENT_NODE */ ? context.scope as Document : context.scope.ownerDocument;
    if (!document)
      return [];
    const result: QueryResult[] = [];
    const it = document.evaluate(args[0], context.scope, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    for (let node = it.iterateNext(); node; node = it.iterateNext()) {
      if (node.nodeType === 1 /* Node.ELEMENT_NODE */)
        result.push({ element: node as Element, score: 1 });
    }
    return result;
  },
};

function createAttributeEngine(attr: string): SelectorEngine {
  return {
    matches(element: Element, args: (string | number | Selector)[], context: QueryContext, evaluator: SelectorEvaluator): number {
      if (args.length === 0 || typeof args[0] !== 'string')
        throw new Error(`"${attr}" engine expects a single string`);
      return element.getAttribute(attr) === args[0] ? 1 : 0;
    },

    query(context: QueryContext, args: (string | number | Selector)[], evaluator: SelectorEvaluator): QueryResult[] {
      if (args.length !== 1 || typeof args[0] !== 'string')
        throw new Error(`"${attr}" engine expects a single string`);
      const css = `[${attr}=${CSS.escape(args[0])}]`;
      return (evaluator as SelectorEvaluatorImpl)._queryCSS(context, css).map(element => ({ element, score: 1 }));
    },
  };
}

export function parentElementOrShadowHost(element: Element): Element | undefined {
  if (element.parentElement)
    return element.parentElement;
  if (!element.parentNode)
    return;
  if (element.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (element.parentNode as ShadowRoot).host)
    return (element.parentNode as ShadowRoot).host;
}

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

export function isVisible(element: Element): boolean {
  // Note: this logic should be similar to waitForDisplayedAtStablePosition() to avoid surprises.
  if (!element.ownerDocument || !element.ownerDocument.defaultView)
    return true;
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  if (!style || style.visibility === 'hidden')
    return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function sortInDOMOrder(results: QueryResult[]): QueryResult[] {
  if (results.length <= 1)
    return results;

  type SortEntry = { children: Element[], score: number };

  const elementToEntry = new Map<Element, SortEntry>();
  const roots: Element[] = [];
  const sorted: QueryResult[] = [];

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
    entry = { children: [], score: 0 };
    elementToEntry.set(element, entry);
    return entry;
  }
  results.forEach(result => {
    const entry = append(result.element);
    entry.score = Math.max(entry.score, result.score);
  });

  function visit(element: Element) {
    const entry = elementToEntry.get(element)!;
    if (entry.score > kNoMatchThreshold)
      sorted.push({ element, score: entry.score });
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

  // Sort is stable, so we preserve the DOM order between results with the same score.
  sorted.sort((a, b) => b.score - a.score);
  return sorted;
}
