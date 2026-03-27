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

if (process.env.PW_INSTRUMENT_MODULES) {
  const Module = require('module');
  const originalLoad = Module._load;

  type TreeNode = { name: string, selfMs: number, totalMs: number, childrenMs: number, children: TreeNode[] };
  const root: TreeNode = { name: '<root>', selfMs: 0, totalMs: 0, childrenMs: 0, children: [] };
  let current = root;
  const stack: TreeNode[] = [];

  Module._load = function(request: any, _parent: any, _isMain: any) {
    const node: TreeNode = { name: request, selfMs: 0, totalMs: 0, childrenMs: 0, children: [] };
    current.children.push(node);
    stack.push(current);
    current = node;
    const start = performance.now();
    let result;
    try {
      result = originalLoad.apply(this, arguments);
    } catch (e) {
      // Module load failed (e.g. optional dep not found) — unwind stack.
      current = stack.pop()!;
      current.children.pop();
      throw e;
    }
    const duration = performance.now() - start;
    node.totalMs = duration;
    node.selfMs = Math.max(0, duration - node.childrenMs);
    current = stack.pop()!;
    current.childrenMs += duration;
    return result;
  };

  process.on('exit', () => {
    function printTree(node: TreeNode, prefix: string, isLast: boolean, lines: string[], depth: number) {
      if (node.totalMs < 1 && depth > 0)
        return;
      const connector = depth === 0 ? '' : isLast ? '└── ' : '├── ';
      const time = `${node.totalMs.toFixed(1).padStart(8)}ms`;
      const self = node.children.length ? ` (self: ${node.selfMs.toFixed(1)}ms)` : '';
      lines.push(`${time}  ${prefix}${connector}${node.name}${self}`);
      const childPrefix = prefix + (depth === 0 ? '' : isLast ? '    ' : '│   ');
      const sorted = node.children.slice().sort((a, b) => b.totalMs - a.totalMs);
      for (let i = 0; i < sorted.length; i++)
        printTree(sorted[i], childPrefix, i === sorted.length - 1, lines, depth + 1);
    }

    let totalModules = 0;
    function count(n: TreeNode) { totalModules++; n.children.forEach(count); }
    root.children.forEach(count);

    const lines: string[] = [];
    const sorted = root.children.slice().sort((a, b) => b.totalMs - a.totalMs);
    for (let i = 0; i < sorted.length; i++)
      printTree(sorted[i], '', i === sorted.length - 1, lines, 0);

    const totalMs = root.children.reduce((s, c) => s + c.totalMs, 0);
    // eslint-disable-next-line no-restricted-properties
    process.stderr.write(`\n--- Module load tree: ${totalModules} modules, ${totalMs.toFixed(0)}ms total ---\n` + lines.join('\n') + '\n');

    // Flat list: aggregate selfMs across all tree nodes by name.
    const flat = new Map<string, { selfMs: number, totalMs: number, count: number }>();
    function gather(n: TreeNode) {
      const existing = flat.get(n.name);
      if (existing) {
        existing.selfMs += n.selfMs;
        existing.totalMs += n.totalMs;
        existing.count++;
      } else {
        flat.set(n.name, { selfMs: n.selfMs, totalMs: n.totalMs, count: 1 });
      }
      n.children.forEach(gather);
    }
    root.children.forEach(gather);
    const top50 = [...flat.entries()].sort((a, b) => b[1].selfMs - a[1].selfMs).slice(0, 50);
    const flatLines = top50.map(([mod, { selfMs, totalMs, count }]) =>
      `${selfMs.toFixed(1).padStart(8)}ms self ${totalMs.toFixed(1).padStart(8)}ms total  (x${String(count).padStart(3)})  ${mod}`
    );
    // eslint-disable-next-line no-restricted-properties
    process.stderr.write(`\n--- Top 50 modules by self time ---\n` + flatLines.join('\n') + '\n');
  });
}
