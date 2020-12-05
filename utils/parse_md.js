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

const maxColumns = 120;

function normalizeLines(content) {
  const inLines = content.split('\n');
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

function buildTree(lines) {
  const root = {
    h0: '<root>',
    children: []
  };
  const stack = [root];
  let liStack = null;

  for (let i = 0; i < lines.length; ++i) {
    let line = lines[i];

    if (line.startsWith('```')) {
      const node = {
        code: [],
        codeLang: line.substring(3)
      };
      stack[0].children.push(node);
      line = lines[++i];
      while (!line.startsWith('```')) {
        node.code.push(line);
        line = lines[++i];
      }
      continue;
    }

    if (line.startsWith('<!-- GEN')) {
      const node = {
        gen: [line]
      };
      stack[0].children.push(node);
      line = lines[++i];
      while (!line.startsWith('<!-- GEN')) {
        node.gen.push(line);
        line = lines[++i];
      }
      node.gen.push(line);
      continue;
    }

    const header = line.match(/^(#+)/);
    if (header) {
      const node = { children: [] };
      const h = header[1].length;
      node['h' + h] = line.substring(h + 1);

      while (true) {
        const lastH = +Object.keys(stack[0]).find(k => k.startsWith('h')).substring(1);
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
    const node = {};
    if (list) {
      node.li = line.substring(list[0].length);
      if (line.trim().startsWith('1.'))
        node.liType = 'ordinal';
      else if (line.trim().startsWith('*'))
        node.liType = 'bullet';
      else 
        node.liType = 'default';
    } else {
      node.text = line;
    }
    if (!liStack[depth].children)
      liStack[depth].children = [];
    liStack[depth].children.push(node);
    liStack[depth + 1] = node;
  }
  return root.children;
}

function parseMd(content) {
  return buildTree(normalizeLines(content));
}

function renderMd(nodes) {
  const result = [];
  let lastNode;
  for (let node of nodes) {
    innerRenderMdNode(node, lastNode, result);
    lastNode = node;
  }
  return result.join('\n');
}

function renderMdNode(node, lastNode) {
  const result = [];
  innerRenderMdNode(node, lastNode, result);
  return result.join('\n');
}

function innerRenderMdNode(node, lastNode, result) {
  const newLine = () => {
    if (result[result.length - 1] !== '')
      result.push('');
  };

  for (let i = 1; i < 10; ++i) {
    if (node[`h${i}`]) {
      newLine();
      result.push(`${'#'.repeat(i)} ${node[`h${i}`]}`);
      let lastNode = node;
      for (const child of node.children) {
        innerRenderMdNode(child, lastNode, result);
        lastNode = child;
      }
      break;
    }
  }

  if (node.text) {
    const bothComments = node.text.startsWith('>') && lastNode && lastNode.text && lastNode.text.startsWith('>');
    if (!bothComments && lastNode && (lastNode.text || lastNode.li || lastNode.h1 || lastNode.h2 || lastNode.h3 || lastNode.h4))
      newLine();
      printText(node, result);
  }

  if (node.code) {
    newLine();
    result.push('```' + node.codeLang);
    for (const line of node.code)
      result.push(line);
    result.push('```');
    newLine();
  }

  if (node.gen) {
    newLine();
    for (const line of node.gen)
      result.push(line);
    newLine();
  }

  if (node.li) {
    const visit = (node, indent) => {
      let char;
      switch (node.liType) {
        case 'bullet': char = '*'; break;
        case 'default': char = '-'; break;
        case 'ordinal': char = '1.'; break;
      }
      result.push(`${indent}${char} ${node.li}`);
      for (const child of node.children || [])
        visit(child, indent + '  ');
    };
    visit(node, '');
  }
}

function printText(node, result) {
  let line = node.text;
  while (line.length > maxColumns) {
    let index = line.lastIndexOf(' ', maxColumns);
    if (index === -1) {
      index = line.indexOf(' ', maxColumns);
      if (index === -1)
        break;
    }
    result.push(line.substring(0, index));
    line = line.substring(index + 1);
  }
  if (line.length)
    result.push(line);
}

function parseArgument(line) {
  const match = line.match(/`([^`]+)` (.*)/);
  if (!match)
    throw new Error('Invalid argument: ' + line);
  const name = match[1];
  const remainder = match[2];
  if (!remainder.startsWith('<'))
    console.error('Bad argument:', remainder);
  let depth = 0;
  for (let i = 0; i < remainder.length; ++i) {
    const c = remainder.charAt(i);
    if (c === '<')
      ++depth;
    if (c === '>')
      --depth;
    if (depth === 0)
      return { name, type: remainder.substring(0, i + 1), text: remainder.substring(i + 2) };
  }
  throw new Error('Should not be reached');
}

module.exports = { parseMd, renderMd, parseArgument };
