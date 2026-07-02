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

import { normalizeWhiteSpace } from '@isomorphic/stringUtils';

import type * as aria from '@isomorphic/ariaSnapshot';
import type { AriaSnapshot, AriaTreeOptions } from './ariaSnapshot';

// Distillation makes the snapshot less verbose without losing information: after the full tree is
// built, a single traversal applies the chained plugins below, babel-style. Each plugin is a
// visitor: `enter` runs pre-order, `exit` runs post-order after the children were traversed - and
// possibly removed, unwrapped or inlined. Either hook can detach the node by returning 'remove'
// (from `enter`, the subtree is then not traversed and no further hooks run for it), or replace
// the node with its children by returning 'unwrap' (from `enter`, the hoisted children are
// re-visited in the node's place; from `exit`, they were already traversed and are spliced in as
// is). Plugins mutate the tree in place; `snapshot.info` and `snapshot.refs` are left intact, so
// refs of removed nodes still resolve through the aria-ref selector engine.
type DistillerContext = {
  snapshot: AriaSnapshot;
  // Depth of the current node; children of the root fragment are at depth 0.
  depth: number;
  // Render depth limit, plugins should not rely on anything below it being rendered.
  maxDepth: number | undefined;
  // The chain of ancestors of the current node, root first. Maintained by the traversal.
  ancestors: aria.AriaNode[];
  // Content refs of the entered nodes' accessible names that are not yet represented in the
  // output - see `removeRedundantNames`.
  pendingContentRefs: Set<string>;
};

type DistillerPlugin = {
  name: string;
  enter?(node: aria.AriaNode, ctx: DistillerContext): 'remove' | 'unwrap' | void;
  exit?(node: aria.AriaNode, ctx: DistillerContext): 'remove' | 'unwrap' | void;
};

export function distillAriaSnapshot(snapshot: AriaSnapshot, options: Pick<AriaTreeOptions, 'mode' | 'depth'>) {
  runPlugins(snapshot, options.mode === 'ai' ? aiPlugins : normalizePlugins, options);
}

function runPlugins(snapshot: AriaSnapshot, plugins: DistillerPlugin[], options: Pick<AriaTreeOptions, 'depth'>) {
  const ctx: DistillerContext = { snapshot, depth: -1, maxDepth: options.depth, ancestors: [], pendingContentRefs: new Set() };
  const traverse = (node: aria.AriaNode, depth: number) => {
    const children: (aria.AriaNode | string)[] = [];
    const visitChild = (child: aria.AriaNode | string) => {
      if (typeof child === 'string') {
        children.push(child);
        return;
      }
      ctx.depth = depth + 1;
      for (const plugin of plugins) {
        const result = plugin.enter?.(child, ctx);
        if (result === 'remove')
          return;
        if (result === 'unwrap') {
          child.children.forEach(visitChild);
          return;
        }
      }
      traverse(child, depth + 1);
      ctx.depth = depth + 1;
      for (const plugin of plugins) {
        const result = plugin.exit?.(child, ctx);
        if (result === 'remove')
          return;
        if (result === 'unwrap') {
          children.push(...child.children);
          return;
        }
      }
      children.push(child);
    };
    ctx.ancestors.push(node);
    node.children.forEach(visitChild);
    ctx.ancestors.pop();
    node.children = children;
  };
  // Hooks run on the root as well, but the root cannot be removed or unwrapped.
  for (const plugin of plugins)
    plugin.enter?.(snapshot.root, ctx);
  traverse(snapshot.root, -1);
  ctx.depth = -1;
  for (const plugin of plugins)
    plugin.exit?.(snapshot.root, ctx);
}

// A generic node whose only content is text - it carries no structure of its own.
function isLeafGeneric(node: aria.AriaNode): boolean {
  return node.role === 'generic' && node.children.every(child => typeof child === 'string');
}

// The tree builder emits raw text tokens - text nodes, CSS content, block spacing markers - as
// string children. Coalesce the adjacent ones, normalize whitespace and drop the empties, then
// drop a lone text child that merely repeats the node's accessible name. Runs on `exit`, so the
// merge sees the children in their final shape.
const mergeStringChildren: DistillerPlugin = {
  name: 'mergeStringChildren',
  exit(node: aria.AriaNode) {
    const children: (aria.AriaNode | string)[] = [];
    const buffer: string[] = [];
    const flush = () => {
      if (!buffer.length)
        return;
      const text = normalizeWhiteSpace(buffer.join(''));
      if (text)
        children.push(text);
      buffer.length = 0;
    };
    for (const child of node.children) {
      if (typeof child === 'string') {
        buffer.push(child);
      } else {
        flush();
        children.push(child);
      }
    }
    flush();
    node.children = children;
    if (node.children.length === 1 && node.children[0] === node.name)
      node.children = [];
  },
};

