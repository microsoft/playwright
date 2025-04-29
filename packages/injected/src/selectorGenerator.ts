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

import { cssEscape, escapeForAttributeSelector, escapeForTextSelector, escapeRegExp, quoteCSSAttributeValue } from '@isomorphic/stringUtils';

import { closestCrossShadow, isElementVisible, isInsideScope, parentElementOrShadowHost } from './domUtils';
import { beginAriaCaches, endAriaCaches, getAriaRole, getElementAccessibleName } from './roleUtils';
import { elementText, getElementLabels } from './selectorUtils';

import type { InjectedScript } from './injectedScript';

type SelectorToken = {
  engine: string;
  selector: string;
  score: number;  // Lower is better.
};

type Cache = {
  allowText: Map<Element, SelectorToken[] | null>;
  disallowText: Map<Element, SelectorToken[] | null>;
};

const kTextScoreRange = 10;
const kExactPenalty = kTextScoreRange / 2;

const kTestIdScore = 1;        // testIdAttributeName
const kOtherTestIdScore = 2;   // other data-test* attributes

const kIframeByAttributeScore = 10;

const kBeginPenalizedScore = 50;
const kRoleWithNameScore = 100;
const kPlaceholderScore = 120;
const kLabelScore = 140;
const kAltTextScore = 160;
const kTextScore = 180;
const kTitleScore = 200;
const kTextScoreRegex = 250;
const kPlaceholderScoreExact = kPlaceholderScore + kExactPenalty;
const kLabelScoreExact = kLabelScore + kExactPenalty;
const kRoleWithNameScoreExact = kRoleWithNameScore + kExactPenalty;
const kAltTextScoreExact = kAltTextScore + kExactPenalty;
const kTextScoreExact = kTextScore + kExactPenalty;
const kTitleScoreExact = kTitleScore + kExactPenalty;
const kEndPenalizedScore = 300;

const kCSSIdScore = 500;
const kRoleWithoutNameScore = 510;
const kCSSInputTypeNameScore = 520;
const kCSSTagNameScore = 530;
const kNthScore = 10000;
const kCSSFallbackScore = 10000000;

const kScoreThresholdForTextExpect = 1000;

export type GenerateSelectorOptions = {
  testIdAttributeName: string;
  omitInternalEngines?: boolean;
  root?: Element | Document;
  forTextExpect?: boolean;
  multiple?: boolean;
};

export function generateSelector(injectedScript: InjectedScript, targetElement: Element, options: GenerateSelectorOptions): { selector: string, selectors: string[], elements: Element[] } {
  injectedScript._evaluator.begin();
  const cache: Cache = { allowText: new Map(), disallowText: new Map() };
  beginAriaCaches();
  try {
    let selectors: string[] = [];
    if (options.forTextExpect) {
      let targetTokens = cssFallback(injectedScript, targetElement.ownerDocument.documentElement, options);
      for (let element: Element | undefined = targetElement; element; element = parentElementOrShadowHost(element)) {
        const tokens = generateSelectorFor(cache, injectedScript, element, { ...options, noText: true });
        if (!tokens)
          continue;
        const score = combineScores(tokens);
        if (score <= kScoreThresholdForTextExpect) {
          targetTokens = tokens;
          break;
        }
      }
      selectors = [joinTokens(targetTokens)];
    } else {
      // Note: this matches InjectedScript.retarget().
      if (!targetElement.matches('input,textarea,select') && !(targetElement as any).isContentEditable) {
        const interactiveParent = closestCrossShadow(targetElement, 'button,select,input,[role=button],[role=checkbox],[role=radio],a,[role=link]', options.root);
        if (interactiveParent && isElementVisible(interactiveParent))
          targetElement = interactiveParent;
      }
      if (options.multiple) {
        const withText = generateSelectorFor(cache, injectedScript, targetElement, options);
        const withoutText = generateSelectorFor(cache, injectedScript, targetElement, { ...options, noText: true });
        let tokens = [withText, withoutText];

        // Clear cache to re-generate without css id.
        cache.allowText.clear();
        cache.disallowText.clear();

        if (withText && hasCSSIdToken(withText))
          tokens.push(generateSelectorFor(cache, injectedScript, targetElement, { ...options, noCSSId: true }));
        if (withoutText && hasCSSIdToken(withoutText))
          tokens.push(generateSelectorFor(cache, injectedScript, targetElement, { ...options, noText: true, noCSSId: true }));

        tokens = tokens.filter(Boolean);
        if (!tokens.length) {
          const css = cssFallback(injectedScript, targetElement, options);
          tokens.push(css);
          if (hasCSSIdToken(css))
            tokens.push(cssFallback(injectedScript, targetElement, { ...options, noCSSId: true }));
        }
        selectors = [...new Set(tokens.map(t => joinTokens(t!)))];
      } else {
        const targetTokens = generateSelectorFor(cache, injectedScript, targetElement, options) || cssFallback(injectedScript, targetElement, options);
        selectors = [joinTokens(targetTokens)];
      }
    }
    const selector = selectors[0];
    const parsedSelector = injectedScript.parseSelector(selector);
    return {
      selector,
      selectors,
      elements: injectedScript.querySelectorAll(parsedSelector, options.root ?? targetElement.ownerDocument)
    };
  } finally {
    endAriaCaches();
    injectedScript._evaluator.end();
  }
}

