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

import { escapeForAttributeSelector, escapeForTextSelector, escapeRegExp, quoteCSSAttributeValue } from '@isomorphic/stringUtils';

import { beginDOMCaches, closestCrossShadow, endDOMCaches, isElementVisible, isInsideScope, parentElementOrShadowHost } from './domUtils';
import { beginAriaCaches, endAriaCaches, getAriaRole, getElementAccessibleName, getCSSContent } from './roleUtils';
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
  beginDOMCaches();
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
    endDOMCaches();
    endAriaCaches();
    injectedScript._evaluator.end();
  }
}

type InternalOptions = GenerateSelectorOptions & { noText?: boolean, noCSSId?: boolean, isRecursive?: boolean };

function generateSelectorFor(cache: Cache, injectedScript: InjectedScript, targetElement: Element, options: InternalOptions): SelectorToken[] | null {
  if (options.root && !isInsideScope(options.root, targetElement))
    throw new Error(`Target element must belong to the root's subtree`);

  if (targetElement === options.root)
    return [{ engine: 'css', selector: ':scope', score: 1 }];
  if (targetElement.ownerDocument.documentElement === targetElement)
    return [{ engine: 'css', selector: 'html', score: 1 }];

  let result: SelectorToken[] | null = null;
  const updateResult = (candidate: SelectorToken[]) => {
    if (!result || combineScores(candidate) < combineScores(result))
      result = candidate;
  };

  const candidates: { candidate: SelectorToken[], isTextCandidate: boolean }[] = [];
  if (!options.noText) {
    for (const candidate of buildTextCandidates(injectedScript, targetElement, !options.isRecursive))
      candidates.push({ candidate, isTextCandidate: true });
  }
  for (const token of buildNoTextCandidates(injectedScript, targetElement, options)) {
    if (options.omitInternalEngines && token.engine.startsWith('internal:'))
      continue;
    candidates.push({ candidate: [token], isTextCandidate: false });
  }
  candidates.sort((a, b) => combineScores(a.candidate) - combineScores(b.candidate));

  for (const { candidate, isTextCandidate } of candidates) {
    const elements = injectedScript.querySelectorAll(injectedScript.parseSelector(joinTokens(candidate)), options.root ?? targetElement.ownerDocument);
    if (!elements.includes(targetElement)) {
      // Somehow this selector just does not match the target. Oh well.
      continue;
    }

    if (elements.length === 1) {
      // Perfect strict match. All other candidates are strictly worse because they are sorted by score.
      updateResult(candidate);
      break;
    }

    const index = elements.indexOf(targetElement);
    if (index > 5) {
      // Do not generate locators with nth=6 or worse.
      continue;
    }
    updateResult([...candidate, { engine: 'nth', selector: String(index), score: kNthScore }]);

    if (options.isRecursive) {
      // Limit nesting to two levels: parent >>> target.
      continue;
    }

    // Now try nested selectors: (best selector for parent) >>> (this candidate selector).
    for (let parent = parentElementOrShadowHost(targetElement); parent && parent !== options.root; parent = parentElementOrShadowHost(parent)) {
      const filtered = elements.filter(e => isInsideScope(parent, e) && e !== parent);
      const newIndex = filtered.indexOf(targetElement);
      if (filtered.length > 5 || newIndex === -1 || (newIndex === index && filtered.length > 1)) {
        // Filtering to this parent is not an improvement - do not generate selector for parent.
        continue;
      }

      const inParent = filtered.length === 1 ? candidate : [...candidate, { engine: 'nth', selector: String(newIndex), score: kNthScore }];
      const idealSelectorForParent = { engine: '', selector: '', score: 1 }; // Best theoretical score we could achieve for the parent.
      if (result && combineScores([idealSelectorForParent, ...inParent]) >= combineScores(result)) {
        // It is impossible to generate a better scoring selector through this parent.
        continue;
      }

      // Do not allow text in parent selector when using text in the target selector.
      const noText = !!options.noText || isTextCandidate;
      const cacheMap = noText ? cache.disallowText : cache.allowText;
      let parentTokens = cacheMap.get(parent);
      if (parentTokens === undefined) {
        parentTokens = generateSelectorFor(cache, injectedScript, parent, { ...options, isRecursive: true, noText }) || cssFallback(injectedScript, parent, options);
        cacheMap.set(parent, parentTokens);
      }
      if (!parentTokens)
        continue;

      updateResult([...parentTokens, ...inParent]);
    }
  }
  return result;
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

    candidates.push({ engine: 'css', selector: escapeNodeName(element), score: kCSSTagNameScore });
  }

  if (element.nodeName === 'IFRAME') {
    for (const attribute of ['name', 'title']) {
      if (element.getAttribute(attribute))
        candidates.push({ engine: 'css', selector: `${escapeNodeName(element)}[${attribute}=${quoteCSSAttributeValue(element.getAttribute(attribute)!)}]`, score: kIframeByAttributeScore });
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
    candidates.push({ engine: 'css', selector: `${escapeNodeName(element)}[name=${quoteCSSAttributeValue(element.getAttribute('name')!)}]`, score: kCSSInputTypeNameScore });

  if (['INPUT', 'TEXTAREA'].includes(element.nodeName) && element.getAttribute('type') !== 'hidden') {
    if (element.getAttribute('type'))
      candidates.push({ engine: 'css', selector: `${escapeNodeName(element)}[type=${quoteCSSAttributeValue(element.getAttribute('type')!)}]`, score: kCSSInputTypeNameScore });
  }

  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.nodeName) && element.getAttribute('type') !== 'hidden')
    candidates.push({ engine: 'css', selector: escapeNodeName(element), score: kCSSInputTypeNameScore + 1 });

  penalizeScoreForLength([candidates]);
  return candidates;
}

