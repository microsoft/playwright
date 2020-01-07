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
import * as dom from './dom';

export type SerializedAXNode = {
  role: string,
  name: string,
  value?: string|number,
  description?: string,

  keyshortcuts?: string,
  roledescription?: string,
  valuetext?: string,

  disabled?: boolean,
  expanded?: boolean,
  focused?: boolean,
  modal?: boolean,
  multiline?: boolean,
  multiselectable?: boolean,
  readonly?: boolean,
  required?: boolean,
  selected?: boolean,

  checked?: boolean|'mixed',
  pressed?: boolean|'mixed',

  level?: number,
  valuemin?: number,
  valuemax?: number,

  autocomplete?: string,
  haspopup?: string,
  invalid?: string,
  orientation?: string,

  children?: SerializedAXNode[]
};

export interface AXNode {
    isInteresting(insideControl: boolean): boolean;
    isLeafNode(): boolean;
    isControl(): boolean;
    serialize(): SerializedAXNode;
    findElement(element: dom.ElementHandle): Promise<AXNode|null>;
    children(): Iterable<AXNode>;
}

export class Accessibility {
  private _getAXTree:  () => Promise<AXNode>;
  constructor(getAXTree: () => Promise<AXNode>) {
    this._getAXTree = getAXTree;
  }

  async snapshot(options: {
      interestingOnly?: boolean;
      root?: dom.ElementHandle | null;
    } = {}): Promise<SerializedAXNode> {
    const {
      interestingOnly = true,
      root = null,
    } = options;
    const defaultRoot = await this._getAXTree();
    let needle = defaultRoot;
    if (root) {
      needle = await defaultRoot.findElement(root);
      if (!needle)
        return null;
    }
    if (!interestingOnly)
      return serializeTree(needle)[0];

    const interestingNodes: Set<AXNode> = new Set();
    collectInterestingNodes(interestingNodes, defaultRoot, false);
    if (root && !interestingNodes.has(needle))
      return null;
    return serializeTree(needle, interestingNodes)[0];
  }
}

function collectInterestingNodes(collection: Set<AXNode>, node: AXNode, insideControl: boolean) {
  if (node.isInteresting(insideControl))
    collection.add(node);
  if (node.isLeafNode())
    return;
  insideControl = insideControl || node.isControl();
  for (const child of node.children())
    collectInterestingNodes(collection, child, insideControl);
}

function serializeTree(node: AXNode, whitelistedNodes?: Set<AXNode>): SerializedAXNode[] {
  const children: SerializedAXNode[] = [];
  for (const child of node.children())
    children.push(...serializeTree(child, whitelistedNodes));

  if (whitelistedNodes && !whitelistedNodes.has(node))
    return children;

  const serializedNode = node.serialize();
  if (children.length)
    serializedNode.children = children;
  return [serializedNode];
}
