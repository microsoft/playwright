// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type Modifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
export type Button = 'left' | 'right' | 'middle';

type Point = {
  x: number;
  y: number;
};

export type PointerActionOptions = {
  modifiers?: Modifier[];
  relativePoint?: Point;
};

export type ClickOptions = PointerActionOptions & {
  delay?: number;
  button?: Button;
  clickCount?: number;
};

export type MultiClickOptions = PointerActionOptions & {
  delay?: number;
  button?: Button;
};

export type SelectOption = {
  value?: string;
  label?: string;
  index?: number;
};

export interface MouseOperations {
  move(x: number, y: number, options?: { steps?: number; }): Promise<void>;
  down(options?: { button?: Button; clickCount?: number; }): Promise<void>;
  up(options?: { button?: Button; clickCount?: number; }): Promise<void>;
}

export class MouseClicker {
  private _operations: MouseOperations;

  constructor(operations: MouseOperations) {
    this._operations = operations;
  }

  async click(x: number, y: number, options: ClickOptions = {}) {
    const {delay = null} = options;
    if (delay !== null) {
      await Promise.all([
        this._operations.move(x, y),
        this._operations.down(options),
      ]);
      await new Promise(f => setTimeout(f, delay));
      await this._operations.up(options);
    } else {
      await Promise.all([
        this._operations.move(x, y),
        this._operations.down(options),
        this._operations.up(options),
      ]);
    }
  }

  async dblclick(x: number, y: number, options: MultiClickOptions = {}) {
    const { delay = null } = options;
    if (delay !== null) {
      await this._operations.move(x, y);
      await this._operations.down({ ...options, clickCount: 1 });
      await new Promise(f => setTimeout(f, delay));
      await this._operations.up({ ...options, clickCount: 1 });
      await new Promise(f => setTimeout(f, delay));
      await this._operations.down({ ...options, clickCount: 2 });
      await new Promise(f => setTimeout(f, delay));
      await this._operations.up({ ...options, clickCount: 2 });
    } else {
      await Promise.all([
        this._operations.move(x, y),
        this._operations.down({ ...options, clickCount: 1 }),
        this._operations.up({ ...options, clickCount: 1 }),
        this._operations.down({ ...options, clickCount: 2 }),
        this._operations.up({ ...options, clickCount: 2 }),
      ]);
    }
  }

  async tripleclick(x: number, y: number, options: MultiClickOptions = {}) {
    const { delay = null } = options;
    if (delay !== null) {
      await this._operations.move(x, y);
      await this._operations.down({ ...options, clickCount: 1 });
      await new Promise(f => setTimeout(f, delay));
      await this._operations.up({ ...options, clickCount: 1 });
      await new Promise(f => setTimeout(f, delay));
      await this._operations.down({ ...options, clickCount: 2 });
      await new Promise(f => setTimeout(f, delay));
      await this._operations.up({ ...options, clickCount: 2 });
      await new Promise(f => setTimeout(f, delay));
      await this._operations.down({ ...options, clickCount: 3 });
      await new Promise(f => setTimeout(f, delay));
      await this._operations.up({ ...options, clickCount: 3 });
    } else {
      await Promise.all([
        this._operations.move(x, y),
        this._operations.down({ ...options, clickCount: 1 }),
        this._operations.up({ ...options, clickCount: 1 }),
        this._operations.down({ ...options, clickCount: 2 }),
        this._operations.up({ ...options, clickCount: 2 }),
        this._operations.down({ ...options, clickCount: 3 }),
        this._operations.up({ ...options, clickCount: 3 }),
      ]);
    }
  }
}

export const selectFunction = (element: HTMLSelectElement, ...optionsToSelect: (Node | SelectOption)[]) => {
  if (element.nodeName.toLowerCase() !== 'select')
    throw new Error('Element is not a <select> element.');

  const options = Array.from(element.options);
  element.value = undefined;
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    option.selected = optionsToSelect.some(optionToSelect => {
      if (optionToSelect instanceof Node)
        return option === optionToSelect;
      let matches = true;
      if (optionToSelect.value !== undefined)
        matches = matches && optionToSelect.value === option.value;
      if (optionToSelect.label !== undefined)
        matches = matches && optionToSelect.label === option.label;
      if (optionToSelect.index !== undefined)
        matches = matches && optionToSelect.index === index;
      return matches;
    });
    if (option.selected && !element.multiple)
      break;
  }
  element.dispatchEvent(new Event('input', { 'bubbles': true }));
  element.dispatchEvent(new Event('change', { 'bubbles': true }));
  return options.filter(option => option.selected).map(option => option.value);
};

export const fillFunction = (element: HTMLElement) => {
  if (element.nodeType !== Node.ELEMENT_NODE)
    return 'Node is not of type HTMLElement';
  if (element.nodeName.toLowerCase() === 'input') {
    const input = element as HTMLInputElement;
    const type = input.getAttribute('type') || '';
    const kTextInputTypes = new Set(['', 'password', 'search', 'tel', 'text', 'url']);
    if (!kTextInputTypes.has(type.toLowerCase()))
      return 'Cannot fill input of type "' + type + '".';
    input.selectionStart = 0;
    input.selectionEnd = input.value.length;
  } else if (element.nodeName.toLowerCase() === 'textarea') {
    const textarea = element as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = textarea.value.length;
  } else if (element.isContentEditable) {
    if (!element.ownerDocument || !element.ownerDocument.defaultView)
      return 'Element does not belong to a window';
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    const selection = element.ownerDocument.defaultView.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    return 'Element is not an <input>, <textarea> or [contenteditable] element.';
  }
  return false;
};
