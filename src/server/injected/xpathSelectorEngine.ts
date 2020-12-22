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

import { SelectorEngine, SelectorRoot } from './selectorEngine';

export const XPathEngine: SelectorEngine = {
  query(root: SelectorRoot, selector: string): Element | undefined {
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document)
      return;
    const it = document.evaluate(selector, root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    for (let node = it.iterateNext(); node; node = it.iterateNext()) {
      if (node.nodeType === Node.ELEMENT_NODE)
        return node as Element;
    }
  },

  queryAll(root: SelectorRoot, selector: string): Element[] {
    const result: Element[] = [];
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document)
      return result;
    const it = document.evaluate(selector, root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    for (let node = it.iterateNext(); node; node = it.iterateNext()) {
      if (node.nodeType === Node.ELEMENT_NODE)
        result.push(node as Element);
    }
    return result;
  }
};
