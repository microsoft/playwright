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
import * as React from 'react';
import type { Filter } from './filter';
import * as icons from './icons';
import { Route } from './links';
import { testCaseRoutePredicate, testFilesRoutePredicate } from './reportView';
import './tags.css';
import type { HTMLReport, TestCaseSummary } from './types';

export const Tags: React.FC<React.PropsWithChildren<{
  testCase?: TestCaseSummary,
  report?: HTMLReport,
  filterText?: string,
  filter?: Filter,
  style?: React.CSSProperties,
  appliedTagsArray?: string[],
  setAppliedTagsArray?: React.Dispatch<React.SetStateAction<string[]>>,
}>> = ({ testCase, report, filterText, filter, style, appliedTagsArray, setAppliedTagsArray }) => {
  const isTestCaseRow = testCase ? true : false;

  // filter tests by filter and collect all tags for tabs 'All', 'Passed', 'Failed', 'Flaky', 'Skipped'
  const filteredTests = React.useMemo(() => {
    const result: TestCaseSummary[] = [];
    for (const file of report?.files || []) {
      const tests = file.tests.filter(t => {
        return filter?.matches(t);
      });
      if (tests.length)
        result.push(...tests);
    }
    return result;
  }, [report, filter]);

  const filteredTags = React.useMemo(() => {
    const tagsSet = new Set<string>();
    for (const test of filteredTests){
      const t = matchTags(test.title, report?.excludeTagsFilterPattern);
      if (t.length)
        t.forEach(tag => tagsSet.add(tag));
    }
    return [...tagsSet];
  }, [filteredTests, report?.excludeTagsFilterPattern]);

  const tags = React.useMemo(() => {
    if (testCase) {
    // collect all tags from current test only for test page and testFileView
      return matchTags(testCase.title, report?.excludeTagsFilterPattern).sort((a, b) => a.localeCompare(b));
    } else {
    // collect all tags from all tests in report for reportView
      const tagsSet = new Set<string>();
      for (const file of report?.files || []) {
        for (const test of file.tests){
          const t = matchTags(test.title, report?.excludeTagsFilterPattern);
          if (t.length)
            t.forEach(tag => tagsSet.add(tag));
        }
      }
      return [...tagsSet].sort((a, b) => a.localeCompare(b));
    }
  }, [report, testCase]);

  // if no tags or no filtered tests and no test, return null
  // for example, if we are on 'Flaky' tab, there is no filtered tests
  if (!tags?.length || (!filteredTests?.length && !testCase))
    return null;

  return <div className='tags' style={{ ...style }}>
    <span>Tags: </span>
    {tags && tags.map(tag => {
      return <Tag
        key={tag}
        tag={tag}
        filterText={filterText || ''}
        filteredTags={filteredTags}
        isTestCaseRow={isTestCaseRow}
        appliedTagsArray={appliedTagsArray}
        setAppliedTagsArray={setAppliedTagsArray}
      />;
    })}
  </div>;
};

