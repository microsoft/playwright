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

import { escapeForAttributeSelector, escapeForTextSelector } from './stringUtils';
import { asLocators } from './locatorGenerators';
import type { Language, Quote } from './locatorGenerators';
import { parseSelector } from './selectorParser';

type TemplateParams = { quote: string, text: string }[];
function parseLocator(locator: string, testIdAttributeName: string): { selector: string, preferredQuote: Quote | undefined } {
  locator = locator
      .replace(/AriaRole\s*\.\s*([\w]+)/g, (_, group) => group.toLowerCase())
      .replace(/(get_by_role|getByRole)\s*\(\s*(?:["'`])([^'"`]+)['"`]/g, (_, group1, group2) => `${group1}(${group2.toLowerCase()}`);
  const params: TemplateParams = [];
  let template = '';
  for (let i = 0; i < locator.length; ++i) {
    const quote = locator[i];
    if (quote !== '"' && quote !== '\'' && quote !== '`' && quote !== '/') {
      template += quote;
      continue;
    }
    const isRegexEscaping = locator[i - 1] === 'r' || locator[i] === '/';
    ++i;
    let text = '';
    while (i < locator.length) {
      if (locator[i] === '\\') {
        if (isRegexEscaping) {
          if (locator[i + 1] !== quote)
            text += locator[i];
          ++i;
          text += locator[i];
        } else {
          ++i;
          if (locator[i] === 'n')
            text += '\n';
          else if (locator[i] === 'r')
            text += '\r';
          else if (locator[i] === 't')
            text += '\t';
          else
            text += locator[i];
        }
        ++i;
        continue;
      }
      if (locator[i] !== quote) {
        text += locator[i++];
        continue;
      }
      break;
    }
    params.push({ quote, text });
    template += (quote === '/' ? 'r' : '') + '$' + params.length;
  }

  // Equalize languages.
  template = template.toLowerCase()
      .replace(/get_by_alt_text/g, 'getbyalttext')
      .replace(/get_by_test_id/g, 'getbytestid')
      .replace(/get_by_([\w]+)/g, 'getby$1')
      .replace(/has_not_text/g, 'hasnottext')
      .replace(/has_text/g, 'hastext')
      .replace(/has_not/g, 'hasnot')
      .replace(/frame_locator/g, 'framelocator')
      .replace(/content_frame/g, 'contentframe')
      .replace(/[{}\s]/g, '')
      .replace(/new\(\)/g, '')
      .replace(/new[\w]+\.[\w]+options\(\)/g, '')
      .replace(/\.set/g, ',set')
      .replace(/\.or_\(/g, 'or(') // Python has "or_" instead of "or".
      .replace(/\.and_\(/g, 'and(') // Python has "and_" instead of "and".
      .replace(/:/g, '=')
      .replace(/,re\.ignorecase/g, 'i')
      .replace(/,pattern.case_insensitive/g, 'i')
      .replace(/,regexoptions.ignorecase/g, 'i')
      .replace(/re.compile\(([^)]+)\)/g, '$1') // Python has regex strings as r"foo"
      .replace(/pattern.compile\(([^)]+)\)/g, 'r$1')
      .replace(/newregex\(([^)]+)\)/g, 'r$1')
      .replace(/string=/g, '=')
      .replace(/regex=/g, '=')
      .replace(/,,/g, ',');

  const preferredQuote = params.map(p => p.quote).filter(quote => '\'"`'.includes(quote))[0] as Quote | undefined;
  return { selector: transform(template, params, testIdAttributeName), preferredQuote };
}

function countParams(template: string) {
  return [...template.matchAll(/\$\d+/g)].length;
}

function shiftParams(template: string, sub: number) {
  return template.replace(/\$(\d+)/g, (_, ordinal) => `$${ordinal - sub}`);
}

function transform(template: string, params: TemplateParams, testIdAttributeName: string): string {
  // Recursively handle filter(has=, hasnot=, sethas(), sethasnot()).
  // TODO: handle and(locator), or(locator), locator(locator), locator(has=, hasnot=, sethas(), sethasnot()).
  while (true) {
    const hasMatch = template.match(/filter\(,?(has=|hasnot=|sethas\(|sethasnot\()/);
    if (!hasMatch)
      break;

    // Extract inner locator based on balanced parens.
    const start = hasMatch.index! + hasMatch[0].length;
    let balance = 0;
    let end = start;
    for (; end < template.length; end++) {
      if (template[end] === '(')
        balance++;
      else if (template[end] === ')')
        balance--;
      if (balance < 0)
        break;
    }

    // Replace Java sethas(...) and sethasnot(...) with has=... and hasnot=...
    let prefix = template.substring(0, start);
    let extraSymbol = 0;
    if (['sethas(', 'sethasnot('].includes(hasMatch[1])) {
      // Eat extra ) symbol at the end of sethas(...)
      extraSymbol = 1;
      prefix = prefix.replace(/sethas\($/, 'has=').replace(/sethasnot\($/, 'hasnot=');
    }

    const paramsCountBeforeHas = countParams(template.substring(0, start));
    const hasTemplate = shiftParams(template.substring(start, end), paramsCountBeforeHas);
    const paramsCountInHas = countParams(hasTemplate);
    const hasParams = params.slice(paramsCountBeforeHas, paramsCountBeforeHas + paramsCountInHas);
    const hasSelector = JSON.stringify(transform(hasTemplate, hasParams, testIdAttributeName));

    // Replace filter(has=...) with filter(has2=$5). Use has2 to avoid matching the same filter again.
    // Replace filter(hasnot=...) with filter(hasnot2=$5). Use hasnot2 to avoid matching the same filter again.
    template = prefix.replace(/=$/, '2=') + `$${paramsCountBeforeHas + 1}` + shiftParams(template.substring(end + extraSymbol), paramsCountInHas - 1);

    // Replace inner params with $5 value.
    const paramsBeforeHas = params.slice(0, paramsCountBeforeHas);
    const paramsAfterHas = params.slice(paramsCountBeforeHas + paramsCountInHas);
    params = paramsBeforeHas.concat([{ quote: '"', text: hasSelector }]).concat(paramsAfterHas);
  }

  // Transform to selector engines.
  template = template
      .replace(/\,set([\w]+)\(([^)]+)\)/g, (_, group1, group2) => ',' + group1.toLowerCase() + '=' + group2.toLowerCase())
      .replace(/framelocator\(([^)]+)\)/g, '$1.internal:control=enter-frame')
      .replace(/contentframe(\(\))?/g, 'internal:control=enter-frame')
      .replace(/locator\(([^)]+),hastext=([^),]+)\)/g, 'locator($1).internal:has-text=$2')
      .replace(/locator\(([^)]+),hasnottext=([^),]+)\)/g, 'locator($1).internal:has-not-text=$2')
      .replace(/locator\(([^)]+),hastext=([^),]+)\)/g, 'locator($1).internal:has-text=$2')
      .replace(/locator\(([^)]+)\)/g, '$1')
      .replace(/getbyrole\(([^)]+)\)/g, 'internal:role=$1')
      .replace(/getbytext\(([^)]+)\)/g, 'internal:text=$1')
      .replace(/getbylabel\(([^)]+)\)/g, 'internal:label=$1')
      .replace(/getbytestid\(([^)]+)\)/g, `internal:testid=[${testIdAttributeName}=$1]`)
      .replace(/getby(placeholder|alt|title)(?:text)?\(([^)]+)\)/g, 'internal:attr=[$1=$2]')
      .replace(/first(\(\))?/g, 'nth=0')
      .replace(/last(\(\))?/g, 'nth=-1')
      .replace(/nth\(([^)]+)\)/g, 'nth=$1')
      .replace(/filter\(,?hastext=([^)]+)\)/g, 'internal:has-text=$1')
      .replace(/filter\(,?hasnottext=([^)]+)\)/g, 'internal:has-not-text=$1')
      .replace(/filter\(,?has2=([^)]+)\)/g, 'internal:has=$1')
      .replace(/filter\(,?hasnot2=([^)]+)\)/g, 'internal:has-not=$1')
      .replace(/,exact=false/g, '')
      .replace(/,exact=true/g, 's')
      .replace(/\,/g, '][');

  const parts = template.split('.');
  // Turn "internal:control=enter-frame >> nth=0" into "nth=0 >> internal:control=enter-frame"
  // because these are swapped in locators vs selectors.
  for (let index = 0; index < parts.length - 1; index++) {
    if (parts[index] === 'internal:control=enter-frame' && parts[index + 1].startsWith('nth=')) {
      // Swap nth and enter-frame.
      const [nth] = parts.splice(index, 1);
      parts.splice(index + 1, 0, nth);
    }
  }

  // Substitute params.
  return parts.map(t => {
    if (!t.startsWith('internal:') || t === 'internal:control')
      return t.replace(/\$(\d+)/g, (_, ordinal) => { const param = params[+ordinal - 1]; return param.text; });
    t = t.includes('[') ? t.replace(/\]/, '') + ']' : t;
    t = t
        .replace(/(?:r)\$(\d+)(i)?/g, (_, ordinal, suffix) => {
          const param = params[+ordinal - 1];
          if (t.startsWith('internal:attr') || t.startsWith('internal:testid') || t.startsWith('internal:role'))
            return escapeForAttributeSelector(new RegExp(param.text), false) + (suffix || '');
          return escapeForTextSelector(new RegExp(param.text, suffix), false);
        })
        .replace(/\$(\d+)(i|s)?/g, (_, ordinal, suffix) => {
          const param = params[+ordinal - 1];
          if (t.startsWith('internal:has=') || t.startsWith('internal:has-not='))
            return param.text;
          if (t.startsWith('internal:testid'))
            return escapeForAttributeSelector(param.text, true);
          if (t.startsWith('internal:attr') || t.startsWith('internal:role'))
            return escapeForAttributeSelector(param.text, suffix === 's');
          return escapeForTextSelector(param.text, suffix === 's');
        });
    return t;
  }).join(' >> ');
}

export function locatorOrSelectorAsSelector(language: Language, locator: string, testIdAttributeName: string): string {
  try {
    parseSelector(locator);
    return locator;
  } catch (e) {
  }
  try {
    const { selector, preferredQuote } = parseLocator(locator, testIdAttributeName);
    const locators = asLocators(language, selector, undefined, undefined, preferredQuote);
    const digest = digestForComparison(language, locator);
    if (locators.some(candidate => digestForComparison(language, candidate) === digest))
      return selector;
  } catch (e) {
  }
  return '';
}

function digestForComparison(language: Language, locator: string) {
  locator = locator.replace(/\s/g, '');
  if (language === 'javascript')
    locator = locator.replace(/\\?["`]/g, '\'');
  return locator;
}
