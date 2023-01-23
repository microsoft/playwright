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

  empty(): boolean {
    return this.project.length + this.status.length + this.text.length === 0;
  }

  static parse(expression: string): Filter {
    const tokens = Filter.tokenize(expression);
    const project = new Set<string>();
    const status = new Set<string>();
    const text: string[] = [];
    for (const token of tokens) {
      if (token.startsWith('p:')) {
        project.add(token.slice(2));
        continue;
      }
      if (token.startsWith('s:')) {
        status.add(token.slice(2));
        continue;
      }
      text.push(token.toLowerCase());
    }

    const filter = new Filter();
    filter.text = text;
    filter.project = [...project];
    filter.status = [...status];
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
    if (!(test as any).searchValues) {
      let status = 'passed';
      if (test.outcome === 'unexpected')
        status = 'failed';
      if (test.outcome === 'flaky')
        status = 'flaky';
      if (test.outcome === 'skipped')
        status = 'skipped';
      const searchValues: SearchValues = {
        text: (status + ' ' + test.projectName + ' ' + test.path.join(' ') + test.title).toLowerCase(),
        project: test.projectName.toLowerCase(),
        status: status as any
      };
      (test as any).searchValues = searchValues;
    }

    const searchValues = (test as any).searchValues as SearchValues;
    if (this.project.length) {
      const matches = !!this.project.find(p => searchValues.project.includes(p));
      if (!matches)
        return false;
    }
    if (this.status.length) {
      const matches = !!this.status.find(s => searchValues.status.includes(s));
      if (!matches)
        return false;
    }

    if (this.text.length) {
      const matches = this.text.filter(t => searchValues.text.includes(t)).length === this.text.length;
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
};