function filterRegexTokens(textCandidates: SelectorToken[][]): SelectorToken[][] {
  // Filter out regex-based selectors for better performance.
  return textCandidates.filter(c => c[0].selector[0] !== '/');
}

type InternalOptions = GenerateSelectorOptions & { noText?: boolean, noCSSId?: boolean };

function generateSelectorFor(cache: Cache, injectedScript: InjectedScript, targetElement: Element, options: InternalOptions): SelectorToken[] | null {
  if (options.root && !isInsideScope(options.root, targetElement))
    throw new Error(`Target element must belong to the root's subtree`);

  if (targetElement === options.root)
    return [{ engine: 'css', selector: ':scope', score: 1 }];
  if (targetElement.ownerDocument.documentElement === targetElement)
    return [{ engine: 'css', selector: 'html', score: 1 }];

  const calculate = (element: Element, allowText: boolean): SelectorToken[] | null => {
    const allowNthMatch = element === targetElement;

    let textCandidates = allowText ? buildTextCandidates(injectedScript, element, element === targetElement) : [];
    if (element !== targetElement) {
      // Do not use regex for parent elements (for performance).
      textCandidates = filterRegexTokens(textCandidates);
    }
    const noTextCandidates = buildNoTextCandidates(injectedScript, element, options)
        .filter(token => !options.omitInternalEngines || !token.engine.startsWith('internal:'))
        .map(token => [token]);

    // First check all text and non-text candidates for the element.
    let result = chooseFirstSelector(injectedScript, options.root ?? targetElement.ownerDocument, element, [...textCandidates, ...noTextCandidates], allowNthMatch);

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

      for (let parent = parentElementOrShadowHost(element); parent && parent !== options.root; parent = parentElementOrShadowHost(parent)) {
        const parentTokens = calculateCached(parent, allowParentText);
        if (!parentTokens)
          continue;
        // Even the best selector won't be too good - skip this parent.
        if (result && combineScores([...parentTokens, ...bestPossibleInParent]) >= combineScores(result))
          continue;
        // Update the best candidate that finds "element" in the "parent".
        bestPossibleInParent = chooseFirstSelector(injectedScript, parent, element, candidates, allowNthMatch);
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
    const map = allowText ? cache.allowText : cache.disallowText;
    let value = map.get(element);
    if (value === undefined) {
      value = calculate(element, allowText);
      map.set(element, value);
    }
    return value;
  };

  return calculate(targetElement, !options.noText);
}

function buildNoTextCandidates(injectedScript: InjectedScript, element: Element, options: InternalOptions): SelectorToken[] {
  const candidates: SelectorToken[] = [];

  // CSS selectors are applicable to elements via locator() and iframes via frameLocator().
  {
    for (const attr of ['data-testid', 'data-test-id', 'data-test']) {
      if (attr !== options.testIdAttributeName && element.getAttribute(attr))
        candidates.push({ engine: 'css', selector: `[${attr}=${quoteCSSAttributeValue(element.getAttribute(attr)!)}]`, score: kOtherTestIdScore });
    }

    if (!options.noCSSId) {
      const idAttr = element.getAttribute('id');
      if (idAttr && !isGuidLike(idAttr))
        candidates.push({ engine: 'css', selector: makeSelectorForId(idAttr), score: kCSSIdScore });
    }

    candidates.push({ engine: 'css', selector: cssEscape(element.nodeName.toLowerCase()), score: kCSSTagNameScore });
  }

  if (element.nodeName === 'IFRAME') {
    for (const attribute of ['name', 'title']) {
      if (element.getAttribute(attribute))
        candidates.push({ engine: 'css', selector: `${cssEscape(element.nodeName.toLowerCase())}[${attribute}=${quoteCSSAttributeValue(element.getAttribute(attribute)!)}]`, score: kIframeByAttributeScore });
    }

    // Locate by testId via CSS selector.
    if (element.getAttribute(options.testIdAttributeName))
      candidates.push({ engine: 'css', selector: `[${options.testIdAttributeName}=${quoteCSSAttributeValue(element.getAttribute(options.testIdAttributeName)!)}]`, score: kTestIdScore });

    penalizeScoreForLength([candidates]);
    return candidates;
  }

  // Everything below is not applicable to iframes (getBy* methods).
  if (element.getAttribute(options.testIdAttributeName))
    candidates.push({ engine: 'internal:testid', selector: `[${options.testIdAttributeName}=${escapeForAttributeSelector(element.getAttribute(options.testIdAttributeName)!, true)}]`, score: kTestIdScore });

  if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    if (input.placeholder) {
      candidates.push({ engine: 'internal:attr', selector: `[placeholder=${escapeForAttributeSelector(input.placeholder, true)}]`, score: kPlaceholderScoreExact });
      for (const alternative of suitableTextAlternatives(input.placeholder))
        candidates.push({ engine: 'internal:attr', selector: `[placeholder=${escapeForAttributeSelector(alternative.text, false)}]`, score: kPlaceholderScore - alternative.scoreBonus });
    }
  }

  const labels = getElementLabels(injectedScript._evaluator._cacheText, element);
  for (const label of labels) {
    const labelText = label.normalized;
    candidates.push({ engine: 'internal:label', selector: escapeForTextSelector(labelText, true), score: kLabelScoreExact });
    for (const alternative of suitableTextAlternatives(labelText))
      candidates.push({ engine: 'internal:label', selector: escapeForTextSelector(alternative.text, false), score: kLabelScore - alternative.scoreBonus });
  }

  const ariaRole = getAriaRole(element);
  if (ariaRole && !['none', 'presentation'].includes(ariaRole))
    candidates.push({ engine: 'internal:role', selector: ariaRole, score: kRoleWithoutNameScore });

  if (element.getAttribute('name') && ['BUTTON', 'FORM', 'FIELDSET', 'FRAME', 'IFRAME', 'INPUT', 'KEYGEN', 'OBJECT', 'OUTPUT', 'SELECT', 'TEXTAREA', 'MAP', 'META', 'PARAM'].includes(element.nodeName))
    candidates.push({ engine: 'css', selector: `${cssEscape(element.nodeName.toLowerCase())}[name=${quoteCSSAttributeValue(element.getAttribute('name')!)}]`, score: kCSSInputTypeNameScore });

  if (['INPUT', 'TEXTAREA'].includes(element.nodeName) && element.getAttribute('type') !== 'hidden') {
    if (element.getAttribute('type'))
      candidates.push({ engine: 'css', selector: `${cssEscape(element.nodeName.toLowerCase())}[type=${quoteCSSAttributeValue(element.getAttribute('type')!)}]`, score: kCSSInputTypeNameScore });
  }

  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.nodeName) && element.getAttribute('type') !== 'hidden')
    candidates.push({ engine: 'css', selector: cssEscape(element.nodeName.toLowerCase()), score: kCSSInputTypeNameScore + 1 });

  penalizeScoreForLength([candidates]);
  return candidates;
}

