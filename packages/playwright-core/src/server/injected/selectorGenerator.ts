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

import { type InjectedScript } from './injectedScript';
import { elementText } from './selectorUtils';

type SelectorToken = {
  engine: string;
  selector: string;
  score: number;  // Lower is better.
};

const cacheAllowText = new Map<Element, SelectorToken[] | null>();
const cacheDisallowText = new Map<Element, SelectorToken[] | null>();
const kNthScore = 1000;

export function querySelector(injectedScript: InjectedScript, selector: string, ownerDocument: Document): { selector: string, elements: Element[] } {
  try {
    const parsedSelector = injectedScript.parseSelector(selector);
    return {
      selector,
      elements: injectedScript.querySelectorAll(parsedSelector, ownerDocument)
    };
  } catch (e) {
    return {
      selector,
      elements: [],
    };
  }
}

export function generateSelector(injectedScript: InjectedScript, targetElement: Element, strict: boolean): { selector: string, elements: Element[] } {
  injectedScript._evaluator.begin();
  try {
    targetElement = targetElement.closest('button,select,input,[role=button],[role=checkbox],[role=radio]') || targetElement;
    const targetTokens = generateSelectorFor(injectedScript, targetElement, strict);
    const bestTokens = targetTokens || cssFallback(injectedScript, targetElement, strict);
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

function filterRegexTokens(textCandidates: SelectorToken[][]): SelectorToken[][] {
  // Filter out regex-based selectors for better performance.
  return textCandidates.filter(c => c[0].selector[0] !== '/');
}

function generateSelectorFor(injectedScript: InjectedScript, targetElement: Element, strict: boolean): SelectorToken[] | null {
  if (targetElement.ownerDocument.documentElement === targetElement)
    return [{ engine: 'css', selector: 'html', score: 1 }];

  const calculate = (element: Element, allowText: boolean): SelectorToken[] | null => {
    const allowNthMatch = element === targetElement;

    let textCandidates = allowText ? buildTextCandidates(injectedScript, element, element === targetElement).map(token => [token]) : [];
    if (element !== targetElement) {
      // Do not use regex for parent elements (for performance).
      textCandidates = filterRegexTokens(textCandidates);
    }
    const noTextCandidates = buildCandidates(injectedScript, element).map(token => [token]);

    // First check all text and non-text candidates for the element.
    let result = chooseFirstSelector(injectedScript, targetElement.ownerDocument, element, [...textCandidates, ...noTextCandidates], allowNthMatch, strict);

    // Do not use regex for chained selectors (for performance).
    textCandidates = filterRegexTokens(textCandidates);

    const checkWithText = (textCandidatesToUse: SelectorToken[][]) => {
      // Use the deepest possible text selector - works pretty good and saves on compute time.
      const allowParentText = allowText && !textCandidatesToUse.length;

      const candidates = [...textCandidatesToUse, ...noTextCandidates].filter(c => {
        if (!result)
          return true;
        return combineScores(c) < combineScores(result);
      });

      // This is best theoretically possible candidate from the current parent.
      // We use the fact that widening the scope to grand-parent makes any selector
      // even less likely to match.
      let bestPossibleInParent: SelectorToken[] | null = candidates[0];
      if (!bestPossibleInParent)
        return;

      for (let parent = parentElementOrShadowHost(element); parent; parent = parentElementOrShadowHost(parent)) {
        const parentTokens = calculateCached(parent, allowParentText);
        if (!parentTokens)
          continue;
        // Even the best selector won't be too good - skip this parent.
        if (result && combineScores([...parentTokens, ...bestPossibleInParent]) >= combineScores(result))
          continue;
        // Update the best candidate that finds "element" in the "parent".
        bestPossibleInParent = chooseFirstSelector(injectedScript, parent, element, candidates, allowNthMatch, strict);
        if (!bestPossibleInParent)
          return;
        const combined = [...parentTokens, ...bestPossibleInParent];
        if (!result || combineScores(combined) < combineScores(result))
          result = combined;
      }
    };

    checkWithText(textCandidates);
    // Allow skipping text on the target element, and using text on one of the parents.
    if (element === targetElement && textCandidates.length)
      checkWithText([]);

    return result;
  };

  const calculateCached = (element: Element, allowText: boolean): SelectorToken[] | null => {
    const cache = allowText ? cacheAllowText : cacheDisallowText;
    let value = cache.get(element);
    if (value === undefined) {
      value = calculate(element, allowText);
      cache.set(element, value);
    }
    return value;
  };

  return calculateCached(targetElement, true);
}

function buildCandidates(injectedScript: InjectedScript, element: Element): SelectorToken[] {
  const candidates: SelectorToken[] = [];
  for (const attribute of ['data-testid', 'data-test-id', 'data-test']) {
    if (element.getAttribute(attribute))
      candidates.push({ engine: 'css', selector: `[${attribute}=${quoteAttributeValue(element.getAttribute(attribute)!)}]`, score: 1 });
  }

  if (element.nodeName === 'INPUT') {
    const input = element as HTMLInputElement;
    if (input.placeholder)
      candidates.push({ engine: 'css', selector: `[placeholder=${quoteAttributeValue(input.placeholder)}]`, score: 10 });
  }
  if (element.getAttribute('aria-label'))
    candidates.push({ engine: 'css', selector: `[aria-label=${quoteAttributeValue(element.getAttribute('aria-label')!)}]`, score: 10 });
  if (element.getAttribute('alt') && ['APPLET', 'AREA', 'IMG', 'INPUT'].includes(element.nodeName))
    candidates.push({ engine: 'css', selector: `${cssEscape(element.nodeName.toLowerCase())}[alt=${quoteAttributeValue(element.getAttribute('alt')!)}]`, score: 10 });

  if (element.getAttribute('role'))
    candidates.push({ engine: 'css', selector: `${cssEscape(element.nodeName.toLowerCase())}[role=${quoteAttributeValue(element.getAttribute('role')!)}]` , score: 50 });

  if (element.getAttribute('name') && ['BUTTON', 'FORM', 'FIELDSET', 'IFRAME', 'INPUT', 'KEYGEN', 'OBJECT', 'OUTPUT', 'SELECT', 'TEXTAREA', 'MAP', 'META', 'PARAM'].includes(element.nodeName))
    candidates.push({ engine: 'css', selector: `${cssEscape(element.nodeName.toLowerCase())}[name=${quoteAttributeValue(element.getAttribute('name')!)}]`, score: 50 });
  if (['INPUT', 'TEXTAREA'].includes(element.nodeName) && element.getAttribute('type') !== 'hidden') {
    if (element.getAttribute('type'))
      candidates.push({ engine: 'css', selector: `${cssEscape(element.nodeName.toLowerCase())}[type=${quoteAttributeValue(element.getAttribute('type')!)}]`, score: 50 });
  }
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.nodeName))
    candidates.push({ engine: 'css', selector: cssEscape(element.nodeName.toLowerCase()), score: 50 });

  const idAttr = element.getAttribute('id');
  if (idAttr && !isGuidLike(idAttr))
    candidates.push({ engine: 'css', selector: makeSelectorForId(idAttr), score: 100 });


  candidates.push({ engine: 'css', selector: cssEscape(element.nodeName.toLowerCase()), score: 200 });
  return candidates;
}

