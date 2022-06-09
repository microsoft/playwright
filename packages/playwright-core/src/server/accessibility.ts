/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import type * as dom from './dom';
import type * as types from './types';

export interface AXNode {
    isInteresting(insideControl: boolean): boolean;
    isLeafNode(): boolean;
    isControl(): boolean;
    serialize(): types.SerializedAXNode;
    children(): Iterable<AXNode>;
}

export class Accessibility {
  private _getAXTree:  (needle?: dom.ElementHandle) => Promise<{tree: AXNode, needle: AXNode | null}>;
  constructor(getAXTree: (needle?: dom.ElementHandle) => Promise<{tree: AXNode, needle: AXNode | null}>) {
    this._getAXTree = getAXTree;
  }

  async snapshot(options: {
      interestingOnly?: boolean;
      root?: dom.ElementHandle;
    } = {}): Promise<types.SerializedAXNode | null> {
    const {
      interestingOnly = true,
      root = null,
    } = options;
    const { tree, needle } = await this._getAXTree(root || undefined);
    if (!interestingOnly) {
      if (root)
        return needle && serializeTree(needle)[0];
      return serializeTree(tree)[0];
    }

    const interestingNodes: Set<AXNode> = new Set();
    collectInterestingNodes(interestingNodes, tree, false);
    if (root && (!needle || !interestingNodes.has(needle)))
      return null;
    return serializeTree(needle || tree, interestingNodes)[0];
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

function serializeTree(node: AXNode, whitelistedNodes?: Set<AXNode>): types.SerializedAXNode[] {
  const children: types.SerializedAXNode[] = [];
  for (const child of node.children())
    children.push(...serializeTree(child, whitelistedNodes));

  if (whitelistedNodes && !whitelistedNodes.has(node))
    return children;

  const serializedNode = node.serialize();
  if (children.length)
    serializedNode.children = children;
  return [serializedNode];
}
