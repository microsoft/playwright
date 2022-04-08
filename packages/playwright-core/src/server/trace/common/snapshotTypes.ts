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

import type { Entry as HAREntry } from '../../har/har';

export type ResourceSnapshot = HAREntry;

export type NodeSnapshot =
  // Text node.
  string |
  // Subtree reference, "x snapshots ago, node #y". Could point to a text node.
  // Only nodes that are not references are counted, starting from zero, using post-order traversal.
  [ [number, number] ] |
  // Just node name.
  [ string ] |
  // Node name, attributes, child nodes.
  // Unfortunately, we cannot make this type definition recursive, therefore "any".
  [ string, { [attr: string]: string }, ...any ];


export type ResourceOverride = {
  url: string,
  sha1?: string,
  ref?: number
};

export type FrameSnapshot = {
  snapshotName?: string,
  pageId: string,
  frameId: string,
  frameUrl: string,
  timestamp: number,
  collectionTime: number,
  doctype?: string,
  html: NodeSnapshot,
  resourceOverrides: ResourceOverride[],
  viewport: { width: number, height: number },
  isMainFrame: boolean,
};

export type RenderedFrameSnapshot = {
  html: string;
  pageId: string;
  frameId: string;
  index: number;
};
