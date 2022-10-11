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
 *    type: string,
 *    text?: string,
 *    children?: MarkdownNode[],
 *    codeLang?: string,
 *  }} MarkdownBaseNode */

/** @typedef {MarkdownBaseNode & {
 *    type: 'text',
 *    text: string,
 *  }} MarkdownTextNode */

/** @typedef {MarkdownBaseNode & {
 *    type: 'h0' | 'h1' | 'h2' | 'h3' | 'h4',
 *    text: string,
 *    children: MarkdownNode[]
 *  }} MarkdownHeaderNode */

/** @typedef {MarkdownBaseNode & {
 *    type: 'li',
 *    text: string,
 *    liType: 'default' | 'bullet' | 'ordinal',
 *    children: MarkdownNode[]
 *  }} MarkdownLiNode */

/** @typedef {MarkdownBaseNode & {
 *    type: 'code',
 *    lines: string[],
 *    codeLang: string,
 *  }} MarkdownCodeNode */

/** @typedef {MarkdownBaseNode & {
 *    type: 'note',
 *    text: string,          
 *    noteType: string,
 *  }} MarkdownNoteNode */

/** @typedef {MarkdownBaseNode & {
 *    type: 'null',
 *  }} MarkdownNullNode */

/** @typedef {MarkdownBaseNode & {
 *    type: 'properties',
 *    lines: string[],
 *  }} MarkdownPropsNode */

/** @typedef {MarkdownTextNode | MarkdownLiNode | MarkdownCodeNode | MarkdownNoteNode | MarkdownHeaderNode | MarkdownNullNode | MarkdownPropsNode } MarkdownNode */

