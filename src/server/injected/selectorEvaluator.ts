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
  scope: Element | ShadowRoot | Document;
  // Place for more options, e.g. normalizing whitespace or piercing shadow.
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

export class SelectorEvaluatorImpl implements SelectorEvaluator {
  private _engines = new Map<string, SelectorEngine>();
  private _cache = new Map<any, { rest: any[], result: any }[]>();

  constructor(extraEngines: Map<string, SelectorEngine>) {
    for (const [name, engine] of extraEngines)
      this._engines.set(name, engine);
    this._engines.set('not', notEngine);
    this._engines.set('is', isEngine);
    this._engines.set('where', isEngine);
    this._engines.set('has', hasEngine);
    this._engines.set('scope', scopeEngine);
    // TODO: host
    // TODO: host-context?
  }

  // This is the only function we should use for querying, because it does
  // the right thing with caching
  evaluate(context: QueryContext, s: CSSComplexSelectorList): Element[] {
    const result = this.query(context, s);
    this._cache.clear();
    return result;
  }

  private _cached<T>(main: any, rest: any[], cb: () => T): T {
    if (!this._cache.has(main))
      this._cache.set(main, []);
    const entries = this._cache.get(main)!;
    const entry = entries.find(e => {
      return e.rest.length === rest.length &&
          rest.findIndex((value, index) => e.rest[index] !== value) === -1;
    });
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
    return this._cached<boolean>(element, ['matches', selector, context], () => {
      if (Array.isArray(selector))
        return this._matchesEngine(isEngine, element, selector, context);
      if (!this._matchesSimple(element, selector.simples[selector.simples.length - 1].selector, context))
        return false;
      return this._matchesParents(element, selector, selector.simples.length - 2, context);
    });
  }

  query(context: QueryContext, s: any): Element[] {
    const selector = this._checkSelector(s);
    return this._cached<Element[]>(selector, ['query', context], () => {
      if (Array.isArray(selector))
        return this._queryEngine(isEngine, context, selector);
      const elements = this._querySimple(context, selector.simples[selector.simples.length - 1].selector);
      return elements.filter(element => this._matchesParents(element, selector, selector.simples.length - 2, context));
    });
  }

  private _matchesSimple(element: Element, simple: CSSSimpleSelector, context: QueryContext): boolean {
    return this._cached<boolean>(element, ['_matchesSimple', simple, context], () => {
      const isScopeClause = simple.functions.some(f => f.name === 'scope');
      if (!isScopeClause && element === context.scope)
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
    return this._cached<Element[]>(simple, ['_querySimple', context], () => {
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
    return this._cached<boolean>(element, ['_matchesParents', complex, index, context], () => {
      if (index < 0)
        return true;
      const { selector: simple, combinator } = complex.simples[index];
      if (combinator === '>') {
        const parent = parentElementOrShadowHostInScope(element, context.scope);
        if (!parent || !this._matchesSimple(parent, simple, context))
          return false;
        return this._matchesParents(parent, complex, index - 1, context);
      }
      if (combinator === '+') {
        const previousSibling = element === context.scope ? null : element.previousElementSibling;
        if (!previousSibling || !this._matchesSimple(previousSibling, simple, context))
          return false;
        return this._matchesParents(previousSibling, complex, index - 1, context);
      }
      if (combinator === '') {
        let parent = parentElementOrShadowHostInScope(element, context.scope);
        while (parent) {
          if (this._matchesSimple(parent, simple, context)) {
            if (this._matchesParents(parent, complex, index - 1, context))
              return true;
            if (complex.simples[index - 1].combinator === '')
              break;
          }
          parent = parentElementOrShadowHostInScope(parent, context.scope);
        }
        return false;
      }
      if (combinator === '~') {
        let previousSibling = element === context.scope ? null : element.previousElementSibling;
        while (previousSibling) {
          if (this._matchesSimple(previousSibling, simple, context)) {
            if (this._matchesParents(previousSibling, complex, index - 1, context))
              return true;
            if (complex.simples[index - 1].combinator === '~')
              break;
          }
          previousSibling = previousSibling === context.scope ? null : previousSibling.previousElementSibling;
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
    return this._cached<boolean>(element, ['_callMatches', engine, args, context.scope], () => {
      return engine.matches!(element, args, context, this);
    });
  }

  private _callQuery(engine: SelectorEngine, args: CSSFunctionArgument[], context: QueryContext): Element[] {
    return this._cached<Element[]>(args, ['_callQuery', engine, context.scope], () => {
      return engine.query!(context, args, this);
    });
  }

  private _matchesCSS(element: Element, css: string): boolean {
    return this._cached<boolean>(element, ['_matchesCSS', css], () => {
      return element.matches(css);
    });
  }

  private _queryCSS(context: QueryContext, css: string): Element[] {
    return this._cached<Element[]>(css, ['_queryCSS', context], () => {
      const result: Element[] = [];
      function query(root: Element | ShadowRoot | Document) {
        result.push(...root.querySelectorAll(css));
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
  matches(element: Element, args: any[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length === 0)
      throw new Error(`"is" engine expects non-empty selector list`);
    return args.some(selector => evaluator.matches(element, selector, context));
  },

  query(context: QueryContext, args: any[], evaluator: SelectorEvaluator): Element[] {
    if (args.length === 0)
      throw new Error(`"is" engine expects non-empty selector list`);
    const elements: Element[] = [];
    for (const arg of args)
      elements.push(...evaluator.query(context, arg));
    const result = Array.from(new Set(elements));
    return args.length > 1 ? sortInDOMOrder(result) : result;
  },
};

const hasEngine: SelectorEngine = {
  matches(element: Element, args: any[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length === 0)
      throw new Error(`"has" engine expects non-empty selector list`);
    return evaluator.query({ ...context, scope: element }, args).length > 0;
  },

  // TODO: we can implement efficient "query" by matching "args" and returning
  // all parents/descendants, just have to be careful with the ":scope" matching.
};

const scopeEngine: SelectorEngine = {
  matches(element: Element, args: any[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length !== 0)
      throw new Error(`"scope" engine expects no arguments`);
    if (context.scope.nodeType === 9 /* Node.DOCUMENT_NODE */)
      return element === (context.scope as Document).documentElement;
    return element === context.scope;
  },

  query(context: QueryContext, args: any[], evaluator: SelectorEvaluator): Element[] {
    if (args.length !== 0)
      throw new Error(`"scope" engine expects no arguments`);
    if (context.scope.nodeType === 9 /* Node.DOCUMENT_NODE */) {
      const root = (context.scope as Document).documentElement;
      return root ? [root] : [];
    }
    if (context.scope.nodeType === 1 /* Node.ELEMENT_NODE */)
      return [context.scope as Element];
    return [];
  },
};

const notEngine: SelectorEngine = {
  matches(element: Element, args: any[], context: QueryContext, evaluator: SelectorEvaluator): boolean {
    if (args.length === 0)
      throw new Error(`"not" engine expects non-empty selector list`);
    return !evaluator.matches(element, args, context);
  },
};

function parentElementOrShadowHost(element: Element): Element | undefined {
  if (element.parentElement)
    return element.parentElement;
  if (!element.parentNode)
    return;
  if (element.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (element.parentNode as ShadowRoot).host)
    return (element.parentNode as ShadowRoot).host;
}

function parentElementOrShadowHostInScope(element: Element, scope: Element | ShadowRoot | Document): Element | undefined {
  return element === scope ? undefined : parentElementOrShadowHost(element);
}

function sortInDOMOrder(elements: Element[]): Element[] {
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
  elements.forEach(e => append(e).taken = true);

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
