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
  filters: Record<string, string[]> = {};

  empty(): boolean {
    return Object.values(this.filters).every(
        filterValues => filterValues.length === 0
    );
  }

  private static addFilter(filter: Filter, { key, value, unique }: {key: string, value: string, unique: boolean }) {
    if (filter.filters[key]) {
      if (unique)
        filter.filters[key] = [...new Set([...filter.filters[key], value])];
      else
        filter.filters[key].push(value);
    } else {filter.filters[key] = [value];}
  }

  static parse(expression: string): Filter {
    const tokens = Filter.tokenize(expression);
    const filter = new Filter();

    const filters: Record<string, Array<string>> = {};
    for (const token of tokens) {
      if (token.includes(':')) {
        const [key, value] = token.split(':');
        Filter.addFilter(filter, { key, value, unique: true });
      } else {
        Filter.addFilter(filter, { key: 'text', value: token.toLowerCase(), unique: false });
      }
    }

    filter.filters = filters;
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
      if (test.outcome === 'unexpected') status = 'failed';

      if (test.outcome === 'flaky') status = 'flaky';

      if (test.outcome === 'skipped') status = 'skipped';

      const searchValues = {
        ...Object.fromEntries(
            test.annotations.map(({ type, description }) => [type, description])
        ),
        text: (
          status +
          ' ' +
          test.projectName +
          ' ' +
          test.path.join(' ') +
          test.title
        ).toLowerCase(),
        p: test.projectName.toLowerCase(),
        s: status as any,
      };
      (test as any).searchValues = searchValues;
    }

    const searchValues = (test as any).searchValues;

    return Object.entries(this.filters).every(([filterKey, filterValues]) => {
      if (
        this.filters[filterKey].some(filterValue =>
          searchValues[filterKey]?.includes(filterValue)
        )
      )
        return true;
    });
  }
}
