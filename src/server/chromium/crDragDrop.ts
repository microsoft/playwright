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
import { CRPage } from './crPage';
import * as types from '../types';
import * as dragScriptSource from '../../generated/dragScriptSource';
import { assert } from '../../utils/utils';

export class DragManager {
  private _page: CRPage;
  private _setup = false;
  private _dragState: {
    data: DataTransferJSON,
    x: number,
    y: number
  } | null = null;
  constructor(page: CRPage) {
    this._page = page;
  }

  async _setupIfNeeded() {
    if (this._setup)
      return false;
    const page = this._page;
    await page._page.exposeBinding('dragStarted', false, (source, data: DataTransferJSON) => {
      this._dragState = {
        x: NaN,
        y: NaN,
        data,
      };
    }, 'utility');
    await page.evaluateOnNewDocument(dragScriptSource.source, 'utility');
    await Promise.all(page._page.frames().map(frame => frame._evaluateExpression(dragScriptSource.source, false, {}, 'utility').catch(e => {})));
  }

  async cancel() {
    if (!this._dragState)
      return false;
    await this._dispatchDragEvent('dragend');
    this._dragState = null;
    return true;
  }

  async move(x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, moveCallback: () => Promise<void>): Promise<void> {
    if (this._dragState) {
      await this._moveDrag(x, y);
      return;
    }
    if (button !== 'left')
      return moveCallback();

    await this._setupIfNeeded();
    await moveCallback();
    // thread the renderer to wait for the drag callback
    await this._page._page.mainFrame()._evaluateExpression('', false, null);
    if (this._dragState) {
      this._dragState!.x = x;
      this._dragState!.y = y;
    }
  }
  async _moveDrag(x: number, y: number) {
    assert(this._dragState, 'missing drag state');
    if (x === this._dragState.x && y === this._dragState.y)
      return;
    this._dragState.x = x;
    this._dragState.y = y;
    await this._dispatchDragEvent('dragover');
  }

  isDragging() {
    return !!this._dragState;
  }

  async down(x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>): Promise<boolean> {
    return !!this._dragState;
  }

  async up(x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>) {
    // await this._moveDrag(x, y);
    assert(this._dragState, 'missing drag state');
    this._dragState.x = x;
    this._dragState.y = y;
    await this._dispatchDragEvent('drop');
    this._dragState = null;
  }

  async _dispatchDragEvent(type: 'dragover'|'drop'|'dragend') {
    assert(this._dragState, 'missing drag state');
    const {backendNodeId, frameId} = await this._page._mainFrameSession._client.send('DOM.getNodeForLocation', {
      x: Math.round(this._dragState.x),
      y: Math.round(this._dragState.y),
      ignorePointerEventsNone: false,
      includeUserAgentShadowDOM: false
    });
    const frame = this._page._page.frames().find(x => x._id === frameId)!;

    const context = await frame._utilityContext();
    const elementHandle = await this._page._mainFrameSession._adoptBackendNodeId(backendNodeId, context);
    // console.log(elementHandle);
    return await elementHandle.evaluate(dispatchDragEvent, {
      json: type === 'dragend' ? null : this._dragState.data,
      type,
      x: this._dragState.x,
      y: this._dragState.y,
    });
  }
}


