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

export class Utils {
  parentElementOrShadowHost(element: Element): Element | undefined {
    if (element.parentElement)
      return element.parentElement;
    if (!element.parentNode)
      return;
    if (element.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (element.parentNode as ShadowRoot).host)
      return (element.parentNode as ShadowRoot).host;
  }

  deepElementFromPoint(document: Document, x: number, y: number): Element | undefined {
    let container: Document | ShadowRoot | null = document;
    let element: Element | undefined;
    while (container) {
      const innerElement = container.elementFromPoint(x, y) as Element | undefined;
      if (!innerElement || element === innerElement)
        break;
      element = innerElement;
      container = element.shadowRoot;
    }
    return element;
  }
}
