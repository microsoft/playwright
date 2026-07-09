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

import type { InjectedScript } from './injectedScript';

function bidiInsertText(window: Window, text: string): Element | undefined {
  let element = window.document.activeElement;
  while (element?.shadowRoot)
    element = element.shadowRoot.activeElement;
  if (!element)
    return;
  const elementType = element.nodeName.toLocaleLowerCase();
  if (elementType === 'iframe' || elementType === 'frame') {
    // The focused element lives inside a nested frame. Hand the frame element
    // back to the caller so it can recurse into that frame.
    return element;
  } else if (elementType === 'input' || elementType === 'textarea') {
    const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
    const start = inputElement.selectionStart;
    if (start === null) {
      inputElement.value += text;
    } else {
      let value = inputElement.value;
      value = value.substring(0, start) + text + value.substring(inputElement.selectionEnd!);
      inputElement.value = value;
      const caretPosition = start + text.length;
      inputElement.setSelectionRange(caretPosition, caretPosition);
    }
    inputElement.dispatchEvent(new InputEvent('input', { data: text, bubbles: true, composed: true }));
  } else if (element instanceof HTMLElement && element.isContentEditable) {
    const selection = window.getSelection()!;
    let range;
    if (selection.rangeCount)
      range = selection.getRangeAt(0);
    if (!range || !element.contains(range.commonAncestorContainer)) {
      range = window.document.createRange();
      range.selectNodeContents(element);
      range.collapse(true);
    }
    range.deleteContents();
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      range.insertNode(window.document.createTextNode(lines[i]));
      if (i > 0)
        range.insertNode(window.document.createElement('br'));
    }
    range.collapse();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new InputEvent('input', { data: text, bubbles: true, composed: true }));
  }
}

export class BidiInsertTextInstaller {
  constructor(injectedScript: InjectedScript) {
    const window = injectedScript.window;
    (window as any).__pw_bidiInsertText = (text: string) => bidiInsertText(window, text);
  }
}

export default BidiInsertTextInstaller;
