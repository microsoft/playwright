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

import { escapeForAttributeSelector, escapeForTextSelector } from '../../utils/isomorphic/stringUtils';
import { asLocator } from './locatorGenerators';
import type { Language } from './locatorGenerators';
import { parseSelector } from './selectorParser';

function parseLocator(locator: string): string {
  locator = locator
      .replace(/AriaRole\s*\.\s*([\w]+)/g, (_, group) => group.toLowerCase())
      .replace(/(get_by_role|getByRole)\s*\(\s*(?:["'`])([^'"`]+)['"`]/g, (_, group1, group2) => `${group1}(${group2.toLowerCase()}`);
  const params: { quote: string, text: string }[] = [];
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
      .replace(/has_text/g, 'hastext')
      .replace(/[{}\s]/g, '')
      .replace(/new\(\)/g, '')
      .replace(/new[\w]+\.[\w]+options\(\)/g, '')
      .replace(/\.set([\w]+)\(([^)]+)\)/g, (_, group1, group2) => ',' + group1.toLowerCase() + '=' + group2.toLowerCase())
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

  // Transform.
  template = template
      .replace(/locator\(([^)]+)\)/g, '$1')
      .replace(/getbyrole\(([^)]+)\)/g, 'internal:role=$1')
      .replace(/getbytext\(([^)]+)\)/g, 'internal:text=$1')
      .replace(/getbylabel\(([^)]+)\)/g, 'internal:label=$1')
      .replace(/getbytestid\(([^)]+)\)/g, 'internal:attr=[data-testid=$1s]')
      .replace(/getby(placeholder|alt|title)(?:text)?\(([^)]+)\)/g, 'internal:attr=[$1=$2]')
      .replace(/first(\(\))?/g, 'nth=0')
      .replace(/last(\(\))?/g, 'nth=-1')
      .replace(/nth\(([^)]+)\)/g, 'nth=$1')
      .replace(/filter\(.*hastext=([^)]+)\)/g, 'internal:has-text=$1')
      .replace(/,exact=false/g, '')
      .replace(/,exact=true/g, 's')
      .replace(/\,/g, '][');

  return template.split('.').map(t => {
    if (!t.startsWith('internal:'))
      return t.replace(/\$(\d+)/g, (_, ordinal) => { const param = params[+ordinal - 1]; return param.text; });
    t = t.includes('[') ? t.replace(/\]/, '') + ']' : t;
    t = t
        .replace(/(?:r)\$(\d+)(i)?/g, (_, ordinal, suffix) => {
          const param = params[+ordinal - 1];
          if (t.startsWith('internal:attr') || t.startsWith('internal:role'))
            return new RegExp(param.text) + (suffix || '');
          return escapeForTextSelector(new RegExp(param.text, suffix), false);
        })
        .replace(/\$(\d+)(i|s)?/g, (_, ordinal, suffix) => {
          const param = params[+ordinal - 1];
          if (t.startsWith('internal:attr') || t.startsWith('internal:role'))
            return escapeForAttributeSelector(param.text, suffix === 's');
          return escapeForTextSelector(param.text, suffix === 's');
        });
    return t;
  }).join(' >> ');
}

export function locatorOrSelectorAsSelector(language: Language, locator: string): string {
  try {
    parseSelector(locator);
    return locator;
  } catch (e) {
  }
  try {
    const selector = parseLocator(locator);
    if (digestForComparison(asLocator(language, selector)) === digestForComparison(locator))
      return selector;
  } catch (e) {
  }
  return locator;
}

function digestForComparison(locator: string) {
  return locator.replace(/\s/g, '').replace(/["`]/g, '\'');
}
