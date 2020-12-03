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
  let nodes;
  for (const node of parseMd(params)) {
    if (node.h2) {
      const name = node.h2;
      nodes = [];
      map.set(name, nodes);
      continue;
    }
    nodes.push(node);
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
    const nodes = map.get(key);
    if (!nodes)
      throw new Error(`Missing param "${key}"`);

    let snippet;
    if (line.endsWith('-as-is')) {
      snippet = nodes.map(node => renderMd(node)).join('\n');
    } else {
      const { name, type } = parseArgument(nodes[0].li);
      nodes[0].li = `\`${name}\` ${type}`;
      if (nodes[1])
        nodes[0].li += ` ${nodes[1].text}`;
      snippet = renderMd(nodes[0]);
    }
    for (const l of snippet.split('\n'))
      result.push(indent + l);
  }
  return result.join('\n');
}

function extractParamDescriptions(params) {
  let name;

  for (const node of parseMd(params)) {
    if (node.h2) {
      name = node.h2;
      continue;
    }
    extractParamDescription(name, node);
  }
}

function extractParamDescription(group, node) {
  const { name, type, text } = parseArgument(node.li);
  node.li = `\`${name}\` ${type}`;
  if (group === 'shared-context-params')
    group = `context-option-${name.toLowerCase()}`;
  console.log(`## ${group}`);
  console.log();
  console.log(renderMd(node));
  console.log();
  console.log(text);
  console.log();
}

function parseArgument(line) {
  const match = line.match(/`([^`]+)` (.*)/);
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

module.exports = { parseMd, renderMd, renderMdTemplate, extractParamDescriptions };
