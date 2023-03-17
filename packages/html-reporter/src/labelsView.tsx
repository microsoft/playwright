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

import React from 'react';
import { navigate, Route } from './links';

const testFilesRoutePredicate = (params: URLSearchParams) => !params.has('testId');
const testCaseRoutePredicate = (params: URLSearchParams) => params.has('testId');

export const LabelsView: React.FC<React.PropsWithChildren<{
  labels: string[],
}>> = ({ labels }) => {
  if (!labels.length)
    return null;

  return (
    <>
      {labels.map(tag => (
        <React.Fragment key={tag}>
          <Route predicate={testFilesRoutePredicate}>
            <LabelClick key={tag} tag={tag} />
          </Route>
          <Route predicate={testCaseRoutePredicate}>
            <LabelLink key={tag} tag={tag} />
          </Route>
        </React.Fragment>
      ))}
    </>);
};

export const LabelClick: React.FC<React.PropsWithChildren<{
  tag: string,
}>> = ({ tag }) => {

  const onClickHandle = (e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    const searchParams = new URLSearchParams(window.location.hash.slice(1));
    let q = searchParams.get('q')?.toString() || '';

    // if metaKey or ctrlKey is pressed, add tag to search query without replacing existing tags
    // if metaKey or ctrlKey is pressed and tag is already in search query, remove tag from search query
    if (e.metaKey || e.ctrlKey) {
      if (!q.includes(`@${tag}`))
        q = `${q} @${tag}`.trim();
      else
        q = q.split(' ').filter(t => t !== `@${tag}`).join(' ').trim();
    // if metaKey or ctrlKey is not pressed, replace existing tags with new tag
    } else {
      if (!q.includes('@'))
        q = `${q} @${tag}`.trim();
      else
        q = (q.split(' ').filter(t => !t.startsWith('@')).join(' ').trim() + ` @${tag}`).trim();
    }
    navigate(q ? `#?q=${q}` : '#');
  };

  return <span style={{ margin: '6px 0 0 6px', cursor: 'pointer' }} className={'label label-color-' + (hashStringToInt(tag))} onClick={e => onClickHandle(e, tag)}>
    {tag}
  </span>;
};

export const LabelLink: React.FC<React.PropsWithChildren<{
  tag: string,
}>> = ({ tag }) => {
  return <a style={{ textDecoration: 'none', color: 'var(--color-fg-default)' }} href={`#?q=@${tag}`} >
    <span style={{ margin: '6px 0 0 6px', cursor: 'pointer' }} className={'label label-color-' + (hashStringToInt(tag))}>
      {tag}
    </span>
  </a>;
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