function buildTextCandidates(injectedScript: InjectedScript, element: Element, allowHasText: boolean): SelectorToken[] {
  if (element.nodeName === 'SELECT')
    return [];
  const text = elementText(injectedScript._evaluator._cacheText, element).full.trim().replace(/\s+/g, ' ').substring(0, 80);
  if (!text)
    return [];
  const candidates: SelectorToken[] = [];

  let escaped = text;
  if (text.includes('"') || text.includes('>>') || text[0] === '/')
    escaped = `/.*${escapeForRegex(text)}.*/`;

  candidates.push({ engine: 'text', selector: escaped, score: 10 });
  if (allowHasText && escaped === text) {
    let prefix = element.nodeName.toLowerCase();
    if (element.hasAttribute('role'))
      prefix += `[role=${quoteAttributeValue(element.getAttribute('role')!)}]`;
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

function makeSelectorForId(id: string) {
  return /^[a-zA-Z][a-zA-Z0-9\-\_]+$/.test(id) ? '#' + id : `[id="${cssEscape(id)}"]`;
}

function cssFallback(injectedScript: InjectedScript, targetElement: Element, strict: boolean): SelectorToken[] {
  const kFallbackScore = 10000000;
  const root: Node = targetElement.ownerDocument;
  const tokens: string[] = [];

  function uniqueCSSSelector(prefix?: string): string | undefined {
    const path = tokens.slice();
    if (prefix)
      path.unshift(prefix);
    const selector = path.join(' > ');
    const parsedSelector = injectedScript.parseSelector(selector);
    const node = injectedScript.querySelector(parsedSelector, targetElement.ownerDocument, false);
    return node === targetElement ? selector : undefined;
  }

  function makeStrict(selector: string): SelectorToken[] {
    const token = { engine: 'css', selector, score: kFallbackScore };
    if (!strict)
      return [token];
    const parsedSelector = injectedScript.parseSelector(selector);
    const elements = injectedScript.querySelectorAll(parsedSelector, targetElement.ownerDocument);
    if (elements.length === 1)
      return [token];
    const nth = { engine: 'nth', selector: String(elements.indexOf(targetElement)), score: kNthScore };
    return [token, nth];
  }

  for (let element: Element | null = targetElement; element && element !== root; element = parentElementOrShadowHost(element)) {
    const nodeName = element.nodeName.toLowerCase();

    // Element ID is the strongest signal, use it.
    let bestTokenForLevel: string = '';
    if (element.id) {
      const token = makeSelectorForId(element.id);
      const selector = uniqueCSSSelector(token);
      if (selector)
        return makeStrict(selector);
      bestTokenForLevel = token;
    }

    const parent = element.parentNode as (Element | ShadowRoot);

    // Combine class names until unique.
    const classes = [...element.classList];
    for (let i = 0; i < classes.length; ++i) {
      const token = '.' + classes.slice(0, i + 1).join('.');
      const selector = uniqueCSSSelector(token);
      if (selector)
        return makeStrict(selector);
      // Even if not unique, does this subset of classes uniquely identify node as a child?
      if (!bestTokenForLevel && parent) {
        const sameClassSiblings = parent.querySelectorAll(token);
        if (sameClassSiblings.length === 1)
          bestTokenForLevel = token;
      }
    }

    // Ordinal is the weakest signal.
    if (parent) {
      const siblings = [...parent.children];
      const sameTagSiblings = siblings.filter(sibling => (sibling).nodeName.toLowerCase() === nodeName);
      const token = sameTagSiblings.indexOf(element) === 0 ? cssEscape(nodeName) : `${cssEscape(nodeName)}:nth-child(${1 + siblings.indexOf(element)})`;
      const selector = uniqueCSSSelector(token);
      if (selector)
        return makeStrict(selector);
      if (!bestTokenForLevel)
        bestTokenForLevel = token;
    } else if (!bestTokenForLevel) {
      bestTokenForLevel = nodeName;
    }
    tokens.unshift(bestTokenForLevel);
  }
  return makeStrict(uniqueCSSSelector()!);
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^>${}()|[\]\\]/g, '\\$&');
}

