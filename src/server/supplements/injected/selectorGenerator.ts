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

import type InjectedScript from '../../injected/injectedScript';
import { elementText } from '../../injected/selectorEvaluator';

type SelectorToken = {
  engine: string;
  selector: string;
  score: number;  // Lower is better.
};

const cacheAllowText = new Map<Element, SelectorToken[] | null>();
const cacheDisallowText = new Map<Element, SelectorToken[] | null>();

export function generateSelector(injectedScript: InjectedScript, targetElement: Element): { selector: string, elements: Element[] } {
  injectedScript._evaluator.begin();
  try {
    targetElement = targetElement.closest('button,select,input,[role=button],[role=checkbox],[role=radio]') || targetElement;
    let bestTokens = generateSelectorFor(injectedScript, targetElement);

    const targetLabel = findTargetLabel(targetElement);
    const labelTokens = targetLabel ? generateSelectorFor(injectedScript, targetLabel) : null;
    if (labelTokens && combineScores(labelTokens) < combineScores(bestTokens))
      bestTokens = labelTokens;

    const selector = joinTokens(bestTokens);
    const parsedSelector = injectedScript.parseSelector(selector);
    return {
      selector,
      elements: injectedScript.querySelectorAll(parsedSelector, targetElement.ownerDocument)
    };
  } finally {
    cacheAllowText.clear();
    cacheDisallowText.clear();
    injectedScript._evaluator.end();
  }
}

function generateSelectorFor(injectedScript: InjectedScript, targetElement: Element): SelectorToken[] {
  if (targetElement.ownerDocument.documentElement === targetElement)
    return [{ engine: 'css', selector: 'html', score: 1 }];

  const calculate = (element: Element, allowText: boolean): SelectorToken[] | null => {
    const allowNthMatch = element === targetElement;

    const textCandidates = allowText ? buildTextCandidates(injectedScript, element, element === targetElement).map(token => [token]) : [];
    const noTextCandidates = buildCandidates(injectedScript, element).map(token => [token]);
    let result = chooseFirstSelector(injectedScript, targetElement.ownerDocument, element, [...textCandidates, ...noTextCandidates], allowNthMatch);

    const checkWithText = (textCandidatesToUse: SelectorToken[][]) => {
      const allowParentText = allowText && !textCandidatesToUse.length;
      const candidates = [...textCandidatesToUse, ...noTextCandidates];
      for (let parent = parentElementOrShadowHost(element); parent; parent = parentElementOrShadowHost(parent)) {
        const best = chooseFirstSelector(injectedScript, parent, element, candidates, allowNthMatch);
        if (!best)
          continue;
        if (result && combineScores(best) >= combineScores(result))
          continue;
        const parentTokens = find(parent, allowParentText);
        if (!parentTokens)
          continue;
        if (!result || combineScores([...parentTokens, ...best]) < combineScores(result))
          result = [...parentTokens, ...best];
      }
    };

    checkWithText(textCandidates);
    // Allow skipping text on the target element.
    if (element === targetElement && textCandidates.length)
      checkWithText([]);

    return result;
  };

  const find = (element: Element, allowText: boolean): SelectorToken[] | null => {
    const cache = allowText ? cacheAllowText : cacheDisallowText;
    let value = cache.get(element);
    if (value === undefined) {
      value = calculate(element, allowText);
      cache.set(element, value);
    }
    return value;
  };

  const smartTokens = find(targetElement, true);
  if (smartTokens)
    return smartTokens;

  return [cssFallback(injectedScript, targetElement)];
}

