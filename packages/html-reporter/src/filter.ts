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
export class Filter {
  project: string[] = [];
  status: string[] = [];
  text: string[] = [];
  labels: string[] = [];
  annotations: string[] = [];

  empty(): boolean {
    return this.project.length + this.status.length + this.text.length === 0;
  }

  static parse(expression: string): Filter {
    const tokens = Filter.tokenize(expression);
    const project = new Set<string>();
    const status = new Set<string>();
    const text: string[] = [];
    const labels = new Set<string>();
    const annotations = new Set<string>();
    for (const token of tokens) {
      if (token.startsWith('p:')) {
        project.add(token.slice(2));
        continue;
      }
      if (token.startsWith('s:')) {
        status.add(token.slice(2));
        continue;
      }
      if (token.startsWith('@')) {
        labels.add(token);
        continue;
      }
      if (token.startsWith('annot:')) {
        annotations.add(token.slice('annot:'.length));
        continue;
      }
      text.push(token.toLowerCase());
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
      const matches = !!this.project.find(p => searchValues.project.includes(p));
      if (!matches)
        return false;
    }
    if (this.status.length) {
      const matches = !!this.status.find(s => searchValues.status.includes(s));
      if (!matches)
        return false;
    } else {
      if (searchValues.status === 'skipped')
        return false;
    }
    if (this.text.length) {
      for (const text of this.text) {
        if (searchValues.text.includes(text))
          continue;
        const [fileName, line, column] = text.split(':');
        if (searchValues.file.includes(fileName) && searchValues.line === line && (column === undefined || searchValues.column === column))
          continue;
        return false;
      }
    }
    if (this.labels.length) {
      const matches = this.labels.every(l => searchValues.labels.includes(l));
      if (!matches)
        return false;
    }
    if (this.annotations.length) {
      const matches = this.annotations.every(annotation =>
        searchValues.annotations.some(a => a.includes(annotation)));
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

export function filterWithToken(tokens: string[], token: string, append: boolean): string {
  if (append) {
    if (!tokens.includes(token))
      return '#?q=' + [...tokens, token].join(' ').trim();
    return '#?q=' + tokens.filter(t => t !== token).join(' ').trim();
  }

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
  return '#?q=' + newTokens.join(' ').trim();
}