export const Tag: React.FC<React.PropsWithChildren<{
  tag: string,
  filterText: string,
  filteredTags?: string[],
  isTestCaseRow?: boolean,
  appliedTagsArray?: string[],
  setAppliedTagsArray?: React.Dispatch<React.SetStateAction<string[]>>,
}>> = ({ tag, filterText, filteredTags, isTestCaseRow, appliedTagsArray, setAppliedTagsArray }) => {
  const [isCurrentTag, setIsCurrentTag] = React.useState(false);
  const [tagStyle, setTagStyle] = React.useState('tag');

  const encoded = encodeURIComponent(tag);
  const value = tag === encoded ? tag : `"${encoded.replace(/%22/g, '%5C%22')}"`;

  React.useEffect(() => {
    const tagStyleFn = (tag: string) => {
      const isCurrent = appliedTagsArray?.includes(tag);
      const isDisabled = !filteredTags?.includes(tag) && !isCurrent;
      const isNotCurrent = filteredTags?.includes(tag) && !isCurrent;
      if (testCaseRoutePredicate(new URLSearchParams(window.location.hash.slice(1))))
        return 'tag';
      if (isTestCaseRow)
        return `tag ${isCurrent ? 'tag-current' : 'tag-not-current'}`;
      else
        return `tag ${isDisabled ? 'tag-disabled' : isNotCurrent ? 'tag-not-current' : isCurrent ? 'tag-current' : ''}`;

    };

    setTagStyle(tagStyleFn(tag));

  }, [appliedTagsArray, filterText, filteredTags, isTestCaseRow, tag]);

  React.useEffect(() => {
    setIsCurrentTag(isCurrentTagFunction(new URLSearchParams(window.location.hash.slice(1)), tag));
  }, [tag, filterText, appliedTagsArray]);

  // handle click on tag and add or remove tag from searchParams and search input
  const onClickHandle = (tag: string) => {
    let searchParams = new URLSearchParams(window.location.hash.slice(1));
    searchParams = (isCurrentTag) ? removeValue(searchParams, tag) : appendValue(searchParams, tag);
    window.location.hash = decodeURIComponent(searchParams.toString());

    // need to update appliedTagsArray for rerendering tags
    // if tag is not in appliedTagsArray, it will be added
    // if tag is in appliedTagsArray, it will be removed
    if (setAppliedTagsArray){
      setAppliedTagsArray(prev => {
        if (prev.includes(tag))
          return prev.filter(t => t !== tag);
        else
          return [...prev, tag];
      });
    }
  };

  return <span className={tagStyle}>
    <span style={{ margin: '0 4px' }} className={'label label-color-' + (hashStringToInt(tag))}>
      {value}
      <Route predicate={testFilesRoutePredicate}>
        <button
          className={appliedTagsArray?.includes(value) ? 'plus-sign plus-sign__remove' : 'plus-sign'}
          onClick={() => onClickHandle(value)}
          disabled={tagStyle.includes('disabled')}>
          {icons.plus()}
        </button>
      </Route>
    </span>
  </span>;
};

export function escapeRegExp(string: string) {
  const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  const reHasRegExpChar = RegExp(reRegExpChar.source);

  return (string && reHasRegExpChar.test(string))
    ? string.replace(reRegExpChar, '\\$&')
    : (string || '');
}

// match all tags in test title
export function matchTags(title: string, excludeTagMatch?: string): string[] {
  const allTags = title.match(/@(\w+)/g)?.map(tag => tag.slice(1)) || [];
  return allTags.filter(tag => !excludeTagMatch || !tag.match(excludeTagMatch));
}

// hash string to integer in range [0, 6] for color index, to get same color for same tag
function hashStringToInt(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 8) - hash);
  return Math.abs(hash % 6);
}

// create regex for tag
export function tagRegex(tag: string): RegExp {
  const encoded = escapeRegExp(escapeRegExp(tag));
  return new RegExp(`(\\s|^)t:${encoded}(\\s|$)`);
}

// check if current tag is applied in filter
function isCurrentTagFunction(params: URLSearchParams, tag: string): boolean {
  return params.has('q') && Boolean(params.get('q')?.match(tagRegex(tag))?.length);
}

// remove tag from filter
function removeValue(params: URLSearchParams, tagToRemove: string): URLSearchParams {
  const q = params.get('q');
  if (q) {
    // start value is 't:foo t:bar t:baz'
    const match = q.match(tagRegex(tagToRemove))?.[0];
    if (match) {
      // match is 't:foo t:bar t:baz'
      const values = q.split(' ');
      if (values.length === 1) {
        params.delete('q');
        return params;
      }
      // values is ['t:foo', 't:bar', 't:baz']
      const valueIndex = values.indexOf(`t:${tagToRemove}`);
      if (valueIndex === -1)
        return params;
      values.splice(valueIndex, 1);
      // values is ['t:foo', 'baz']
      params.set('q', values.join(' '));
      return params;
    }
  }
  return params;
}

// append tag to filter
function appendValue(params: URLSearchParams, tagToAppend: string): URLSearchParams {
  const q = params.get('q');
  if (q) {
    // match all values like t:foo t:bar t:baz
    const match = q.match(tagRegex(tagToAppend));
    if (match) {
      // if the key exists, do nothing
      return params;
    } else {
      // if the key exists, append the value
      params.set('q', `${q} t:${tagToAppend}`);
      return params;
    }
  }
  // if the key doesn't exist, add it
  params.set('q', `t:${tagToAppend}`);
  return params;
}