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
// This is a binding added by Playwright. See crDragDrop.ts
declare function dragStarted(json: DataTransferJSON): Promise<void>;

window.addEventListener('dragstart', async originalDrag => {
  if (originalDrag.defaultPrevented || !originalDrag.isTrusted)
    return;
  // cancel this drag, and create our own in order to track it
  originalDrag.preventDefault();
  originalDrag.stopImmediatePropagation();
  const drag = new DragEvent(originalDrag.type, {
    altKey: originalDrag.altKey,
    bubbles: originalDrag.bubbles,
    button: originalDrag.button,
    buttons: originalDrag.buttons,
    cancelable: originalDrag.cancelable,
    clientX: originalDrag.clientX,
    clientY: originalDrag.clientY,
    composed: originalDrag.composed,
    ctrlKey: originalDrag.ctrlKey,
    dataTransfer: originalDrag.dataTransfer,
    detail: originalDrag.detail,
    metaKey: originalDrag.metaKey,
    modifierAltGraph: originalDrag.getModifierState('AltGraph'),
    modifierCapsLock: originalDrag.getModifierState('CapsLock'),
    movementX: originalDrag.movementX,
    movementY: originalDrag.movementY
  });
  const path = originalDrag.composedPath();
  if (!path.length)
    return;
  path[0].dispatchEvent(drag);
  if (!drag.dataTransfer || drag.defaultPrevented)
    return;
  const json = await dataTransferToJSON(drag.dataTransfer);
  (window as any).__draggingElement = path[0];
  dragStarted(json);
}, true);

async function dataTransferToJSON(dataTransfer: DataTransfer): Promise<DataTransferJSON> {
  const items = await Promise.all([...dataTransfer.items].map(async item => {
    let data: string|FileJSON;
    // store the item data before it disapears next tick
    const {type, kind} = item;
    if (kind === 'file')
      data = await fileToJSON(item.getAsFile()!);
    else
      data = await new Promise<string>(x => item.getAsString(x));
    return {
      kind,
      type,
      data,
    } as ItemJSON;
  }));
  return {
    dropEffect: dataTransfer.dropEffect,
    effectAllowed: dataTransfer.effectAllowed,
    items,
  };
}

async function fileToJSON(file: File): Promise<FileJSON> {
  const buffer = await file.arrayBuffer();
  btoa(new Uint8Array(buffer).toString());
  const reader = new FileReader();
  const promise = new Promise(x => reader.onload = x);
  reader.readAsDataURL(file);
  await promise;
  return {
    lastModified: file.lastModified,
    name: file.name,
    type: file.type,
    dataURL: reader.result as string
  };
}
