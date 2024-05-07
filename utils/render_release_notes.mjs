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

import path from 'path';
import fs from 'fs';

import { parseApi } from './doclint/api_parser.js';
import md, { visitAll } from './markdown.js';
import { renderPlaywrightDevLinks, docsLinkRendererForLanguage, languageToRelativeDocsPath } from './doclint/linkUtils.js';

const __dirname = new URL('.', import.meta.url).pathname;

const PROJECT_DIR = path.join(__dirname, '..');
const documentationRoot = path.join(PROJECT_DIR, 'docs', 'src');

const allowedLanguages = ['js', 'python', 'csharp', 'java'];
const [, , language, version] = process.argv;

if (!allowedLanguages.includes(language) || !version.match(/^\d+\.\d+$/))
  throw new Error(`Usage: node ${path.basename(process.argv[1])} <language> <version>\n\nWhere <version> is a version tag without v prefix, e.g. 1.45`);

let documentation = parseApi(path.join(documentationRoot, 'api'));
if (language === 'js') {
  documentation = documentation
      .mergeWith(parseApi(path.join(documentationRoot, 'test-api'), path.join(documentationRoot, 'api', 'params.md')))
      .mergeWith(parseApi(path.join(documentationRoot, 'test-reporter-api')));
}

documentation.setLinkRenderer(docsLinkRendererForLanguage(language, 'ReleaseNotesMd'));
const content = fs.readFileSync(path.join(documentationRoot, `release-notes-${language}.md`)).toString();
let nodes = md.parse(content);
documentation.renderLinksInNodes(nodes);

{
  // Reduce by one heading level
  visitAll(nodes, node => {
    if (node.type === 'h4')
      node.type = 'h3';
    else if (node.type === 'h3')
      node.type = 'h2';
    else if (node.type === 'h2')
      node.type = 'h1';
    else if (node.type === 'h1')
      node.type = 'h0';
  });
}

// Find the version heading and use it as a starting point in the output.
{
  let foundVersion = false;
  visitAll(nodes, node => {
    if (node.type === 'h1' && node.text === `Version ${version}`) {
      nodes = node.children;
      foundVersion = true;
    }
  });
  if (!foundVersion)
    throw new Error(`Could not find version ${version} in release notes.\nUsage: node ${path.basename(process.argv[1])} <language> <version>\n\nWhere <version> is a version tag without v prefix, e.g. 1.45`);
}

const output = renderPlaywrightDevLinks(md.render(nodes), languageToRelativeDocsPath(language), '');
process.stdout.write(output);