function flattenWrappedLines(content) {
  const inLines = content.replace(/\r\n/g, '\n').split('\n');
  let inCodeBlock = false;
  const outLines = [];
  let outLineTokens = [];
  for (const line of inLines) {
    const trimmedLine = line.trim();
    const singleLineExpression = line.startsWith('#');
    const codeBlockBoundary = trimmedLine.startsWith('```') || trimmedLine.startsWith('---') || trimmedLine.startsWith(':::');
    let flushLastParagraph = !trimmedLine
      || trimmedLine.startsWith('1.')
      || trimmedLine.startsWith('<')
      || trimmedLine.startsWith('>')
      || trimmedLine.startsWith('|')
      || trimmedLine.startsWith('-')
      || trimmedLine.startsWith('*')
      || line.match(/\[[^\]]+\]:.*/)
      || singleLineExpression;
    if (codeBlockBoundary) {
      inCodeBlock = !inCodeBlock;
      flushLastParagraph = true;
    }
    if (flushLastParagraph && outLineTokens.length) {
      outLines.push(outLineTokens.join(' '));
      outLineTokens = [];
    }
    if (inCodeBlock || singleLineExpression || codeBlockBoundary)
      outLines.push(line);
    else if (trimmedLine)
      outLineTokens.push(outLineTokens.length ? line.trim() : line);
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
  const headerStack = [root];

  /** @type {{ indent: string, node: MarkdownNode }[]} */
  let sectionStack = [];

  /**
   * @param {string} indent
   * @param {MarkdownNode} node
   */
  const appendNode = (indent, node) => {
    while (sectionStack.length && sectionStack[0].indent.length >= indent.length)
      sectionStack.shift();
    const parentNode = sectionStack.length ? sectionStack[0].node :headerStack[0];
    if (!parentNode.children)
      parentNode.children = [];
    parentNode.children.push(node);
    if (node.type === 'li')
      sectionStack.unshift({ indent, node });
  };

  for (let i = 0; i < lines.length; ++i) {
    let line = lines[i];

    // Headers form hierarchy.
    const header = line.match(/^(#+)/);
    if (header) {
      const h = header[1].length;
      const node = /** @type {MarkdownNode} */({ type: 'h' + h, text: line.substring(h + 1), children: [] });

      while (true) {
        const lastH = +headerStack[0].type.substring(1);
        if (h <= lastH)
          headerStack.shift();
        else
          break;
      }
      /** @type {MarkdownNode[]}*/(headerStack[0].children).push(node);
      headerStack.unshift(node);
      continue;
    }

    // Remaining items respect indent-based nesting.
    const [, indent, content] = /** @type {string[]} */ (line.match('^([ ]*)(.*)'));
    if (content.startsWith('```')) {
      /** @type {MarkdownNode} */
      const node = {
        type: 'code',
        lines: [],
        codeLang: content.substring(3)
      };
      line = lines[++i];
      while (!line.trim().startsWith('```')) {
        if (line && !line.startsWith(indent)) {
          const from = Math.max(0, i - 5)
          const to = Math.min(lines.length, from + 10);
          const snippet = lines.slice(from, to);
          throw new Error(`Bad code block: ${snippet.join('\n')}`);
        }
        if (line)
          line = line.substring(indent.length);
        node.lines.push(line);
        line = lines[++i];
      }
      appendNode(indent, node);
      continue;
    }

    if (content.startsWith(':::')) {
      /** @type {MarkdownNode} */
      const node = /** @type {MarkdownNoteNode} */ ({
        type: 'note',
        noteType: content.substring(3)
      });
      line = lines[++i];
      const tokens = [];
      while (!line.trim().startsWith(':::')) {
        if (!line.startsWith(indent)) {
          const from = Math.max(0, i - 5)
          const to = Math.min(lines.length, from + 10);
          const snippet = lines.slice(from, to);
          throw new Error(`Bad comment block: ${snippet.join('\n')}`);
        }
        tokens.push(line.substring(indent.length));
        line = lines[++i];
      }
      node.text = tokens.join(' ');
      appendNode(indent, node);
      continue;
    }

    if (content.startsWith('---')) {
      /** @type {MarkdownNode} */
      const node = {
        type: 'properties',
        lines: [],
      };
      line = lines[++i];
      while (!line.trim().startsWith('---')) {
        if (!line.startsWith(indent))
          throw new Error('Bad header block ' + line);
        node.lines.push(line.substring(indent.length));
        line = lines[++i];
      }
      appendNode(indent, node);
      continue;
    }

    const liType = content.match(/^(-|1.|\*) /);
    const node = /** @type {MarkdownNode} */({ type: 'text', text: content });
    if (liType) {
      const liNode = /** @type {MarkdownLiNode} */(node);
      liNode.type = 'li';
      liNode.text = content.substring(liType[0].length);
      if (content.startsWith('1.'))
        liNode.liType = 'ordinal';
      else if (content.startsWith('*'))
        liNode.liType = 'bullet';
      else
        liNode.liType = 'default';
    }
    const match = node.text?.match(/\*\*langs: (.*)\*\*(.*)/);
    if (match) {
      node.codeLang = match[1];
      node.text = match[2];
    }
    appendNode(indent, node);
  }
  return root.children;
}

/**
 * @param {string} content
 */
function parse(content) {
  return buildTree(flattenWrappedLines(content));
}

/**
 * @param {MarkdownNode[]} nodes
 * @param {number=} maxColumns
 */
function render(nodes, maxColumns) {
  const result = [];
  let lastNode;
  for (let node of nodes) {
    if (node.type === 'null')
      continue;
    innerRenderMdNode('', node, /** @type {MarkdownNode} */ (lastNode), result, maxColumns);
    lastNode = node;
  }
  return result.join('\n');
}

/**
 * @param {string} indent
 * @param {MarkdownNode} node
 * @param {MarkdownNode} lastNode
 * @param {number=} maxColumns
 * @param {string[]} result
 */
function innerRenderMdNode(indent, node, lastNode, result, maxColumns) {
  const newLine = () => {
    if (result[result.length - 1] !== '')
      result.push('');
  };

  if (node.type.startsWith('h')) {
    const headerNode = /** @type {MarkdownHeaderNode} */ (node);
    newLine();
    const depth = +node.type.substring(1);
    result.push(`${'#'.repeat(depth)} ${headerNode.text}`);
    let lastNode = node;
    for (const child of node.children || []) {
      innerRenderMdNode('', child, lastNode, result, maxColumns);
      lastNode = child;
    }
  }

  if (node.type === 'text') {
    const bothTables = node.text.startsWith('|') && lastNode && lastNode.type === 'text' && lastNode.text.startsWith('|');
    const bothGen = node.text.startsWith('<!--') && lastNode && lastNode.type === 'text' && lastNode.text.startsWith('<!--');
    const bothComments = node.text.startsWith('>') && lastNode && lastNode.type === 'text' && lastNode.text.startsWith('>');
    const bothLinks = node.text.match(/\[[^\]]+\]:/) && lastNode && lastNode.type === 'text' && lastNode.text.match(/\[[^\]]+\]:/);
    if (!bothTables && !bothGen && !bothComments && !bothLinks && lastNode && lastNode.text)
      newLine();
      for (const line of node.text.split('\n'))
        result.push(wrapText(line, maxColumns, indent));
    return;
  }

  if (node.type === 'code') {
    newLine();
    if (process.env.API_JSON_MODE)
      result.push(`${indent}\`\`\`${node.codeLang}`);
    else
      result.push(`${indent}\`\`\`${codeLangToHighlighter(node.codeLang)}`);
    for (const line of node.lines)
      result.push(indent + line);
    result.push(`${indent}\`\`\``);
    newLine();
    return;
  }

  if (node.type === 'note') {
    newLine();
    result.push(`${indent}:::${node.noteType}`);
    result.push(`${wrapText(node.text, maxColumns, indent)}`);
    result.push(`${indent}:::`);
    newLine();
    return;
  }

  if (node.type === 'properties') {
    result.push(`${indent}---`);
    for (const line of node.lines)
      result.push(indent + line);
    result.push(`${indent}---`);
    newLine();
    return;
  }

  if (node.type === 'li') {
    let char;
    switch (node.liType) {
      case 'bullet': char = '*'; break;
      case 'default': char = '-'; break;
      case 'ordinal': char = '1.'; break;
    }
    result.push(`${wrapText(node.text, maxColumns, `${indent}${char} `)}`);
    const newIndent = indent + ' '.repeat(char.length + 1);
    for (const child of node.children || []) {
      innerRenderMdNode(newIndent, child, lastNode, result, maxColumns);
      lastNode = child;
    }
  }
}

