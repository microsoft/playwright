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

import { SelectorEngine, SelectorType, SelectorRoot } from './selectorEngine';
import { unescape } from './textSelectorEngine';
import knuthMorrisPratt, { TextStream } from './kmp';

export function createHasTextSelector(): SelectorEngine {
  const engine: SelectorEngine = {
    create(root: SelectorRoot, targetElement: Element, type: SelectorType): string | undefined {
      return undefined;
    },

    query(root: SelectorRoot, selector: string): Element | undefined {
      const stream = new DOMStream(root);
      if (knuthMorrisPratt(stream, parseSelector(selector)) === -1)
        return;
      return stream.element();
    },

    queryAll(root: SelectorRoot, selector: string): Element[] {
      const stream = new DOMStream(root);
      const word = parseSelector(selector);
      const result: Element[] = [];
      while (knuthMorrisPratt(stream, word) !== -1) {
        for (let element: Element | null = stream.element(); element; element = element.parentElement)
          result.push(element);
      }
      return result;
    }
  };
  return engine;
}

function parseSelector(selector: string): string {
  if (selector.length > 1 && selector[0] === '"' && selector[selector.length - 1] === '"')
    return unescape(selector.substring(1, selector.length - 1));
  if (selector.length > 1 && selector[0] === "'" && selector[selector.length - 1] === "'")
    return unescape(selector.substring(1, selector.length - 1));
  return selector;
}

// Skips <head>, <script> and <style> elements and all their children.
const nodeFilter: NodeFilter = {
  acceptNode: node => {
    return node.nodeName === 'HEAD' || node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE' ?
      NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
  }
};

class DOMStream implements TextStream {
  private _walker: TreeWalker;
  private _currentNode: Node | null;
  private _currentText: string | null;
  private _currentIndex: number;
  private _firstNode: Node | null = null;
  private _lastWasSpace = false;

  constructor(root: SelectorRoot) {
    const document = root instanceof Document ? root : root.ownerDocument;
    this._walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, nodeFilter);
    this._currentNode = this._walker.nextNode();
    this._firstNode = this._currentNode;
    this._currentText = this._currentNode ? this._currentNode.nodeValue : null;
    this._currentIndex = 0;
  }

  hasText(): boolean {
    return this._currentText !== null && this._currentIndex < this._currentText.length;
  }

  peek(): string {
    const char = this._currentText![this._currentIndex];
    return char === '\n' || char === '\t' ? ' ' : char;
  }

  advance(markStart: boolean): void {
    this._advance(markStart);
    // TODO: Ignore zero-width space?
    if (this._lastWasSpace) {
      while (this.hasText() && this.peek() === ' ')
        this._advance(markStart);
    }
    this._lastWasSpace = this.hasText() ? this.peek() === ' ' : false;
  }

  private _advance(markStart: boolean): void {
    ++this._currentIndex;
    if (this._currentIndex === this._currentText!.length) {
      this._currentNode = this._walker.nextNode();
      this._currentText = this._currentNode ? this._currentNode.nodeValue : null;
      this._currentIndex = 0;
    }
    if (markStart)
      this._firstNode = this._currentNode;
  }

  element(): Element {
    let firstElement = this._firstNode!.parentElement!;
    let lastElement = this._currentNode!.parentElement!;
    const depth1 = depth(firstElement);
    const depth2 = depth(lastElement);
    for (let i = 0; i < depth1 - depth2; ++i)
      firstElement = firstElement.parentElement!;
    for (let i = 0; i < depth2 - depth1; ++i)
      lastElement = lastElement.parentElement!;
    while (firstElement !== lastElement) {
      firstElement = firstElement.parentElement!;
      lastElement = lastElement.parentElement!;
    }
    return lastElement;
  }
}

function depth(node: Node): number {
  let result = 0;
  for (let parent = node.parentElement; parent; parent = parent.parentElement)
    ++result;
  return result;
}
