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

function buildTable(word: string): number[] {
  const table: number[] = [0];
  let prefix = 0;
  let suffix = 1;

  while (suffix < word.length) {
    if (word[prefix] === word[suffix]) {
      table[suffix] = prefix + 1;
      ++suffix;
      ++prefix;
    } else if (prefix) {
      prefix = table[prefix - 1];
    } else {
      table[suffix] = 0;
      ++suffix;
    }
  }
  return table;
}

export interface TextStream {
  hasText(): boolean;
  peek(): string;
  advance(markStart: boolean): void;
}

export class StringStream implements TextStream {
  private _text: string;
  private _index = 0;

  constructor(text: string) {
    this._text = text;
  }

  hasText(): boolean {
    return this._index < this._text.length;
  }

  peek(): string {
    return this._text.charAt(this._index);
  }

  advance(markStart: boolean) {
    ++this._index;
  }
}

export default function knuthMorrisPratt(stream: TextStream, word: string): number {
  if (!word.length)
    return 0;

  let wordIndex = 0;
  let textIndex = 0;

  const patternTable = buildTable(word);

  while (stream.hasText()) {
    if (stream.peek() === word[wordIndex]) {
      if (wordIndex === word.length - 1)
        return textIndex - word.length + 1;
      ++wordIndex;
      ++textIndex;
      stream.advance(false);
    } else if (wordIndex > 0) {
      wordIndex = patternTable[wordIndex - 1];
    } else {
      wordIndex = 0;
      ++textIndex;
      stream.advance(true);
    }
  }

  return -1;
}