function quoteAttributeValue(text: string): string {
  return `"${cssEscape(text).replace(/\\ /g, ' ')}"`;
}

function joinTokens(tokens: SelectorToken[]): string {
  const parts = [];
  let lastEngine = '';
  for (const { engine, selector } of tokens) {
    if (parts.length  && (lastEngine !== 'css' || engine !== 'css' || selector.startsWith(':nth-match(')))
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

function chooseFirstSelector(injectedScript: InjectedScript, scope: Element | Document, targetElement: Element, selectors: SelectorToken[][], allowNthMatch: boolean, strict: boolean): SelectorToken[] | null {
  const joined = selectors.map(tokens => ({ tokens, score: combineScores(tokens) }));
  joined.sort((a, b) => a.score - b.score);

  let bestWithIndex: SelectorToken[] | null = null;
  for (const { tokens } of joined) {
    const parsedSelector = injectedScript.parseSelector(joinTokens(tokens));
    const result = injectedScript.querySelectorAll(parsedSelector, scope);
    const isStrictEnough = !strict || result.length === 1;
    const index = result.indexOf(targetElement);
    if (index === 0 && isStrictEnough) {
      // We are the first match - found the best selector.
      return tokens;
    }

    // Otherwise, perhaps we can use nth=?
    if (!allowNthMatch || bestWithIndex || index === -1 || result.length > 5)
      continue;

    const nth: SelectorToken = { engine: 'nth', selector: String(index), score: kNthScore };
    bestWithIndex = [...tokens, nth];
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

function cssEscape(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++)
    result += cssEscapeOne(s, i);
  return result;
}

function cssEscapeOne(s: string, i: number): string {
  // https://drafts.csswg.org/cssom/#serialize-an-identifier
  const c = s.charCodeAt(i);
  if (c === 0x0000)
    return '\uFFFD';
  if ((c >= 0x0001 && c <= 0x001f) ||
      (c >= 0x0030 && c <= 0x0039 && (i === 0 || (i === 1 && s.charCodeAt(0) === 0x002d))))
    return '\\' + c.toString(16) + ' ';
  if (i === 0 && c === 0x002d && s.length === 1)
    return '\\' + s.charAt(i);
  if (c >= 0x0080 || c === 0x002d || c === 0x005f || (c >= 0x0030 && c <= 0x0039) ||
      (c >= 0x0041 && c <= 0x005a) || (c >= 0x0061 && c <= 0x007a))
    return s.charAt(i);
  return '\\' + s.charAt(i);
}