function buildCandidates(injectedScript: InjectedScript, element: Element): SelectorToken[] {
  const candidates: SelectorToken[] = [];
  for (const attribute of ['data-testid', 'data-test-id', 'data-test']) {
    if (element.hasAttribute(attribute))
      candidates.push({ engine: 'css', selector: `[${attribute}=${quoteString(element.getAttribute(attribute)!)}]`, score: 1 });
  }

  if (element.nodeName === 'INPUT') {
    const input = element as HTMLInputElement;
    if (input.placeholder)
      candidates.push({ engine: 'css', selector: `[placeholder=${quoteString(input.placeholder)}]`, score: 10 });
  }
  if (element.hasAttribute('aria-label'))
    candidates.push({ engine: 'css', selector: `[aria-label=${quoteString(element.getAttribute('aria-label')!)}]`, score: 10 });
  if (element.nodeName === 'IMG' && element.getAttribute('alt'))
    candidates.push({ engine: 'css', selector: `img[alt=${quoteString(element.getAttribute('alt')!)}]`, score: 10 });

  if (element.hasAttribute('role'))
    candidates.push({ engine: 'css', selector: `${element.nodeName.toLocaleLowerCase()}[role=${quoteString(element.getAttribute('role')!)}]` , score: 50 });
  if (['INPUT', 'TEXTAREA'].includes(element.nodeName) && element.getAttribute('type') !== 'hidden') {
    if (element.getAttribute('name'))
      candidates.push({ engine: 'css', selector: `${element.nodeName.toLowerCase()}[name=${quoteString(element.getAttribute('name')!)}]`, score: 50 });
    if (element.getAttribute('type'))
      candidates.push({ engine: 'css', selector: `${element.nodeName.toLowerCase()}[type=${quoteString(element.getAttribute('type')!)}]`, score: 50 });
  }
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.nodeName))
    candidates.push({ engine: 'css', selector: element.nodeName.toLowerCase(), score: 50 });

  const idAttr = element.getAttribute('id');
  if (idAttr && !isGuidLike(idAttr))
    candidates.push({ engine: 'css', selector: `#${idAttr}`, score: 100 });

  candidates.push({ engine: 'css', selector: element.nodeName.toLocaleLowerCase(), score: 200 });
  return candidates;
}

function buildTextCandidates(injectedScript: InjectedScript, element: Element, allowHasText: boolean): SelectorToken[] {
  if (element.nodeName === 'SELECT')
    return [];
  const text = elementText(injectedScript._evaluator, element).trim().replace(/\s+/g, ' ').substring(0, 80);
  if (!text)
    return [];
  const candidates: SelectorToken[] = [];

  let escaped = text;
  if (text.includes('"') || text.includes('>>') || text[0] === '/')
    escaped = `/.*${escapeForRegex(text)}.*/`;

  candidates.push({ engine: 'text', selector: escaped, score: 10 });
  if (allowHasText && escaped === text) {
    let prefix = element.nodeName.toLocaleLowerCase();
    if (element.hasAttribute('role'))
      prefix += `[role=${quoteString(element.getAttribute('role')!)}]`;
    candidates.push({ engine: 'css', selector: `${prefix}:has-text("${text}")`, score: 30 });
  }
  return candidates;
}

function parentElementOrShadowHost(element: Element): Element | null {
  if (element.parentElement)
    return element.parentElement;
  if (!element.parentNode)
    return null;
  if (element.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (element.parentNode as ShadowRoot).host)
    return (element.parentNode as ShadowRoot).host;
  return null;
}

function ancestorShadowRoot(element: Element): ShadowRoot | null {
  while (element.parentElement)
    element = element.parentElement;
  if (element.parentNode && element.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
    return element.parentNode as ShadowRoot;
  return null;
}

function findTargetLabel(element: Element): Element | null {
  const docOrShadowRoot = ancestorShadowRoot(element) || element.ownerDocument!;
  const labels = docOrShadowRoot.querySelectorAll('label');
  for (const element of labels) {
    const label = element as HTMLLabelElement;
    if (label.control === element)
      return label;
  }
  return null;
}

function cssFallback(injectedScript: InjectedScript, targetElement: Element): SelectorToken {
  const kFallbackScore = 10000000;
  const root: Node = targetElement.ownerDocument;
  const tokens: string[] = [];

  function uniqueCSSSelector(prefix?: string): string | undefined {
    const path = tokens.slice();
    if (prefix)
      path.unshift(prefix);
    const selector = path.join(' ');
    const parsedSelector = injectedScript.parseSelector(selector);
    const node = injectedScript.querySelector(parsedSelector, targetElement.ownerDocument);
    return node === targetElement ? selector : undefined;
  }

  for (let element: Element | null = targetElement; element && element !== root; element = parentElementOrShadowHost(element)) {
    const nodeName = element.nodeName.toLowerCase();

    // Element ID is the strongest signal, use it.
    let bestTokenForLevel: string = '';
    if (element.id) {
      const token = /^[a-zA-Z][a-zA-Z0-9\-\_]+$/.test(element.id) ? '#' + element.id : `[id="${element.id}"]`;
      const selector = uniqueCSSSelector(token);
      if (selector)
        return { engine: 'css', selector, score: kFallbackScore };
      bestTokenForLevel = token;
    }

    const parent = element.parentNode as (Element | ShadowRoot);

    // Combine class names until unique.
    const classes = Array.from(element.classList);
    for (let i = 0; i < classes.length; ++i) {
      const token = '.' + classes.slice(0, i + 1).join('.');
      const selector = uniqueCSSSelector(token);
      if (selector)
        return { engine: 'css', selector, score: kFallbackScore };
      // Even if not unique, does this subset of classes uniquely identify node as a child?
      if (!bestTokenForLevel && parent) {
        const sameClassSiblings = parent.querySelectorAll(token);
        if (sameClassSiblings.length === 1)
          bestTokenForLevel = token;
      }
    }

    // Ordinal is the weakest signal.
    if (parent) {
      const siblings = Array.from(parent.children);
      const sameTagSiblings = siblings.filter(sibling => (sibling).nodeName.toLowerCase() === nodeName);
      const token = sameTagSiblings.indexOf(element) === 0 ? nodeName : `${nodeName}:nth-child(${1 + siblings.indexOf(element)})`;
      const selector = uniqueCSSSelector(token);
      if (selector)
        return { engine: 'css', selector, score: kFallbackScore };
      if (!bestTokenForLevel)
        bestTokenForLevel = token;
    } else if (!bestTokenForLevel) {
      bestTokenForLevel = nodeName;
    }
    tokens.unshift(bestTokenForLevel);
  }
  return { engine: 'css', selector: uniqueCSSSelector()!, score: kFallbackScore };
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^>${}()|[\]\\]/g, '\\$&');
}