/**
 * @param {string} text
 */
function tokenizeNoBreakLinks(text) {
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
 * @param {string=} prefix
 */
function wrapText(text, maxColumns = 0, prefix = '') {
  if (!maxColumns)
    return prefix + text;
  if (text.trim().startsWith('|'))
    return prefix + text;
  const indent = ' '.repeat(prefix.length);
  const lines = [];
  maxColumns -= indent.length;
  const words = tokenizeNoBreakLinks(text);
  let line = '';
  for (const word of words) {
    if (line.length && line.length + word.length < maxColumns) {
      line += ' ' + word;
    } else {
      if (line)
        lines.push(line);
      line = (lines.length ? indent : prefix) + word;
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
 * @param {function(MarkdownNode, number): void} visitor
 */
function visitAll(nodes, visitor) {
  for (const node of nodes)
    visit(node, visitor);
}

/**
 * @param {MarkdownNode} node
 * @param {function(MarkdownNode, number): void} visitor
 */
function visit(node, visitor, depth = 0) {
  visitor(node, depth);
  for (const n of node.children || [])
    visit(n, visitor, depth + 1);
}

/**
 * @param {MarkdownNode[]} nodes
 * @param {boolean=} h3
 * @returns {string}
 */
function generateToc(nodes, h3) {
  const result = [];
  visitAll(nodes, (node, depth) => {
    if (node.type === 'h1' || node.type === 'h2' || (h3 && node.type === 'h3')) {
      let link = node.text.toLowerCase();
      link = link.replace(/[ ]+/g, '-');
      link = link.replace(/[^\w-_]/g, '');
      result.push(`${' '.repeat(depth * 2)}- [${node.text}](#${link})`);
    }
  });
  return result.join('\n');
}

/**
 * @param {MarkdownNode[]} nodes
 * @param {string} language
 * @return {MarkdownNode[]}
 */
function filterNodesForLanguage(nodes, language) {
  const result = nodes.filter(node => {
    if (!node.children)
      return true;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.type !== 'li' || child.liType !== 'bullet' || !child.text.startsWith('langs:'))
        continue;
      const onlyText = child.text.substring('langs:'.length);
      if (!onlyText)
        return true;
      const only = onlyText.split(',').map(l => l.trim());
      node.children.splice(i, 1);
      return only.includes(language);
    }
    return true;
  });
  result.forEach(n => {
    if (!n.children)
      return;
    n.children = filterNodesForLanguage(n.children, language);
  });
  return result;
}

/**
 * @param {string} codeLang
 * @return {string}
 */
function codeLangToHighlighter(codeLang) {
  const [lang] = codeLang.split(' ');
  if (lang === 'python')
    return 'py';
  return lang;
}

module.exports = { parse, render, clone, visitAll, visit, generateToc, filterNodesForLanguage, codeLangToHighlighter };