function buildTextCandidates(injectedScript: InjectedScript, element: Element, isTargetNode: boolean): SelectorToken[][] {
  if (element.nodeName === 'SELECT')
    return [];
  const candidates: SelectorToken[][] = [];

  const title = element.getAttribute('title');
  if (title) {
    candidates.push([{ engine: 'internal:attr', selector: `[title=${escapeForAttributeSelector(title, true)}]`, score: kTitleScoreExact }]);
    for (const alternative of suitableTextAlternatives(title))
      candidates.push([{ engine: 'internal:attr', selector: `[title=${escapeForAttributeSelector(alternative.text, false)}]`, score: kTitleScore - alternative.scoreBonus }]);
  }

  const alt = element.getAttribute('alt');
  if (alt && ['APPLET', 'AREA', 'IMG', 'INPUT'].includes(element.nodeName)) {
    candidates.push([{ engine: 'internal:attr', selector: `[alt=${escapeForAttributeSelector(alt, true)}]`, score: kAltTextScoreExact }]);
    for (const alternative of suitableTextAlternatives(alt))
      candidates.push([{ engine: 'internal:attr', selector: `[alt=${escapeForAttributeSelector(alternative.text, false)}]`, score: kAltTextScore - alternative.scoreBonus }]);
  }

  const text = elementText(injectedScript._evaluator._cacheText, element).normalized;
  const textAlternatives = text ? suitableTextAlternatives(text) : [];
  if (text) {
    if (isTargetNode) {
      if (text.length <= 80)
        candidates.push([{ engine: 'internal:text', selector: escapeForTextSelector(text, true), score: kTextScoreExact }]);
      for (const alternative of textAlternatives)
        candidates.push([{ engine: 'internal:text', selector: escapeForTextSelector(alternative.text, false), score: kTextScore - alternative.scoreBonus }]);
    }
    const cssToken: SelectorToken = { engine: 'css', selector: cssEscape(element.nodeName.toLowerCase()), score: kCSSTagNameScore };
    for (const alternative of textAlternatives)
      candidates.push([cssToken, { engine: 'internal:has-text', selector: escapeForTextSelector(alternative.text, false), score: kTextScore - alternative.scoreBonus }]);
    if (text.length <= 80) {
      const re = new RegExp('^' + escapeRegExp(text) + '$');
      candidates.push([cssToken, { engine: 'internal:has-text', selector: escapeForTextSelector(re, false), score: kTextScoreRegex }]);
    }
  }

  const ariaRole = getAriaRole(element);
  if (ariaRole && !['none', 'presentation'].includes(ariaRole)) {
    const ariaName = getElementAccessibleName(element, false);
    if (ariaName) {
      const roleToken = { engine: 'internal:role', selector: `${ariaRole}[name=${escapeForAttributeSelector(ariaName, true)}]`, score: kRoleWithNameScoreExact };
      candidates.push([roleToken]);
      for (const alternative of suitableTextAlternatives(ariaName))
        candidates.push([{ engine: 'internal:role', selector: `${ariaRole}[name=${escapeForAttributeSelector(alternative.text, false)}]`, score: kRoleWithNameScore - alternative.scoreBonus }]);
    } else {
      const roleToken = { engine: 'internal:role', selector: `${ariaRole}`, score: kRoleWithoutNameScore };
      for (const alternative of textAlternatives)
        candidates.push([roleToken, { engine: 'internal:has-text', selector: escapeForTextSelector(alternative.text, false), score: kTextScore - alternative.scoreBonus }]);
      if (text.length <= 80) {
        const re = new RegExp('^' + escapeRegExp(text) + '$');
        candidates.push([roleToken, { engine: 'internal:has-text', selector: escapeForTextSelector(re, false), score: kTextScoreRegex }]);
      }
    }
  }

  penalizeScoreForLength(candidates);
  return candidates;
}

