/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { TestCaseSummary } from './types';

type FilterToken = {
  name: string;
  not: boolean;
};

export class Filter {
  project: FilterToken[] = [];
  status: FilterToken[] = [];
  text: FilterToken[] = [];
  labels: FilterToken[] = [];
  annotations: FilterToken[] = [];

  empty(): boolean {
    return (
      this.project.length + this.status.length + this.text.length +
      this.labels.length + this.annotations.length
    ) === 0;
  }

  static parse(expression: string): Filter {
    const tokens = Filter.tokenize(expression);
    const project = new Set<FilterToken>();
    const status = new Set<FilterToken>();
    const text: FilterToken[] = [];
    const labels = new Set<FilterToken>();
    const annotations = new Set<FilterToken>();
    for (let token of tokens) {
      const not = token.startsWith('!');
      if (not)
        token = token.slice(1);

      if (token.startsWith('p:')) {
        project.add({ name: token.slice(2), not });
        continue;
      }
      if (token.startsWith('s:')) {
        status.add({ name: token.slice(2), not });
        continue;
      }
      if (token.startsWith('@')) {
        labels.add({ name: token, not });
        continue;
      }
      if (token.startsWith('annot:')) {
        annotations.add({ name: token.slice('annot:'.length), not });
        continue;
      }
      text.push({ name: token.toLowerCase(), not });
    }

    const filter = new Filter();
    filter.text = text;
    filter.project = [...project];
    filter.status = [...status];
    filter.labels = [...labels];
    filter.annotations = [...annotations];
    return filter;
  }

  private static tokenize(expression: string): string[] {
    const result: string[] = [];
    let quote: '\'' | '"' | undefined;
    let token: string[] = [];
    for (let i = 0; i < expression.length; ++i) {
      const c = expression[i];
      if (quote && c === '\\' && expression[i + 1] === quote) {
        token.push(quote);
        ++i;
        continue;
      }
      if (c === '"' || c === '\'') {
        if (quote === c) {
          result.push(token.join('').toLowerCase());
          token = [];
          quote = undefined;
        } else if (quote) {
          token.push(c);
        } else {
          quote = c;
        }
        continue;
      }
      if (quote) {
        token.push(c);
        continue;
      }
      if (c === ' ') {
        if (token.length) {
          result.push(token.join('').toLowerCase());
          token = [];
        }
        continue;
      }
      token.push(c);
    }
    if (token.length)
      result.push(token.join('').toLowerCase());
    return result;
  }

  matches(test: TestCaseSummary): boolean {
    const searchValues = cacheSearchValues(test);
    if (this.project.length) {
      const matches = !!this.project.find(p => {
        const match = searchValues.project.includes(p.name);
        return p.not ? !match : match;
      });
      if (!matches)
        return false;
    }
    if (this.status.length) {
      const matches = !!this.status.find(s => {
        const match = searchValues.status.includes(s.name);
        return s.not ? !match : match;
      });
      if (!matches)
        return false;
    } else {
      if (searchValues.status === 'skipped')
        return false;
    }
    if (this.text.length) {
      const matches = this.text.every(text => {
        if (searchValues.text.includes(text.name))
          return text.not ? false : true;

        const [fileName, line, column] = text.name.split(':');
        if (searchValues.file.includes(fileName) && searchValues.line === line && (column === undefined || searchValues.column === column))
          return text.not ? false : true;

        return text.not ? true : false;
      });
      if (!matches)
        return false;
    }
    if (this.labels.length) {
      const matches = this.labels.every(l => {
        const match = searchValues.labels.includes(l.name);
        return l.not ? !match : match;
      });
      if (!matches)
        return false;
    }
    if (this.annotations.length) {
      const matches = this.annotations.every(annotation => {
        const match = searchValues.annotations.some(a => a.includes(annotation.name));
        return annotation.not ? !match : match;
      });
      if (!matches)
        return false;
    }
    return true;
  }
}

type SearchValues = {
  text: string;
  project: string;
  status: 'passed' | 'failed' | 'flaky' | 'skipped';
  file: string;
  line: string;
  column: string;
  labels: string[];
  annotations: string[];
};

const searchValuesSymbol = Symbol('searchValues');

function cacheSearchValues(test: TestCaseSummary & { [searchValuesSymbol]?: SearchValues }): SearchValues {
  const cached = test[searchValuesSymbol];
  if (cached)
    return cached;

  let status: SearchValues['status'] = 'passed';
  if (test.outcome === 'unexpected')
    status = 'failed';
  if (test.outcome === 'flaky')
    status = 'flaky';
  if (test.outcome === 'skipped')
    status = 'skipped';
  const searchValues: SearchValues = {
    text: (status + ' ' + test.projectName + ' ' + test.tags.join(' ') + ' ' + test.location.file + ' ' + test.path.join(' ') + ' ' + test.title).toLowerCase(),
    project: test.projectName.toLowerCase(),
    status,
    file: test.location.file,
    line: String(test.location.line),
    column: String(test.location.column),
    labels: test.tags.map(tag => tag.toLowerCase()),
    annotations: test.annotations.map(a => a.type.toLowerCase() + '=' + a.description?.toLocaleLowerCase())
  };
  test[searchValuesSymbol] = searchValues;
  return searchValues;
}

// Extract quoted groups of search params, or tokens separated by whitespace
const SEARCH_PARAM_GROUP_REGEX = /("[^"]*"|"[^"]*$|\S+)/g;

export function filterWithQuery(existingQuery: string, token: string, append: boolean): string {
  const tokens = [...existingQuery.matchAll(SEARCH_PARAM_GROUP_REGEX)].map(m => {
    const rawValue = m[0];
    return rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length > 1 ? rawValue.slice(1, rawValue.length - 1) : rawValue;
  });
  if (append)
    return '#?q=' + joinTokens(!tokens.includes(token) ? [...tokens, token] : tokens.filter(t => t !== token));

  // if metaKey or ctrlKey is not pressed, replace existing token with new token
  let prefix: 's:' | 'p:' | '@';
  if (token.startsWith('s:'))
    prefix = 's:';
  if (token.startsWith('p:'))
    prefix = 'p:';
  if (token.startsWith('@'))
    prefix = '@';

  const newTokens = tokens.filter(t => !t.startsWith(prefix));
  newTokens.push(token);
  return '#?q=' + joinTokens(newTokens);
}

function joinTokens(tokens: string[]): string {
  return tokens.map(token => /\s/.test(token) ? `"${token}"` : token).join(' ').trim();
}
