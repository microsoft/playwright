/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Wire format for the store.  Binary values are base64-encoded.
export type ClipboardEntry = { type: string, value: string, base64?: boolean };

export type BindingPayload = { action: 'read' } | { action: 'write', items: ClipboardEntry[] };

export type InjectParams = { browserName: string, isMac: boolean };

type FormControl = HTMLInputElement | HTMLTextAreaElement;

type GlobalThis = typeof globalThis;

export function inject(globalThis: GlobalThis, params: InjectParams) {
  if ((globalThis as any).__pwClipboardInstalled)
    return;
  (globalThis as any).__pwClipboardInstalled = true;

  const binding = (globalThis as any).__pwClipboardBinding as (payload: BindingPayload) => Promise<ClipboardEntry[]>;
  if (!binding)
    return;

  let copyCutSequence = 0;

  function read() {
    return binding({ action: 'read' });
  }

  function write(items: ClipboardEntry[]) {
    return binding({ action: 'write', items });
  }

  let mirror: ClipboardEntry[] = [];
  void read().then(items => {
    mirror = items;
  });
  (globalThis as any).__pwClipboardSet = (items: ClipboardEntry[]) => {
    mirror = items;
  };

  function getItem(items: ClipboardEntry[], type: string) {
    return items.find(item => item.type === type)?.value ?? '';
  }

  function setItems(items: ClipboardEntry[]) {
    mirror = items;
    return write(items);
  }

  function bytesFromBase64(value: string) {
    return Uint8Array.from(atob(value), c => c.charCodeAt(0));
  }

  function toDataTransfer(items: ClipboardEntry[]) {
    const dataTransfer = new DataTransfer();
    for (const item of items) {
      if (item.base64)
        dataTransfer.items.add(new File([bytesFromBase64(item.value)], 'clipboard', { type: item.type }));
      else
        dataTransfer.setData(item.type, item.value);
    }
    return dataTransfer;
  }

  function toClipboardEntries(dataTransfer: DataTransfer): ClipboardEntry[] {
    return [...dataTransfer.types].filter(type => type !== 'Files').map(type => ({ type, value: dataTransfer.getData(type) }));
  }

  // Selections inside form controls are not part of the document selection.
  function getActiveFormControl(): FormControl | null {
    const active = globalThis.document.activeElement as FormControl | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA'))
      return active;
    return null;
  }

  function getSelectedFormControl(): FormControl | null {
    const control = getActiveFormControl();
    if (control && control.selectionStart !== null && control.selectionStart !== control.selectionEnd)
      return control;
    return null;
  }

  function isPasswordControl(control: FormControl): boolean {
    return control.tagName === 'INPUT' && (control as HTMLInputElement).type === 'password';
  }

  const kNonTextInputTypes = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);
  function isEditableControl(control: FormControl): boolean {
    if (control.disabled || control.readOnly)
      return false;
    return control.tagName === 'TEXTAREA' || !kNonTextInputTypes.has((control as HTMLInputElement).type);
  }

  function getContentEditableHost(node: Node | null | undefined): HTMLElement | null {
    let element = (node instanceof Element ? node : node?.parentElement) as HTMLElement | null;
    if (!element?.isContentEditable)
      return null;
    while (element.parentElement?.isContentEditable)
      element = element.parentElement;
    return element;
  }

  function isEditableSelection(): boolean {
    const control = getSelectedFormControl();
    if (control)
      return isEditableControl(control) && !isPasswordControl(control);
    return !!getContentEditableHost(globalThis.document.getSelection()?.anchorNode);
  }

  function getNativeInputValueSetter(control: FormControl) {
    const proto = control.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    return Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  }

  function captureSelection() {
    const control = getSelectedFormControl();
    if (control) {
      if (isPasswordControl(control))
        return;
      void setItems([{ type: 'text/plain', value: control.value.slice(control.selectionStart ?? 0, control.selectionEnd ?? 0) }]);
      return;
    }
    const selection = globalThis.document.getSelection();
    const container = globalThis.document.createElement('div');
    if (selection) {
      for (let i = 0; i < selection.rangeCount; i++)
        container.appendChild(selection.getRangeAt(i).cloneContents());
    }
    void setItems([
      { type: 'text/plain', value: selection?.toString() ?? '' },
      { type: 'text/html', value: container.innerHTML },
    ]);
  }

  function deleteControlSelection(control: FormControl) {
    if (!control.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteByCut' })))
      return;
    // A beforeinput handler may have moved the selection.
    const start = control.selectionStart ?? 0;
    const end = control.selectionEnd ?? 0;
    getNativeInputValueSetter(control).call(control, control.value.slice(0, start) + control.value.slice(end));
    control.setSelectionRange(start, start);
    control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteByCut' }));
  }

  function deleteContentEditableSelection(host: HTMLElement) {
    const selection = globalThis.document.getSelection();
    if (!selection?.rangeCount)
      return;
    if (!host.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: 'deleteByCut' })))
      return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.collapse(false);
    host.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteByCut' }));
  }

  function deleteSelection() {
    const control = getSelectedFormControl();
    if (control) {
      if (isEditableControl(control) && !isPasswordControl(control))
        deleteControlSelection(control);
      return;
    }
    const host = getContentEditableHost(globalThis.document.getSelection()?.anchorNode);
    if (host)
      deleteContentEditableSelection(host);
  }

  const kUnsafeHtmlTags = new Set(['base', 'embed', 'iframe', 'link', 'meta', 'object', 'script']);
  function sanitizeFragment(range: Range, html: string) {
    const fragment = range.createContextualFragment(html);
    const sanitize = (root: ParentNode) => {
      for (const element of [...root.querySelectorAll('*')]) {
        if (kUnsafeHtmlTags.has(element.localName)) {
          element.remove();
          continue;
        }
        for (const attribute of [...element.attributes]) {
          const name = attribute.name.toLowerCase();
          if (name.startsWith('on'))
            element.removeAttribute(attribute.name);
          else if ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action' || name === 'formaction') && /^javascript:/i.test(attribute.value.replace(/[\u0000-\u0020]+/g, '')))
            element.removeAttribute(attribute.name);
        }
        if (element instanceof HTMLTemplateElement)
          sanitize(element.content);
      }
    };
    sanitize(fragment);
    return fragment;
  }

  function insertIntoControl(control: FormControl, items: ClipboardEntry[]) {
    if (!isEditableControl(control))
      return;
    const text = getItem(items, 'text/plain');
    if (!text)
      return;
    if (!control.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: text })))
      return;
    // A beforeinput handler may have moved the selection.
    const start = control.selectionStart ?? control.value.length;
    const end = control.selectionEnd ?? control.value.length;
    let inserted = text;
    if (control.maxLength >= 0) {
      const available = control.maxLength - (control.value.length - (end - start));
      inserted = available > 0 ? text.slice(0, available) : '';
    }
    // Set through the native setter so frameworks that track the value (e.g. React) still see the change.
    getNativeInputValueSetter(control).call(control, control.value.slice(0, start) + inserted + control.value.slice(end));
    // Non-text inputs (number, email, ...) expose a null selectionStart and throw on setSelectionRange.
    if (control.selectionStart !== null)
      control.setSelectionRange(start + inserted.length, start + inserted.length);
    control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: inserted }));
  }

  function insertIntoContentEditable(host: HTMLElement, items: ClipboardEntry[]) {
    const selection = globalThis.document.getSelection();
    if (!selection?.rangeCount)
      return;
    const text = getItem(items, 'text/plain');
    const html = getItem(items, 'text/html');
    if (!text && !html)
      return;
    const dataTransfer = toDataTransfer(items);
    const beforeinput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: 'insertFromPaste',
      dataTransfer,
    });
    // Firefox and WebKit drop dataTransfer passed to a synthesized InputEvent, so expose it for listeners.
    if (!beforeinput.dataTransfer)
      Object.defineProperty(beforeinput, 'dataTransfer', { configurable: true, get: () => dataTransfer });
    if (!host.dispatchEvent(beforeinput))
      return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(html ? sanitizeFragment(range, html) : globalThis.document.createTextNode(text));
    range.collapse(false);
    host.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertFromPaste' }));
  }

  function insertClipboard(target: any, items: ClipboardEntry[]) {
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
      insertIntoControl(target as FormControl, items);
      return;
    }
    const host = getContentEditableHost(target) || getContentEditableHost(globalThis.document.getSelection()?.anchorNode);
    if (host)
      insertIntoContentEditable(host, items);
  }

  // Fire a real ClipboardEvent so page handlers can read/override clipboardData.  The synthetic event is untrusted, so the isTrusted-guarded native listeners skip it (no recursion).
  function dispatchCopy(target: any, cut: boolean) {
    ++copyCutSequence;
    const event = new ClipboardEvent(cut ? 'cut' : 'copy', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true, composed: true });
    if (target?.dispatchEvent(event) === false) {
      if (event.clipboardData?.types.length)
        void setItems(toClipboardEntries(event.clipboardData));
      return;
    }
    if (cut && !isEditableSelection())
      return;
    captureSelection();
    if (cut)
      deleteSelection();
  }

  function dispatchPaste(target: any, items: ClipboardEntry[]) {
    const event = new ClipboardEvent('paste', { clipboardData: toDataTransfer(items), bubbles: true, cancelable: true, composed: true });
    if (target?.dispatchEvent(event))
      insertClipboard(target, items);
  }

  const originalExecCommand = globalThis.document.execCommand.bind(globalThis.document);
  (globalThis.document as any).execCommand = function(commandId: string, showUI?: boolean, value?: string) {
    const command = String(commandId).toLowerCase();
    if (command === 'copy' || command === 'cut') {
      const selection = globalThis.document.getSelection();
      const hasSelection = !!getSelectedFormControl() || (!!selection && !selection.isCollapsed);
      if (!globalThis.document.queryCommandSupported(command) || !hasSelection)
        return false;
      dispatchCopy(globalThis.document.activeElement, command === 'cut');
      return true;
    }
    if (command === 'paste') {
      const target = globalThis.document.activeElement as HTMLElement | null;
      if (!globalThis.document.queryCommandSupported('paste') || !target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable))
        return false;
      dispatchPaste(target, mirror);
      return true;
    }
    return originalExecCommand(commandId, showUI, value);
  };

  // Capture-phase listeners that document.open() (page.setContent()) tears down, so this doesn't survive setContent.
  addEventListener('copy', e => {
    if (!e.isTrusted)
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    dispatchCopy(e.target, false);
  }, { capture: true });
  addEventListener('cut', e => {
    if (!e.isTrusted)
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    dispatchCopy(e.target, true);
  }, { capture: true });
  addEventListener('paste', e => {
    if (!e.isTrusted)
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const target = e.target;
    void read().then(items => {
      mirror = items;
      dispatchPaste(target, items);
    });
  }, { capture: true });

  // Only redirect where the browser already exposes it, so feature-detection still works.
  if (navigator.clipboard) {
    const clipboard = Object.assign(new EventTarget(), {
      async writeText(text: string) {
        await setItems([{ type: 'text/plain', value: String(text) }]);
      },
      async readText() {
        mirror = await read();
        return getItem(mirror, 'text/plain');
      },
      async write(clipboardItems: ClipboardItem[]) {
        if (clipboardItems.length > 1)
          throw new DOMException('Support for multiple ClipboardItems is not implemented.', 'NotAllowedError');
        const items: ClipboardEntry[] = [];
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (!ClipboardItem.supports(type))
              throw new DOMException('Type ' + type + ' not supported on write.', 'NotAllowedError');
            const blob = await item.getType(type);
            if (type.startsWith('text/')) {
              items.push({ type, value: await blob.text() });
            } else {
              const bytes = new Uint8Array(await blob.arrayBuffer());
              const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
              items.push({ type, value: btoa(binary), base64: true });
            }
          }
        }
        await setItems(items);
      },
      async read() {
        mirror = await read();
        if (!mirror.length)
          return [];
        const parts: Record<string, Blob> = {};
        for (const item of mirror)
          parts[item.type] = new Blob([item.base64 ? bytesFromBase64(item.value) : item.value], { type: item.type });
        return [new ClipboardItem(parts)];
      },
    });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => clipboard });
  }

  // WebKitGTK doesn't fire copy/cut for a non-editable selection, so fall back to the shortcut when no native copy/cut ran.
  if (params.browserName === 'webkit') {
    addEventListener('keydown', e => {
      if (!e.isTrusted || e.altKey || e.shiftKey)
        return;
      if (params.isMac ? (!e.metaKey || e.ctrlKey) : (!e.ctrlKey || e.metaKey))
        return;
      const key = e.key.toLowerCase();
      const cut = key === 'x';
      if (key !== 'c' && !cut)
        return;
      const eventTarget = e.target;
      const sequence = copyCutSequence;
      globalThis.setTimeout(() => {
        // A native copy/cut, execCommand, or a page handler cancelling the shortcut already covered it.
        if (e.defaultPrevented || copyCutSequence !== sequence)
          return;
        const control = getSelectedFormControl();
        let target = eventTarget;
        if (!control) {
          const selection = globalThis.document.getSelection();
          if (!selection || selection.isCollapsed)
            return;
          const node = selection.getRangeAt(0).startContainer;
          target = (node instanceof Element ? node : node.parentElement) ?? eventTarget;
        }
        dispatchCopy(target, cut);
      }, 0);
    }, { capture: true });
  }
}