function buildTextCandidates(injectedScript: InjectedScript, element: Element, isTargetNode: boolean): SelectorToken[][] {
  if (element.nodeName === 'SELECT')
    return [];
  const candidates: SelectorToken[][] = [];

  const title = element.getAttribute('title');
  if (title) {
    // Always prefer the exact, full title text
    candidates.push([{ engine: 'internal:attr', selector: `[title=${escapeForAttributeSelector(title, true)}]`, score: kTitleScoreExact }]);
    // Only add truncated alternatives if the title is very long (>100 chars) to avoid ambiguity
    if (title.length > 100) {
      for (const alternative of suitableTextAlternatives(title))
        candidates.push([{ engine: 'internal:attr', selector: `[title=${escapeForAttributeSelector(alternative.text, false)}]`, score: kTitleScore - alternative.scoreBonus + 50 }]);
        // Add penalty (+50) to truncated versions so full text is always preferred
    }
  }

  const alt = element.getAttribute('alt');
  if (alt && ['APPLET', 'AREA', 'IMG', 'INPUT'].includes(element.nodeName)) {
    candidates.push([{ engine: 'internal:attr', selector: `[alt=${escapeForAttributeSelector(alt, true)}]`, score: kAltTextScoreExact }]);
    for (const alternative of suitableTextAlternatives(alt))
      candidates.push([{ engine: 'internal:attr', selector: `[alt=${escapeForAttributeSelector(alternative.text, false)}]`, score: kAltTextScore - alternative.scoreBonus }]);
  }

  const rawText = elementText(injectedScript._evaluator._cacheText, element).normalized;
  // Clean icon text from element text to avoid using icon content as selectors
  const text = rawText ? removeIconTextFromAccessibleName(element, rawText) : '';
  const textAlternatives = text ? suitableTextAlternatives(text) : [];
  if (text) {
    if (isTargetNode) {
      if (text.length <= 80)
        candidates.push([{ engine: 'internal:text', selector: escapeForTextSelector(text, true), score: kTextScoreExact }]);
      for (const alternative of textAlternatives)
        candidates.push([{ engine: 'internal:text', selector: escapeForTextSelector(alternative.text, false), score: kTextScore - alternative.scoreBonus }]);
    }
    const cssToken: SelectorToken = { engine: 'css', selector: escapeNodeName(element), score: kCSSTagNameScore };
    for (const alternative of textAlternatives)
      candidates.push([cssToken, { engine: 'internal:has-text', selector: escapeForTextSelector(alternative.text, false), score: kTextScore - alternative.scoreBonus }]);
    if (isTargetNode && text.length <= 80) {
      // Do not use regex for parent elements (for performance).
      const re = new RegExp('^' + escapeRegExp(text) + '$');
      candidates.push([cssToken, { engine: 'internal:has-text', selector: escapeForTextSelector(re, false), score: kTextScoreRegex }]);
    }
  }

  const ariaRole = getAriaRole(element);
  if (ariaRole && !['none', 'presentation'].includes(ariaRole)) {
    const ariaName = getElementAccessibleName(element, false);
    if (ariaName && ariaName.trim() && !isSpecialCharacterName(ariaName)) {
      const cleanedName = removeIconTextFromAccessibleName(element, ariaName);
      const trimmedName = cleanedName.trim();
      if (trimmedName) {
        const roleToken = { engine: 'internal:role', selector: `${ariaRole}[name=${escapeForAttributeSelector(trimmedName, true)}]`, score: kRoleWithNameScoreExact };
        candidates.push([roleToken]);
        for (const alternative of suitableTextAlternatives(trimmedName))
          candidates.push([{ engine: 'internal:role', selector: `${ariaRole}[name=${escapeForAttributeSelector(alternative.text, false)}]`, score: kRoleWithNameScore - alternative.scoreBonus }]);
      }
    } else {
      const improvedLocator = findImprovedLocatorForRole(injectedScript, element, ariaRole);
      if (improvedLocator) {
        candidates.push(improvedLocator);
      } else if (text && text.trim()) {
        // Only add hasText filters if there's meaningful text after icon removal
        const roleToken = { engine: 'internal:role', selector: `${ariaRole}`, score: kRoleWithoutNameScore };
        for (const alternative of textAlternatives)
          candidates.push([roleToken, { engine: 'internal:has-text', selector: escapeForTextSelector(alternative.text, false), score: kTextScore - alternative.scoreBonus }]);
        if (isTargetNode && text.length <= 80) {
          // Do not use regex for parent elements (for performance).
          const re = new RegExp('^' + escapeRegExp(text) + '$');
          candidates.push([roleToken, { engine: 'internal:has-text', selector: escapeForTextSelector(re, false), score: kTextScoreRegex }]);
        }
      }
      // Note: If no text after icon removal, don't add role-based candidates.
      // Let the selector generation fall through to CSS selectors or nth-child in generateSelectorFor()
    }
  }

  penalizeScoreForLength(candidates);
  return candidates;
}