function makeSelectorForId(id: string) {
  return /^[a-zA-Z][a-zA-Z0-9\-\_]+$/.test(id) ? '#' + id : `[id="${cssEscape(id)}"]`;
}

function hasCSSIdToken(tokens: SelectorToken[]) {
  return tokens.some(token => token.engine === 'css' && (token.selector.startsWith('#') || token.selector.startsWith('[id="')));
}

function cssFallback(injectedScript: InjectedScript, targetElement: Element, options: InternalOptions): SelectorToken[] {
  const root: Node = options.root ?? targetElement.ownerDocument;
  const tokens: string[] = [];

  function uniqueCSSSelector(prefix?: string): string | undefined {
    const path = tokens.slice();
    if (prefix)
      path.unshift(prefix);
    const selector = path.join(' > ');
    const parsedSelector = injectedScript.parseSelector(selector);
    const node = injectedScript.querySelector(parsedSelector, root, false);
    return node === targetElement ? selector : undefined;
  }

  function makeStrict(selector: string): SelectorToken[] {
    const token = { engine: 'css', selector, score: kCSSFallbackScore };
    const parsedSelector = injectedScript.parseSelector(selector);
    const elements = injectedScript.querySelectorAll(parsedSelector, root);
    if (elements.length === 1)
      return [token];
    const nth = { engine: 'nth', selector: String(elements.indexOf(targetElement)), score: kNthScore };
    return [token, nth];
  }

  for (let element: Element | undefined = targetElement; element && element !== root; element = parentElementOrShadowHost(element)) {
    const nodeName = element.nodeName.toLowerCase();

    let bestTokenForLevel: string = '';

    // Element ID is the strongest signal, use it.
    if (element.id && !options.noCSSId) {
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
      const token = '.' + cssEscape(classes.slice(0, i + 1).join('.'));
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
      bestTokenForLevel = cssEscape(nodeName);
    }
    tokens.unshift(bestTokenForLevel);
  }
  return makeStrict(uniqueCSSSelector()!);
}

