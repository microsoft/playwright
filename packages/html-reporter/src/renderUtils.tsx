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

export function linkifyText(description: string) {
  const CONTROL_CODES = '\\u0000-\\u0020\\u007f-\\u009f';
  const WEB_LINK_REGEX = new RegExp('(?:[a-zA-Z][a-zA-Z0-9+.-]{2,}:\\/\\/|www\\.)[^\\s' + CONTROL_CODES + '"]{2,}[^\\s' + CONTROL_CODES + '"\')}\\],:;.!?]', 'ug');

  const result = [];
  let currentIndex = 0;
  let match;

  while ((match = WEB_LINK_REGEX.exec(description)) !== null) {
    const stringBeforeMatch = description.substring(currentIndex, match.index);
    if (stringBeforeMatch)
      result.push(stringBeforeMatch);

    const value = match[0];
    result.push(renderLink(value));
    currentIndex = match.index + value.length;
  }
  const stringAfterMatches = description.substring(currentIndex);
  if (stringAfterMatches)
    result.push(stringAfterMatches);

  return result;
}

function renderLink(text: string) {
  let link = text;
  if (link.startsWith('www.'))
    link = 'https://' + link;

  return <a href={link} target='_blank' rel='noopener noreferrer'>{text}</a>;
}
