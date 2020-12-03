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
      || line.trim().startsWith('[')
      || singleLineExpression;
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      flushParagraph = true;
    }
    if (flushParagraph && outLineTokens.length) {
      outLines.push(outLineTokens.join(' '));
      outLineTokens = [];
    }
    if (inCodeBlock || singleLineExpression)
      outLines.push(line);
    else if (line.trim())
      outLineTokens.push(line);
  }
  if (outLineTokens.length)
    outLines.push(outLineTokens.join(' '));
  return outLines;
}

function buildTree(lines) {
  const root = {
    ul: []
  };
  const stack = [root];
  for (let i = 0; i < lines.length; ++i) {
    let line = lines[i];

    if (line.startsWith('```')) {
      const node = {
        code: []
      };
      root.ul.push(node);
      line = lines[++i];
      while (!line.startsWith('```')) {
        node.code.push(line);
        line = lines[++i];
      }
      continue;
    }

    if (line.startsWith('<!-- GEN')) {
      const node = {
        gen: []
      };
      root.ul.push(node);
      line = lines[++i];
      while (!line.startsWith('<!-- GEN')) {
        node.gen.push(line);
        line = lines[++i];
      }
      continue;
    }

    const header = line.match(/^(#+)/);
    if (header) {
      const node = {};
      node['h' + header[1].length] = line.substring(header[1].length + 1);
      root.ul.push(node);
      continue;
    }

    const list = line.match(/^(\s*)(-|1.) /);
    const depth = list ? (list[1].length / 2) : 0;
    const node = {};
    if (list) {
      node.li = line.substring(list[0].length);
      node.liType = line.trim().startsWith('1.') ? 'ordinals' : 'default';
    } else {
      node.text = line;
    }
    if (!stack[depth].ul)
      stack[depth].ul = [];
    stack[depth].ul.push(node);
    stack[depth + 1] = node;
  }
  return root.ul;
}

function parseMd(content) {
  return buildTree(normalizeLines(content));
}

function renderMd(node) {
  const result = [];
  const visit = (node, indent, result) => {
    result.push(`${indent}- ${node.li}`);
    for (const child of node.ul || [])
      visit(child, indent + '  ', result);
  };
  visit(node, '', result);
  return result.join('\n');
}

function renderMdTemplate(body, params) {
  const map = new Map();
  let chunks = [];
  for (const node of parseMd(params)) {
    if (node.h2) {
      const name = node.h2;
      chunks = [];
      map.set(name, chunks);
      continue;
    }
    chunks.push(renderMd(node));
  }
  const result = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^(\s*)- %%-(.*)-%%/);
    if (!match) {
      result.push(line);
      continue;
    }
    const indent = match[1];
    const key = match[2];
    const chunks = map.get(key);
    if (!chunks)
      throw new Error(`Missing param "${key}"`);
    const snippet = chunks.join('\n');
    for (const l of snippet.split('\n'))
      result.push(indent + l);
  }
  return result.join('\n');
}

module.exports = { parseMd, renderMd, renderMdTemplate };