function penalizeScoreForLength(groups: SelectorToken[][]) {
  for (const group of groups) {
    for (const token of group) {
      if (token.score > kBeginPenalizedScore && token.score < kEndPenalizedScore)
        token.score += Math.min(kTextScoreRange, (token.selector.length / 10) | 0);
    }
  }
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

function chooseFirstSelector(injectedScript: InjectedScript, scope: Element | Document, targetElement: Element, selectors: SelectorToken[][], allowNthMatch: boolean): SelectorToken[] | null {
  const joined = selectors.map(tokens => ({ tokens, score: combineScores(tokens) }));
  joined.sort((a, b) => a.score - b.score);

  let bestWithIndex: SelectorToken[] | null = null;
  for (const { tokens } of joined) {
    const parsedSelector = injectedScript.parseSelector(joinTokens(tokens));
    const result = injectedScript.querySelectorAll(parsedSelector, scope);
    if (result[0] === targetElement && result.length === 1) {
      // We are the only match - found the best selector.
      return tokens;
    }

    // Otherwise, perhaps we can use nth=?
    const index = result.indexOf(targetElement);
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

function trimWordBoundary(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  text = text.substring(0, maxLength);
  // Find last word boundary in the text.
  const match = text.match(/^(.*)\b(.+?)$/);
  if (!match)
    return '';
  return match[1].trimEnd();
}

function suitableTextAlternatives(text: string) {
  let result: { text: string, scoreBonus: number }[] = [];

  {
    const match = text.match(/^([\d.,]+)[^.,\w]/);
    const leadingNumberLength = match ? match[1].length : 0;
    if (leadingNumberLength) {
      const alt = trimWordBoundary(text.substring(leadingNumberLength).trimStart(), 80);
      result.push({ text: alt, scoreBonus: alt.length <= 30 ? 2 : 1 });
    }
  }

  {
    const match = text.match(/[^.,\w]([\d.,]+)$/);
    const trailingNumberLength = match ? match[1].length : 0;
    if (trailingNumberLength) {
      const alt = trimWordBoundary(text.substring(0, text.length - trailingNumberLength).trimEnd(), 80);
      result.push({ text: alt, scoreBonus: alt.length <= 30 ? 2 : 1 });
    }
  }

  if (text.length <= 30) {
    result.push({ text, scoreBonus: 0 });
  } else {
    result.push({ text: trimWordBoundary(text, 80), scoreBonus: 0 });
    result.push({ text: trimWordBoundary(text, 30), scoreBonus: 1 });
  }

  result = result.filter(r => r.text);
  if (!result.length)
    result.push({ text: text.substring(0, 80), scoreBonus: 0 });

  return result;
}
