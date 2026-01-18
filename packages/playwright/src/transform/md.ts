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

import fs from 'fs';
import path from 'path';

import { parseMarkdown } from '../utilsBundle';
import { genMapping } from './babelBundle';

import type * as mdast from 'mdast';
import type { EncodedSourceMap } from './babelBundle';

type Props = [string, Line][];
// source is 1-based
type Line = { text: string; source?: { filename: string; line: number; column: number } };
type Test = { title: Line, lines: Line[], props: Props };

export function transformMDToTS(code: string, filename: string): { code: string, map: EncodedSourceMap } {
  const parsed = parseSpec(code, filename);
  let fixtures = resolveFixtures(filename, parsed.props.find(prop => prop[0] === 'fixtures')?.[1]);
  const seed = parsed.props.find(prop => prop[0] === 'seed')?.[1];
  if (seed) {
    const seedFile = path.resolve(path.dirname(filename), seed.text);
    const seedContents = fs.readFileSync(seedFile, 'utf-8');
    const parsedSeed = parseSpec(seedContents, seedFile);
    if (parsedSeed.tests.length !== 1)
      throw new Error(`while parsing ${seedFile}: seed file must contain exactly one test`);
    if (parsedSeed.tests[0].props.length)
      throw new Error(`while parsing ${seedFile}: seed test must not have properties`);
    for (const test of parsed.tests)
      test.lines = parsedSeed.tests[0].lines.concat(test.lines);
    const seedFixtures = resolveFixtures(seedFile, parsedSeed.props.find(prop => prop[0] === 'fixtures')?.[1]);
    if (seedFixtures && fixtures)
      throw new Error(`while parsing ${filename}: either seed or test can specify fixtures, but not both`);
    fixtures ??= seedFixtures;
  }

  const map = new genMapping.GenMapping({});
  const lines: string[] = [];
  const addLine = (line: Line) => {
    lines.push(line.text);
    if (line.source) {
      genMapping.addMapping(map, {
        generated: { line: lines.length, column: 0 },
        source: line.source.filename,
        original: { line: line.source.line, column: line.source.column - 1 },
      });
    }
  };

  if (fixtures)
    addLine({ text: `import { test, expect } from ${escapeString(path.relative(path.dirname(filename), fixtures.text))};`, source: fixtures.source });
  else
    addLine({ text: `import { test, expect } from '@playwright/test';` });
  addLine({ text: `test.describe(${escapeString(parsed.describe.text)}, () => {`, source: parsed.describe.source });
  for (const test of parsed.tests) {
    const tags: string[] = [];
    const annotations: { type: string, description: string }[] = [];
    for (const [key, value] of test.props) {
      if (key === 'tag') {
        tags.push(...value.text.split(' ').map(s => s.trim()).filter(s => !!s));
      } else if (key === 'annotation') {
        if (!value.text.includes('='))
          throw new Error(`while parsing ${filename}: annotation must be in format "type=description", found "${value}"`);
        const [type, description] = value.text.split('=').map(s => s.trim());
        annotations.push({ type, description });
      }
    }
    let props = '';
    if (tags.length || annotations.length) {
      props = '{ ';
      if (tags.length)
        props += `tag: [${tags.map(tag => escapeString(tag)).join(', ')}], `;
      if (annotations.length)
        props += `annotation: [${annotations.map(a => `{ type: ${escapeString(a.type)}, description: ${escapeString(a.description)} }`).join(', ')}], `;
      props += '}, ';
    }
    // TODO: proper source mapping for props
    addLine({ text: `  test(${escapeString(test.title.text)}, ${props}async ({ page, agent }) => {`, source: test.title.source });
    for (const line of test.lines)
      addLine({ text: '    ' + line.text, source: line.source });
    addLine({ text: `  });`, source: test.title.source });
  }
  addLine({ text: `});`, source: parsed.describe.source });
  addLine({ text: `` });

  const encodedMap = genMapping.toEncodedMap(map);
  const result = lines.join('\n');
  return { code: result, map: encodedMap };
}

function resolveFixtures(filename: string, prop: Line | undefined): Line | undefined {
  if (!prop)
    return;
  return { text: path.resolve(path.dirname(filename), prop.text), source: prop.source };
}