// Only unwrap a generic that encloses at most one element, logical grouping still makes sense,
// even if it is not ref-able. The decision is made on `exit` - whether the node encloses a single
// ref-bearing child is only known after its own descendants were unwrapped - so nested wrappers
// collapse bottom-up.
const unwrapSingleChildGenerics: DistillerPlugin = {
  name: 'unwrapSingleChildGenerics',
  exit(node: aria.AriaNode): 'unwrap' | void {
    if (node.role === 'generic' && !node.name && node.children.length <= 1 && node.children.every(child => typeof child !== 'string' && !!child.ref))
      return 'unwrap';
  },
};

// A decorative image - role `img` with no accessible name and no content - carries no
// information. The decision is made on `exit` - whether the node has content is only known after
// `mergeStringChildren` dropped the empty text tokens.
const removeNamelessImages: DistillerPlugin = {
  name: 'removeNamelessImages',
  exit(node: aria.AriaNode): 'remove' | void {
    if (node.role === 'img' && !node.name && !node.children.length)
      return 'remove';
  },
};

// The node's accessible name is derived from content; when every node that contributed to it is
// represented in the output anyway, the name would just repeat that content and is dropped.
// Single-pass bookkeeping over the shared `pendingContentRefs` set: entering a node clears its
// own ref - it is now represented - except for leaf generics, which only exist to supply text
// and are dropped by `removeNameRepeatingChild` once a kept name shows it. On exit, either every
// contributor was cleared and the name goes, or the kept name now represents its contributors,
// so they are cleared for the benefit of the ancestors. A node removed on enter never clears its
// ref, and an unwrapped one does - matching what remains in the tree.
const removeRedundantNames: DistillerPlugin = {
  name: 'removeRedundantNames',
  enter(node: aria.AriaNode, ctx: DistillerContext) {
    if (!node.ref)
      return;
    for (const ref of ctx.snapshot.info.get(node.ref)?.nameFromContentRefs || [])
      ctx.pendingContentRefs.add(ref);
    const beyondDepth = !!ctx.maxDepth && ctx.depth > ctx.maxDepth;
    if (!beyondDepth && !isLeafGeneric(node))
      ctx.pendingContentRefs.delete(node.ref);
  },
  exit(node: aria.AriaNode, ctx: DistillerContext) {
    if (!node.ref)
      return;
    const nameFromContentRefs = ctx.snapshot.info.get(node.ref)?.nameFromContentRefs;
    if (!nameFromContentRefs?.length)
      return;
    if (nameFromContentRefs.every(ref => !ctx.pendingContentRefs.has(ref))) {
      node.name = '';
    } else {
      for (const ref of nameFromContentRefs)
        ctx.pendingContentRefs.delete(ref);
    }
  },
};

// A generic whose whole content is a piece of text - a single text child, or just an accessible
// name - that repeats the parent's accessible name adds no information, so it removes itself.
// `inlineTextIntoGeneric` runs first, bubbling text up through nameless wrappers, so by the time
// a wrapper exits its text faces the real parent - no need to look further up the ancestor chain.
// Whenever the node is the source of that name, `removeRedundantNames` keeps the name - the node
// is a leaf generic - so the text is never lost.
const removeNameRepeatingChild: DistillerPlugin = {
  name: 'removeNameRepeatingChild',
  exit(node: aria.AriaNode, ctx: DistillerContext): 'remove' | void {
    const parent = ctx.ancestors[ctx.ancestors.length - 1];
    if (!parent?.name || node.role !== 'generic' || node.active || Object.keys(node.props).length)
      return;
    const singleTextChild = node.children.length === 1 && typeof node.children[0] === 'string' ? node.children[0] : undefined;
    const text = node.name ? (node.children.length ? undefined : node.name) : singleTextChild;
    if (text && text === parent.name)
      return 'remove';
  },
};

// A generic whose only child is a nameless leaf generic inlines that child's text:
// `generic: - generic: "text"` becomes `generic: "text"`. Runs post-order, so chains collapse
// bottom-up, and after the other plugins already removed or unwrapped the children.
const inlineTextIntoGeneric: DistillerPlugin = {
  name: 'inlineTextIntoGeneric',
  exit(node: aria.AriaNode) {
    if (node.role !== 'generic' || Object.keys(node.props).length || node.children.length !== 1)
      return;
    const child = node.children[0];
    if (typeof child === 'string')
      return;
    if (child.role !== 'generic' || child.name || child.active || Object.keys(child.props).length)
      return;
    if (child.children.length === 1 && typeof child.children[0] === 'string')
      node.children = [child.children[0]];
  },
};

// Structural normalization applies to all modes - it defines the canonical tree shape.
const normalizePlugins: DistillerPlugin[] = [
  mergeStringChildren,
  unwrapSingleChildGenerics,
];

// The ai preset compresses the snapshot on top of normalization. It runs as one traversal:
// `removeRedundantNames` bookkeeping must observe every node the tree retains, including the
// wrappers that `unwrapSingleChildGenerics` is about to unwrap. On exit, text is first inlined
// into the node, so that `removeNameRepeatingChild` faces the real parent when it compares.
const aiPlugins: DistillerPlugin[] = [
  mergeStringChildren,
  removeNamelessImages,
  removeRedundantNames,
  inlineTextIntoGeneric,
  removeNameRepeatingChild,
  unwrapSingleChildGenerics,
];
