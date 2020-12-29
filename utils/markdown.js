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

// @ts-check

/** @typedef {{
 *    type: 'text' | 'li' | 'code' | 'gen' | 'h0' | 'h1' | 'h2' | 'h3' | 'h4',
 *    text?: string,
 *    codeLang?: string,
 *    lines?: string[],
 *    liType?: 'default' | 'bullet' | 'ordinal',
 *    children?: MarkdownNode[]
 *  }} MarkdownNode */

function normalizeLines(content) {
  const inLines = content.replace(/\r\n/g, '\n').split('\n');
  let inCodeBlock = false;
  const outLines = [];
  let outLineTokens = [];
  for (const line of inLines) {
    let singleLineExpression = line.startsWith('#');
    let flushParagraph = !line.trim()
      || line.trim().startsWith('1.')
      || line.trim().startsWith('<')
      || line.trim().startsWith('>')
      || line.trim().startsWith('-')
      || line.trim().startsWith('*')
      || singleLineExpression;
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      flushParagraph = true;
    }
    if (flushParagraph && outLineTokens.length) {
      outLines.push(outLineTokens.join(' '));
      outLineTokens = [];
    }
    const trimmedLine = line.trim();
    if (inCodeBlock || singleLineExpression)
      outLines.push(line);
    else if (trimmedLine)
      outLineTokens.push(trimmedLine.startsWith('-') ? line : trimmedLine);
  }
  if (outLineTokens.length)
    outLines.push(outLineTokens.join(' '));
  return outLines;
}

/**
 * @param {string[]} lines
 */
function buildTree(lines) {
  /** @type {MarkdownNode} */
  const root = {
    type: 'h0',
    text: '<root>',
    children: []
  };
  /** @type {MarkdownNode[]} */
  const stack = [root];
  /** @type {MarkdownNode[]} */
  let liStack = null;

  for (let i = 0; i < lines.length; ++i) {
    let line = lines[i];

    if (line.startsWith('```')) {
      /** @type {MarkdownNode} */
      const node = {
        type: 'code',
        lines: [],
        codeLang: line.substring(3)
      };
      stack[0].children.push(node);
      line = lines[++i];
      while (!line.startsWith('```')) {
        node.lines.push(line);
        line = lines[++i];
      }
      continue;
    }

    if (line.startsWith('<!-- GEN')) {
      /** @type {MarkdownNode} */
      const node = {
        type: 'gen',
        lines: [line]
      };
      stack[0].children.push(node);
      line = lines[++i];
      while (!line.startsWith('<!-- GEN')) {
        node.lines.push(line);
        line = lines[++i];
      }
      node.lines.push(line);
      continue;
    }

    const header = line.match(/^(#+)/);
    if (header) {
      const h = header[1].length;
      const node = /** @type {MarkdownNode} */({ type: 'h' + h, text: line.substring(h + 1), children: [] });

      while (true) {
        const lastH = +stack[0].type.substring(1);
        if (h <= lastH)
          stack.shift();
        else
          break;
      }
      stack[0].children.push(node);
      stack.unshift(node);
      liStack = [node];
      continue;
    }

    const list = line.match(/^(\s*)(-|1.|\*) /);
    const depth = list ? (list[1].length / 2) : 0;
    const node = /** @type {MarkdownNode} */({ type: 'text', text: line });
    if (list) {
      node.type = 'li';
      node.text = line.substring(list[0].length);
      if (line.trim().startsWith('1.'))
        node.liType = 'ordinal';
      else if (line.trim().startsWith('*'))
        node.liType = 'bullet';
      else 
        node.liType = 'default';
    }
    if (!liStack[depth].children)
      liStack[depth].children = [];
    liStack[depth].children.push(node);
    liStack[depth + 1] = node;
  }
  return root.children;
}

/**
 * @param {string} content
 */
function parse(content) {
  return buildTree(normalizeLines(content));
}

/**
 * @param {MarkdownNode[]} nodes
 * @param {number=} maxColumns
 */
function render(nodes, maxColumns) {
  const result = [];
  let lastNode;
  for (let node of nodes) {
    innerRenderMdNode(node, lastNode, result, maxColumns);
    lastNode = node;
  }
  return result.join('\n');
}

/**
 * @param {MarkdownNode} node
 * @param {MarkdownNode} lastNode
 * @param {number=} maxColumns
 * @param {string[]} result
 */
function innerRenderMdNode(node, lastNode, result, maxColumns) {
  const newLine = () => {
    if (result[result.length - 1] !== '')
      result.push('');
  };

  if (node.type.startsWith('h')) {
    newLine();
    const depth = +node.type.substring(1);
    result.push(`${'#'.repeat(depth)} ${node.text}`);
    let lastNode = node;
    for (const child of node.children || []) {
      innerRenderMdNode(child, lastNode, result, maxColumns);
      lastNode = child;
    }
  }

  if (node.type === 'text') {
    const bothComments = node.text.startsWith('>') && lastNode && lastNode.type === 'text' && lastNode.text.startsWith('>');
    if (!bothComments && lastNode && lastNode.text)
      newLine();
      result.push(wrapText(node.text, maxColumns));
  }

  if (node.type === 'code') {
    newLine();
    result.push('```' + node.codeLang);
    for (const line of node.lines)
      result.push(line);
    result.push('```');
    newLine();
  }

  if (node.type === 'gen') {
    newLine();
    for (const line of node.lines)
      result.push(line);
    newLine();
  }

  if (node.type === 'li') {
    const visit = (node, indent) => {
      let char;
      switch (node.liType) {
        case 'bullet': char = '*'; break;
        case 'default': char = '-'; break;
        case 'ordinal': char = '1.'; break;
      }
      result.push(`${indent}${char} ${wrapText(node.text, maxColumns, indent + ' '.repeat(char.length + 1))}`);
      for (const child of node.children || [])
        visit(child, indent + '  ');
    };
    visit(node, '');
  }
}

/**
 * @param {string} text
 */
function tokenizeText(text) {
  const links = [];
  // Don't wrap simple links with spaces.
  text = text.replace(/\[[^\]]+\]/g, match => {
    links.push(match);
    return `[${links.length - 1}]`;
  });
  return text.split(' ').map(c => c.replace(/\[(\d+)\]/g, (_, p1) => links[+p1]));
}

/**
 * @param {string} text
 * @param {number=} maxColumns
 * @param {string=} indent
 */
function wrapText(text, maxColumns = 0, indent = '') {
  if (!maxColumns)
    return text;
  const lines = [];
  maxColumns -= indent.length;
  const words = tokenizeText(text);
  let line = '';
  for (const word of words) {
    if (line.length && line.length + word.length < maxColumns) {
      line += ' ' + word;
    } else {
      if (line)
        lines.push(line);
      line = (lines.length ? indent : '') + word;
    }
  }
  if (line)
    lines.push(line);
  return lines.join('\n');
}

/**
 * @param {MarkdownNode} node
 */
function clone(node) {
  const copy = { ...node };
  copy.children = copy.children ? copy.children.map(c => clone(c)) : undefined;
  return copy;
}

/**
 * @param {MarkdownNode[]} nodes
 * @param {function(MarkdownNode): void} visitor
 */
function visitAll(nodes, visitor) {
  for (const node of nodes)
    visit(node, visitor);
}

/**
 * @param {MarkdownNode} node
 * @param {function(MarkdownNode): void} visitor
 */
function visit(node, visitor) {
  visitor(node);
  for (const n of node.children || [])
    visit(n, visitor);
}

module.exports = { parse, render, clone, visitAll, visit };
