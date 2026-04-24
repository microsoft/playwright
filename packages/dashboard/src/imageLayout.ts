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

// Geometry of an `object-fit: contain` <img>: the rendered image's size and
// offset relative to the element's bounding box.
export type ImageLayout = {
  rect: DOMRect;
  renderW: number;
  renderH: number;
  offsetX: number;
  offsetY: number;
};

export function getImageLayout(display: HTMLImageElement | null): ImageLayout | null {
  if (!display || !display.naturalWidth || !display.naturalHeight)
    return null;
  const rect = display.getBoundingClientRect();
  const imgAspect = display.naturalWidth / display.naturalHeight;
  const elemAspect = rect.width / rect.height;
  if (imgAspect > elemAspect) {
    const renderH = rect.width / imgAspect;
    return { rect, renderW: rect.width, renderH, offsetX: 0, offsetY: (rect.height - renderH) / 2 };
  }
  const renderW = rect.height * imgAspect;
  return { rect, renderW, renderH: rect.height, offsetX: (rect.width - renderW) / 2, offsetY: 0 };
}

export function clientToViewport(layout: ImageLayout, vw: number, vh: number, clientX: number, clientY: number): { x: number; y: number } {
  const fracX = (clientX - layout.rect.left - layout.offsetX) / layout.renderW;
  const fracY = (clientY - layout.rect.top - layout.offsetY) / layout.renderH;
  return { x: Math.round(fracX * vw), y: Math.round(fracY * vh) };
}
