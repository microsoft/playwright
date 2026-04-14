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

import * as getEastAsianWidth from 'get-east-asian-width';
import { ansiRegex, stripAnsiEscapes } from '@isomorphic/stringUtils';

function characterWidth(c: string) {
  return getEastAsianWidth.eastAsianWidth(c.codePointAt(0)!);
}

export function stringWidth(v: string) {
  let width = 0;
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v))
    width += characterWidth(segment);
  return width;
}

function suffixOfWidth(v: string, width: number) {
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v)];
  let suffixBegin = v.length;
  for (const { segment, index } of segments.reverse()) {
    const segmentWidth = stringWidth(segment);
    if (segmentWidth > width)
      break;
    width -= segmentWidth;
    suffixBegin = index;
  }
  return v.substring(suffixBegin);
}

export function fitToWidth(line: string, width: number, prefix?: string): string {
  const prefixLength = prefix ? stripAnsiEscapes(prefix).length : 0;
  width -= prefixLength;
  if (stringWidth(line) <= width)
    return line;

  // Even items are plain text, odd items are control sequences.
  const parts = line.split(ansiRegex);
  const taken: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (i % 2) {
      // Include all control sequences to preserve formatting.
      taken.push(parts[i]);
    } else {
      let part = suffixOfWidth(parts[i], width);
      const wasTruncated = part.length < parts[i].length;
      if (wasTruncated && parts[i].length > 0) {
        // Add ellipsis if we are truncating.
        part = '\u2026' + suffixOfWidth(parts[i], width - 1);
      }
      taken.push(part);
      width -= stringWidth(part);
    }
  }
  return taken.reverse().join('');
}
