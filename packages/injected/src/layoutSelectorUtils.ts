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

function boxRightOf(box1: DOMRect, box2: DOMRect, maxDistance: number | undefined): number | undefined {
  const distance = box1.left - box2.right;
  if (distance < 0 || (maxDistance !== undefined && distance > maxDistance))
    return;
  return distance + Math.max(box2.bottom - box1.bottom, 0) + Math.max(box1.top - box2.top, 0);
}

function boxLeftOf(box1: DOMRect, box2: DOMRect, maxDistance: number | undefined): number | undefined {
  const distance = box2.left - box1.right;
  if (distance < 0 || (maxDistance !== undefined && distance > maxDistance))
    return;
  return distance + Math.max(box2.bottom - box1.bottom, 0) + Math.max(box1.top - box2.top, 0);
}

function boxAbove(box1: DOMRect, box2: DOMRect, maxDistance: number | undefined): number | undefined {
  const distance = box2.top - box1.bottom;
  if (distance < 0 || (maxDistance !== undefined && distance > maxDistance))
    return;
  return distance + Math.max(box1.left - box2.left, 0) + Math.max(box2.right - box1.right, 0);
}

function boxBelow(box1: DOMRect, box2: DOMRect, maxDistance: number | undefined): number | undefined {
  const distance = box1.top - box2.bottom;
  if (distance < 0 || (maxDistance !== undefined && distance > maxDistance))
    return;
  return distance + Math.max(box1.left - box2.left, 0) + Math.max(box2.right - box1.right, 0);
}

function boxNear(box1: DOMRect, box2: DOMRect, maxDistance: number | undefined): number | undefined {
  const kThreshold = maxDistance === undefined ? 50 : maxDistance;
  let score = 0;
  if (box1.left - box2.right >= 0)
    score += box1.left - box2.right;
  if (box2.left - box1.right >= 0)
    score += box2.left - box1.right;
  if (box2.top - box1.bottom >= 0)
    score += box2.top - box1.bottom;
  if (box1.top - box2.bottom >= 0)
    score += box1.top - box2.bottom;
  return score > kThreshold ? undefined : score;
}

export type LayoutSelectorName = 'left-of' | 'right-of' | 'above' | 'below' | 'near';
export const kLayoutSelectorNames: LayoutSelectorName[] = ['left-of', 'right-of', 'above', 'below', 'near'];

export function layoutSelectorScore(name: LayoutSelectorName, element: Element, inner: Element[], maxDistance: number | undefined): number | undefined {
  const box = element.getBoundingClientRect();
  const scorer = { 'left-of': boxLeftOf, 'right-of': boxRightOf, 'above': boxAbove, 'below': boxBelow, 'near': boxNear }[name];
  let bestScore: number | undefined;
  for (const e of inner) {
    if (e === element)
      continue;
    const score = scorer(box, e.getBoundingClientRect(), maxDistance);
    if (score === undefined)
      continue;
    if (bestScore === undefined || score < bestScore)
      bestScore = score;
  }
  return bestScore;
}
