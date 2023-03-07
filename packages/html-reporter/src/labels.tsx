import React from 'react';
import { navigate } from './links';
import type { TestCaseSummary } from './types';

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
export const Labels: React.FC<React.PropsWithChildren<{
  testCase: TestCaseSummary,
  style?: React.CSSProperties,
}>> = ({ testCase, style }) => {

  const labels = React.useMemo(() => {
    return matchTags(testCase.title).sort((a, b) => a.localeCompare(b));
  }, [testCase]);

  if (!labels?.length)
    return null;

  return labels && <div className='labels' style={{ ...style }}>
    {labels && labels.map(tag => {
      return <Label key={tag} tag={tag} />;
    })}
  </div>;
};

export const Label: React.FC<React.PropsWithChildren<{
  tag: string,
}>> = ({ tag }) => {
  const encoded = encodeURIComponent(tag);
  const value = tag === encoded ? tag : `"${encoded.replace(/%22/g, '%5C%22')}"`;

  const onClickHandle = (e: React.MouseEvent, tag: string) => {
    e.preventDefault();

    const searchParams = new URLSearchParams(window.location.hash.slice(1));
    const q = searchParams.get('q') || '';

    if (searchParams.has('testId')){
      searchParams.delete('testId');
      searchParams.set('q', `${q} @${tag}`.trim());
      navigate(`#?q=${searchParams.get('q')?.toString()}` || '');
    }

    // if metaKey or ctrlKey is pressed, add tag to search query without replacing existing tags
    // if metaKey or ctrlKey is pressed and tag is already in search query, remove tag from search query
    if (e.metaKey || e.ctrlKey) {
      if (!q.includes('@')) {
        searchParams.set('q', `${q} @${tag}`.trim());
      } else if (!q.includes(`@${tag}`)) {
        searchParams.set('q', `${q} @${tag}`.trim());
      } else {
        const re = new RegExp(`@${escapeRegExp(tag)}`, 'g');
        searchParams.set('q', q.replace(re, '').trim());
      }
      navigate(`#?q=${searchParams.get('q')?.toString()}` || '');
      return;
    // if metaKey or ctrlKey is not pressed, replace existing tags with new tag
    } else {
      if (!q.includes('@'))
        searchParams.set('q', `${q} @${tag}`.trim());
      else
        searchParams.set('q', q.replace(new RegExp('@.+', 'g'), `@${tag}`).trim());
      navigate(`#?q=${searchParams.get('q')?.toString()}` || '');
    }
  };

  return <span style={{ margin: '0 6px 0 0', cursor: 'pointer' }} className={'label label-color-' + (hashStringToInt(tag))} onClick={e => onClickHandle(e, value)}>
    {value}
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
export function matchTags(title: string): string[] {
  return title.match(/@(\w+)/g)?.map(tag => tag.slice(1)) || [];
}

// hash string to integer in range [0, 6] for color index, to get same color for same tag
function hashStringToInt(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 8) - hash);
  return Math.abs(hash % 6);
}