function quoteString(text: string): string {
  return `"${text.replaceAll(/"/g, '\\"').replaceAll(/\n/g, '\\n')}"`;
}

function joinTokens(tokens: SelectorToken[]): string {
  const parts = [];
  let lastEngine = '';
  for (const { engine, selector } of tokens) {
    if (parts.length  && (lastEngine !== 'css' || engine !== 'css'))
      parts.push('>>');
    lastEngine = engine;
    if (engine === 'css')
      parts.push(selector);
    else
      parts.push(`${engine}=${selector}`);
  }
  return parts.join(' ');
}

function combineScores(tokens: SelectorToken[]): number {
  let score = 0;
  for (let i = 0; i < tokens.length; i++)
    score += tokens[i].score * (tokens.length - i);
  return score;
}

function chooseFirstSelector(injectedScript: InjectedScript, scope: Element | Document, targetElement: Element, selectors: SelectorToken[][], allowNthMatch: boolean): SelectorToken[] | null {
  const joined = selectors.map(tokens => ({ tokens, score: combineScores(tokens) }));
  joined.sort((a, b) => a.score - b.score);
  let bestWithIndex: SelectorToken[] | null = null;
  for (const { tokens } of joined) {
    const parsedSelector = injectedScript.parseSelector(joinTokens(tokens));
    const result = injectedScript.querySelectorAll(parsedSelector, scope);
    const index = result.indexOf(targetElement);
    if (index === 0)
      return tokens;
    if (!allowNthMatch || bestWithIndex || index === -1 || result.length > 5)
      continue;
    const allCss = tokens.map(token => {
      if (token.engine !== 'text')
        return token;
      if (token.selector.startsWith('/') && token.selector.endsWith('/'))
        return { engine: 'css', selector: `:text-matches("${token.selector.substring(1, token.selector.length - 1)}")`, score: token.score };
      return { engine: 'css', selector: `:text("${token.selector}")`, score: token.score };
    });
    const combined = joinTokens(allCss);
    bestWithIndex = [{ engine: 'css', selector: `:nth-match(${combined}, ${index + 1})`, score: combineScores(allCss) + 1000 }];
  }
  return bestWithIndex;
}

function isGuidLike(id: string): boolean {
  let lastCharacterType: 'lower' | 'upper' | 'digit' | 'other' | undefined;
  let transitionCount = 0;
  for (let i = 0; i < id.length; ++i) {
    const c = id[i];
    let characterType: 'lower' | 'upper' | 'digit' | 'other';
    if (c === '-' || c === '_')
      continue;
    if (c >= 'a' && c <= 'z')
      characterType = 'lower';
    else if (c >= 'A' && c <= 'Z')
      characterType = 'upper';
    else if (c >= '0' && c <= '9')
      characterType = 'digit';
    else
      characterType = 'other';

    if (characterType === 'lower' && lastCharacterType === 'upper') {
      lastCharacterType = characterType;
      continue;
    }

    if (lastCharacterType && lastCharacterType !== characterType)
      ++transitionCount;
    lastCharacterType = characterType;
  }
  return transitionCount >= id.length / 4;
}
