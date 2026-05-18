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

type ErrorTreeNode<T> = { errors?: T[] };

export function dedupErrorTree<T extends ErrorTreeNode<T>>(errors: T[]): T[] {
  const descendants = new Set<T>();
  const visit = (node: T) => {
    if (descendants.has(node))
      return;
    descendants.add(node);
    node.errors?.forEach(visit);
  };
  for (const error of errors)
    error.errors?.forEach(visit);
  return errors.filter(e => !descendants.has(e));
}

export function flattenErrorTree<T extends ErrorTreeNode<T>>(errors: T[]): T[] {
  const visited = new Set<T>();
  const out: T[] = [];
  const walk = (node: T) => {
    if (visited.has(node))
      return;
    visited.add(node);
    out.push(node);
    node.errors?.forEach(walk);
  };
  errors.forEach(walk);
  return out;
}