function escapeString(s: string): string {
  return `'` + s.replace(/\n/g, ' ').replace(/'/g, `\\'`) + `'`;
}

function parsingError(filename: string, node: mdast.Node | undefined, message: string): Error {
  const position = node?.position?.start ? ` at ${node.position.start.line}:${node.position.start.column}` : '';
  return new Error(`while parsing ${filename}${position}: ${message}`);
}

function asText(filename: string, node: mdast.Parent, errorMessage: string, skipChild?: mdast.Node): Line {
  let children = node.children.filter(child => child !== skipChild);
  while (children.length === 1 && children[0].type === 'paragraph')
    children = children[0].children;
  if (children.length !== 1 || children[0].type !== 'text')
    throw parsingError(filename, node, errorMessage);
  return { text: children[0].value, source: node.position ? { filename, line: node.position.start.line, column: node.position.start.column } : undefined };
}

function parseSpec(content: string, filename: string): { describe: Line, tests: Test[], props: Props } {
  const root = parseMarkdown(content);
  const props: Props = [];

  const children = [...root.children];
  const describeNode = children[0];
  children.shift();
  if (describeNode?.type !== 'heading' || describeNode.depth !== 2)
    throw parsingError(filename, describeNode, `describe title must be ##`);
  const describe = asText(filename, describeNode, `describe title must be ##`);

  if (children[0]?.type === 'list') {
    parseProps(filename, children[0], props);
    children.shift();
  }

  const tests: Test[] = [];
  while (children.length) {
    let nextIndex = children.findIndex((n, i) => i > 0 && n.type === 'heading' && n.depth === 3);
    if (nextIndex === -1)
      nextIndex = children.length;
    const testNodes = children.splice(0, nextIndex);
    tests.push(parseTest(filename, testNodes));
  }

  return { describe, tests, props };
}

function parseProp(filename: string, node: mdast.ListItem, props: Props) {
  const propText = asText(filename, node, `property must be a list item without children`);
  const match = propText.text.match(/^([^:]+):(.*)$/);
  if (!match)
    throw parsingError(filename, node, `property must be in format "key: value"`);
  props.push([match[1].trim(), { text: match[2].trim(), source: propText.source }]);
}

function parseProps(filename: string, node: mdast.List, props: Props) {
  for (const prop of node.children || []) {
    if (prop.type !== 'listItem')
      throw parsingError(filename, prop, `property must be a list item without children`);
    parseProp(filename, prop, props);
  }
}

function parseTest(filename: string, nodes: mdast.Node[]): Test {
  const titleNode = nodes[0] as mdast.Heading;
  nodes.shift();
  if (titleNode.type !== 'heading' || titleNode.depth !== 3)
    throw parsingError(filename, titleNode, `test title must be ###`);
  const title = asText(filename, titleNode, `test title must be ###`);

  const props: Props = [];
  let handlingProps = true;

  const lines: Line[] = [];
  const visit = (node: mdast.Node, indent: string) => {
    if (node.type === 'list') {
      for (const child of (node as mdast.List).children)
        visit(child, indent);
      return;
    }
    if (node.type === 'listItem') {
      const listItem = node as mdast.ListItem;
      const lastChild = listItem.children[listItem.children.length - 1];
      if (lastChild?.type === 'code') {
        handlingProps = false;
        const { text, source } = asText(filename, listItem, `code step must be a list item with a single code block`, lastChild);
        lines.push({ text: `${indent}await test.step(${escapeString(text)}, async () => {`, source });
        for (const [index, code] of lastChild.value.split('\n').entries())
          lines.push({ text: indent + '  ' + code, source: lastChild.position ? { filename: filename, line: lastChild.position.start.line + 1 + index, column: lastChild.position.start.column } : undefined });
        lines.push({ text: `${indent}});`, source });
      } else {
        const { text, source } = asText(filename, listItem, `step must contain a single instruction`, lastChild?.type === 'list' ? lastChild : undefined);
        let isGroup = false;
        if (handlingProps && lastChild?.type !== 'list' && ['tag:', 'annotation:'].some(prefix => text.startsWith(prefix))) {
          parseProp(filename, listItem, props);
        } else if (text.startsWith('group:')) {
          isGroup = true;
          lines.push({ text: `${indent}await test.step(${escapeString(text.substring('group:'.length).trim())}, async () => {`, source });
        } else if (text.startsWith('expect:')) {
          handlingProps = false;
          const assertion = text.substring('expect:'.length).trim();
          lines.push({ text: `${indent}await agent.expect(${escapeString(assertion)});`, source });
        } else if (!text.startsWith('//')) {
          handlingProps = false;
          lines.push({ text: `${indent}await agent.perform(${escapeString(text)});`, source });
        }
        if (lastChild?.type === 'list')
          visit(lastChild, indent + (isGroup ? '  ' : ''));
        if (isGroup)
          lines.push({ text: `${indent}});`, source });
      }
    } else {
      throw parsingError(filename, node, `test step must be a markdown list item`);
    }
  };

  for (const node of nodes)
    visit(node, '');
  return { title, lines, props };
}
