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

import { clsx } from '@web/uiUtils';
import './tag.css';

export const TagView = ({ tag, style, onClick }: { tag: string, style?: React.CSSProperties, onClick?: (e: React.MouseEvent) => void }) => {
  return <span
    className={clsx('tag', `tag-color-${tagNameToColor(tag)}`)}
    onClick={onClick}
    style={{ margin: '6px 0 0 6px', ...style }}
    title={`Click to filter by tag: ${tag}`}
  >
    {tag}
  </span>;
};

// hash string to integer in range [0, 6] for color index, to get same color for same tag
function tagNameToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 8) - hash);
  return Math.abs(hash % 6);
}