function makeSelectorForId(id: string) {
  return /^[a-zA-Z][a-zA-Z0-9\-\_]+$/.test(id) ? '#' + id : `[id=${quoteCSSAttributeValue(id)}]`;
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
    const classes = [...element.classList].map(escapeClassName);
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
      const nodeName = element.nodeName;
      const sameTagSiblings = siblings.filter(sibling => sibling.nodeName === nodeName);
      const token = sameTagSiblings.indexOf(element) === 0 ? escapeNodeName(element) : `${escapeNodeName(element)}:nth-child(${1 + siblings.indexOf(element)})`;
      const selector = uniqueCSSSelector(token);
      if (selector)
        return makeStrict(selector);
      if (!bestTokenForLevel)
        bestTokenForLevel = token;
    } else if (!bestTokenForLevel) {
      bestTokenForLevel = escapeNodeName(element);
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

function escapeNodeName(node: Node): string {
  // We are escaping it for document.querySelectorAll, not for usage in CSS file.
  return node.nodeName.toLocaleLowerCase().replace(/[:\.]/g, char => '\\' + char);
}

function escapeClassName(className: string): string {
  // We are escaping class names for document.querySelectorAll by following CSS.escape() rules.
  let result = '';
  for (let i = 0; i < className.length; i++)
    result += cssEscapeCharacter(className, i);
  return result;
}

function cssEscapeCharacter(s: string, i: number): string {
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

function isSpecialCharacterName(name: string): boolean {
  if (!name || !name.trim()) return true;
  const trimmed = name.trim();

  // Check 1: Icon/emoji Unicode ranges and common UI symbols (language-agnostic)
  // Check 2: Short non-alphanumeric strings like "×", "•" (language-agnostic)
  // Check 3: Generic English words commonly used in international UIs
  // Note: English terms are checked as they appear globally in web UIs. Language-specific
  // generic terms (e.g., "fermer" in French for "close") may still generate locators,
  // which is acceptable as they remain functional and usable.
  return /^[\u2190-\u27BF\u2B00-\u2BFF\u1F000-\u1FA6F\u1FA70-\u1FAFF\uE000-\uF8FF\uFFF0-\uFFFF⚙️⚙🔧×✕✖•·…⋮⋯xX✗✘]+$/.test(trimmed) ||
         (trimmed.length <= 2 && /^[^\w\s]*$/.test(trimmed)) ||
         /^(icon|svg|image|img|graphic|logo|menu|hamburger|close|button|link|click here|more|toggle|expand|collapse|open|[A-Z]{2,})$/i.test(trimmed);
}

function findImprovedLocatorForRole(injectedScript: InjectedScript, element: Element, ariaRole: string): SelectorToken[] | null {
  // Priority 1: Check aria-label attribute
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim() && !isSpecialCharacterName(ariaLabel)) {
    return [{ engine: 'internal:role', selector: `${ariaRole}[name=${escapeForAttributeSelector(ariaLabel.trim(), true)}]`, score: kRoleWithNameScore }];
  }

  // Priority 2: Check title attribute (tooltip text)
  const titleAttr = element.getAttribute('title');
  if (titleAttr && titleAttr.trim() && !isSpecialCharacterName(titleAttr)) {
    return [{ engine: 'internal:role', selector: `${ariaRole}[name=${escapeForAttributeSelector(titleAttr.trim(), true)}]`, score: kRoleWithNameScore + 10 }];
  }

  // Priority 3: Check for img alt text inside the element
  const imgElement = element.querySelector('img');
  if (imgElement) {
    const imgAlt = imgElement.getAttribute('alt');
    if (imgAlt && imgAlt.trim() && !isSpecialCharacterName(imgAlt)) {
      return [{ engine: 'internal:role', selector: `${ariaRole}[name=${escapeForAttributeSelector(imgAlt.trim(), true)}]`, score: kRoleWithNameScore + 5 }];
    }
  }

  // Priority 4: Look for nearby elements with meaningful text that could help identify this element
  // NOTE: We are conservative here to avoid false positives where unrelated text is used
  const parent = parentElementOrShadowHost(element);
  if (!parent) return null;

  // Look for IMMEDIATE sibling elements with meaningful text (only adjacent siblings)
  const siblings = Array.from(parent.children);
  const currentIndex = siblings.indexOf(element);

  // CONSERVATIVE: Only check immediate previous sibling (index - 1)
  // This is safer than checking ±2 siblings which might be unrelated
  if (currentIndex > 0) {
    const prevSibling = siblings[currentIndex - 1];
    const siblingText = elementText(injectedScript._evaluator._cacheText, prevSibling).normalized;
    const siblingRole = getAriaRole(prevSibling);

    // Only use sibling text if it's a semantic heading/label element
    if (siblingText && siblingText.trim().length > 2 && !isSpecialCharacterName(siblingText)) {
      if (siblingRole && ['heading', 'label'].includes(siblingRole)) {
        // Use role-based filter chain: heading >> button
        return [
          { engine: 'internal:role', selector: `${siblingRole}[name=${escapeForAttributeSelector(siblingText.trim(), false)}]`, score: kRoleWithNameScore },
          { engine: 'internal:role', selector: ariaRole, score: kRoleWithoutNameScore }
        ];
      }
    }
  }

  // CONSERVATIVE: Look for DIRECT parent (depth = 1 only) with a semantic role
  // Avoid going up 3 levels which is too risky for false positives
  if (parent) {
    const parentRole = getAriaRole(parent);
    // Only use parent if it has a meaningful semantic container role
    // Includes ARIA landmark roles and semantic HTML5 container roles for better global coverage
    if (parentRole && ['region', 'group', 'article', 'section', 'navigation', 'banner', 'complementary', 'contentinfo', 'form', 'main', 'search'].includes(parentRole)) {
      const parentName = getElementAccessibleName(parent, false);
      if (parentName && parentName.trim() && !isSpecialCharacterName(parentName)) {
        return [
          { engine: 'internal:role', selector: `${parentRole}[name=${escapeForAttributeSelector(parentName.trim(), false)}]`, score: kRoleWithNameScore + 50 },
          { engine: 'internal:role', selector: ariaRole, score: kRoleWithoutNameScore }
        ];
      }
    }
  }

  // If we can't find a safe contextual selector, return null
  // This will cause the system to fall back to CSS selectors or nth-child
  return null;
}

function isIconElement(element: Element): boolean {
  const nodeName = element.nodeName.toLowerCase();

  // Check for icon tag names - includes standard elements, custom elements ending with -icon,
  // and known icon library custom element prefixes for better global coverage
  if (nodeName === 'i' ||
      nodeName === 'svg' ||
      nodeName.endsWith('-icon') ||
      /^(lucide|heroicon|feather|phosphor|tabler|iconify)(-|$)/.test(nodeName))
    return true;

  // Check for common icon CSS class patterns - expanded for global icon library coverage
  // Includes: FontAwesome, Material Design Icons, Bootstrap Icons, Glyphicons, Lucide,
  // Heroicons, Feather, Tabler, Remix Icons, Phosphor, IcoMoon, Iconify, and generic patterns
  const className = element.className || '';
  if (typeof className === 'string') {
    // Split by space to check individual classes, as className contains all classes
    const classes = className.split(/\s+/);
    for (const cls of classes) {
      if (/^(icon|fa[slrb]?|mdi|bi|glyphicon|lucide|heroicon|feather|ti|tabler|ri|ph|im|iconify)(-|$)|(-icon)(-|$)|^material-icons?$/i.test(cls))
        return true;
    }
  }

  // Check for icon-like ARIA attributes on any element (language-agnostic, globally applicable)
  if ((element.getAttribute('aria-hidden') === 'true' && !element.textContent?.trim()) || element.getAttribute('role') === 'img')
    return true;

  // Check for data attributes used by modern icon libraries (library-specific conventions)
  if (element.hasAttribute('data-icon') || element.hasAttribute('data-lucide') || element.hasAttribute('data-feather'))
    return true;

  // Check for empty/single-character elements that look like icons
  const textLen = (element.textContent?.trim() || '').length;
  return (textLen <= 1) && ['i', 'span', 'em'].includes(nodeName);
}

function removeIconTextFromAccessibleName(element: Element, accessibleName: string): string {
  const iconTexts: string[] = [];
  const MAX_DEPTH = 50; // Prevent stack overflow from pathologically deep DOM trees

  const collectIconText = (el: Element, depth: number) => {
    if (depth > MAX_DEPTH) return; // Safety limit for deeply nested structures

    if (isIconElement(el)) {
      const before = getCSSContent(el, '::before');
      const after = getCSSContent(el, '::after');
      if (before) iconTexts.push(before);
      if (after) iconTexts.push(after);
      // Only collect direct text nodes, not nested element text
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
          iconTexts.push(node.textContent.trim());
      }
    }
    for (const child of Array.from(el.children))
      collectIconText(child, depth + 1);
  };

  collectIconText(element, 0);

  // Optimize: Use single regex replacement instead of multiple string replacements
  let cleanedName = accessibleName;
  // Filter out empty strings and whitespace-only entries before building regex
  const validIconTexts = iconTexts.filter(text => text && text.trim().length > 0);
  if (validIconTexts.length > 0) {
    const escapedTexts = validIconTexts.map(text => escapeRegExp(text));
    const regex = new RegExp(escapedTexts.join('|'), 'g');
    cleanedName = cleanedName.replace(regex, '');
  }

  // Normalize whitespace and trim. This handles cases where icon removal
  // leaves leading/trailing spaces or multiple consecutive spaces.
  return cleanedName.replace(/\s+/g, ' ').trim();
}