async function dispatchDragEvent(element: Node, {type, x, y, json}: {type: 'dragover'|'drop'|'dragend', x: number, y: number, json: DataTransferJSON|null}) {
  const node = element; // document.elementFromPoint(x, y);
  if (!node)
    throw new Error(`could not find node at (${x},${y})`);
  const dataTransfer = jsonToDataTransfer(json);
  const lastDragNode = (window as any).__lastDragNode as Node;
  if (lastDragNode !== node) {
    if (node) {
      node.dispatchEvent(new DragEvent('dragenter', {
        dataTransfer,
        bubbles: true,
        cancelable: false
      }));
    }
    if (lastDragNode) {
      lastDragNode.dispatchEvent(new DragEvent('dragleave', {
        dataTransfer,
        bubbles: true,
        cancelable: false
      }));
    }
    (window as any).__lastDragNode = node;
  }
  const dragOverEvent = new DragEvent('dragover', {
    dataTransfer,
    bubbles: true,
    cancelable: true
  });

  node.dispatchEvent(dragOverEvent);
  if (type === 'dragend') {
    endDrag();
    return;
  }
  if (type === 'dragover') return;

  // TODO(einbinder) This should check if the effect is allowed
  // by the DataTransfer, but currently the user can't set the effect.
  if (dragOverEvent.defaultPrevented) {
    const dropEvent = new DragEvent('drop', {
      dataTransfer,
      bubbles: true,
      cancelable: true
    });
    node.dispatchEvent(dropEvent);
    if (dropEvent.defaultPrevented) {
      endDrag();
      return;
    }
  }
  doDefaultDrop();
  endDrag();

  function endDrag() {
    if ((window as any).__draggingElement) {
      const draggingElement: Element = (window as any).__draggingElement;
      delete (window as any).__draggingElement;
      draggingElement.dispatchEvent(new DragEvent('dragend', {
        dataTransfer: new DataTransfer(),
        bubbles: true,
        cancelable: false
      }));
    }
  }

  function doDefaultDrop() {
    const htmlItem = json!.items.find(x => x.type === 'text/html');
    const textItem = json!.items.find(x => x.type.startsWith('text/'));
    if (!htmlItem && !textItem)
      return;
    // const html = document.createElement('')
    const editableTarget = editableAncestor(node);
    if (!editableTarget)
      return;
    editableTarget.focus();
    if (htmlItem)
      document.execCommand('insertHTML', false, itemToString(htmlItem));
    else if (textItem)
      document.execCommand('insertText', false, itemToString(textItem));
  }

  function jsonToDataTransfer(json: DataTransferJSON|null): DataTransfer {
    const transfer = new DataTransfer();
    // Chromium doesn't allow setting these properties on a DataTransfer that wasn't
    // specifically created for drag and drop. Redefining them lets us set them,
    // but its mostly futile because this doesn't effect the main execution context.
    Object.defineProperty(transfer, 'effectAllowed', {value: transfer.effectAllowed, writable: true});
    Object.defineProperty(transfer, 'dropEffect', {value: transfer.dropEffect, writable: true});
    if (json) {
      for (const {data, type} of json.items) {
        if (typeof data === 'string')
          transfer.items.add(data, type);
        else
          transfer.items.add(jsonToFile(data));
      }
      transfer.effectAllowed = json.effectAllowed;
      transfer.dropEffect = json.dropEffect;
    }
    return transfer;
  }


  function binaryDataURLToString(url: string) {
    return atob(url.slice(url.indexOf(',') + 1));
  }

  function jsonToFile(json: FileJSON): File {
    const data = atob(binaryDataURLToString(json.dataURL));
    const file = new File([data], json.name, {
      lastModified: json.lastModified,
      type: json.type,
    });
    return file;
  }

  function itemToString({data}: ItemJSON) {
    if (typeof data === 'string')
      return data;
    return binaryDataURLToString(data.dataURL);
  }

  function editableAncestor(node: Node|null): HTMLElement|null {
    if (!node)
      return null;
    if (isEditable(node))
      return node as HTMLElement;
    return editableAncestor(node.parentElement);
  }

  function isEditable(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE)
      return false;
    const element = node as Element;
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      const type = (input.getAttribute('type') || '').toLowerCase();
      const kDateTypes = new Set(['date', 'time', 'datetime', 'datetime-local']);
      const kTextInputTypes = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
      if (!kTextInputTypes.has(type) && !kDateTypes.has(type))
        return false;
      if (input.disabled)
        return false;
      if (input.readOnly)
        return false;
      return true;
    } else if (element.nodeName.toLowerCase() === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      if (textarea.disabled)
        return false;
      if (textarea.readOnly)
        return false;
    } else if (!(element as HTMLElement).isContentEditable) {
      return false;
    }
    return true;
  }

}

type DataTransferJSON = {
  dropEffect: string;
  effectAllowed: string;
  items: ItemJSON[];
};

type FileJSON = {
  lastModified: number;
  name: string;
  dataURL: string;
  type: string;
  // only exists for electron
  path?: string;
};

type ItemJSON = {
  data: string|FileJSON;
  kind: string;
  type: string;
};

