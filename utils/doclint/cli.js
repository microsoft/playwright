#!/usr/bin/env node
/**
 * Copyright 2017 Google Inc. All rights reserved.
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

//@ts-check

const playwright = require('../../');
const fs = require('fs');
const path = require('path');
const md = require('../markdown');
const { MDOutline } = require('./MDBuilder');
const Documentation = require('./Documentation');
const missingDocs = require('./missingDocs');

/** @typedef {import('./Documentation').Type} Type */
/** @typedef {import('../markdown').MarkdownNode} MarkdownNode */

const PROJECT_DIR = path.join(__dirname, '..', '..');

const links = new Map();
const rLinks = new Map();
const dirtyFiles = new Set();

run().catch(e => {
  console.error(e);
  process.exit(1);
});;

async function run() {
  const outline = new MDOutline(path.join(PROJECT_DIR, 'docs-src', 'api-body.md'), path.join(PROJECT_DIR, 'docs-src', 'api-params.md'));
  outline.setLinkRenderer(item => {
    const { clazz, member, param, option } = item;
    if (param)
      return `\`${param}\``;
    if (option)
      return `\`${option}\``;
    if (clazz)
      return `[${clazz.name}]`;
    return createMemberLink(member);
  });

  let generatedLinksSuffix;
  {
    const links = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'links.md')).toString();
    const localLinks = [];
    for (const clazz of outline.classesArray)
      localLinks.push(`[${clazz.name}]: api/class-${clazz.name.toLowerCase()}.md "${clazz.name}"`);
    generatedLinksSuffix = localLinks.join('\n') + '\n' + links;
  }

  // Produce api.md
  {
    for (const clazz of outline.classesArray) {
      /** @type {MarkdownNode[]} */
      const result = [];
      result.push({
        type: 'text',
        text: `---
id: class-${clazz.name.toLowerCase()}
title: "class: ${clazz.name}"
---
`});
      result.push(...(clazz.spec || []).map(c => md.clone(c)));
      result.push({
        type: 'text',
        text: ''
      });
      result.push(...generateClassToc(clazz));
      if (clazz.extends && clazz.extends !== 'EventEmitter' && clazz.extends !== 'Error') {
        const superClass = outline.documentation.classes.get(clazz.extends);
        result.push(...generateClassToc(superClass));
      }

      for (const member of clazz.membersArray) {
        // Iterate members
        /** @type {MarkdownNode} */
        const memberNode = { type: 'h4', children: [] };
        if (member.kind === 'event') {
          memberNode.text = `${clazz.varName}.on('${member.name}')`;
        } else if (member.kind === 'property') {
          memberNode.text = `${clazz.varName}.${member.name}`;
        } else if (member.kind === 'method') {
          // Patch method signatures
          memberNode.text = `${clazz.varName}.${member.name}(${member.signature})`;
          for (const arg of member.argsArray) {
            if (arg.type)
              memberNode.children.push(renderProperty(`\`${arg.name}\``, arg.type, arg.spec));
          }
        }

        // Append type
        if (member.type && member.type.name !== 'void') {
          let name;
          switch (member.kind) {
            case 'event': name = 'type:'; break;
            case 'property': name = 'type:'; break;
            case 'method': name = 'returns:'; break;
          }
          memberNode.children.push(renderProperty(name, member.type));
        }

        // Append member doc
        memberNode.children.push(...(member.spec || []).map(c => md.clone(c)));
        result.push(memberNode);
      }
      writeAssumeNoop(path.join(PROJECT_DIR, 'docs', `class-${clazz.name.toLowerCase()}.md`), [md.render(result), generatedLinksSuffix].join('\n'), dirtyFiles);
    }
  }

  // Produce other docs
  {
    for (const name of fs.readdirSync(path.join(PROJECT_DIR, 'docs-src'))) {
      if (name === 'links.md' || name.startsWith('api-'))
        continue;
      const content = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', name)).toString();
      const nodes = md.parse(content);
      outline.renderLinksInText(nodes);
      for (const node of nodes) {
        if (node.text === '<!-- TOC -->')
          node.text = md.generateToc(nodes);
      }
      writeAssumeNoop(path.join(PROJECT_DIR, 'docs', name), [md.render(nodes), generatedLinksSuffix].join('\n'), dirtyFiles);
    }
  }

  // Patch README.md
  {
    const versions = await getBrowserVersions();
    const params = new Map();
    const { chromium, firefox, webkit } = versions;
    params.set('chromium-version', chromium);
    params.set('firefox-version', firefox);
    params.set('webkit-version', webkit);
    params.set('chromium-version-badge', `[![Chromium version](https://img.shields.io/badge/chromium-${chromium}-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)`);
    params.set('firefox-version-badge', `[![Firefox version](https://img.shields.io/badge/firefox-${firefox}-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)`);
    params.set('webkit-version-badge', `[![WebKit version](https://img.shields.io/badge/webkit-${webkit}-blue.svg?logo=safari)](https://webkit.org/)`);

    let content = fs.readFileSync(path.join(PROJECT_DIR, 'README.md')).toString();
    content = content.replace(/<!-- GEN:([^ ]+) -->([^<]*)<!-- GEN:stop -->/ig, (match, p1) => {
      if (!params.has(p1)) {
        console.log(`ERROR: Invalid generate parameter "${p1}" in "${match}"`);
        process.exit(1);
      }
      return `<!-- GEN:${p1} -->${params.get(p1)}<!-- GEN:stop -->`;
    });
    writeAssumeNoop(path.join(PROJECT_DIR, 'README.md'), content, dirtyFiles);
  }

  // Check for missing docs
  {
    const srcClient = path.join(PROJECT_DIR, 'src', 'client');
    const sources = fs.readdirSync(srcClient).map(n => path.join(srcClient, n));
    const errors = missingDocs(outline, sources, path.join(srcClient, 'api.ts'));
    if (errors.length) {
      console.log('============================');
      console.log('ERROR: missing documentation:');
      errors.forEach(e => console.log(e));
      console.log('============================')
      process.exit(1);
    }
  }

  if (dirtyFiles.size) {
    console.log('============================')
    console.log('ERROR: generated markdown files have changed, this is only error if happens in CI:');
    [...dirtyFiles].forEach(f => console.log(f));
    console.log('============================')
    process.exit(1);
  }
  process.exit(0);
}

/**
 * @param {string} name
 * @param {string} content
 * @param {Set<string>} dirtyFiles
 */
function writeAssumeNoop(name, content, dirtyFiles) {
  const oldContent = fs.readFileSync(name).toString();
  if (oldContent !== content) {
    fs.writeFileSync(name, content);
    dirtyFiles.add(name);
  }
}

async function getBrowserVersions() {
  const names = ['chromium', 'firefox', 'webkit'];
  const browsers = await Promise.all(names.map(name => playwright[name].launch()));
  const result = {};
  for (let i = 0; i < names.length; i++) {
    result[names[i]] = browsers[i].version();
  }
  await Promise.all(browsers.map(browser => browser.close()));
  return result;
}

/**
 * @param {string} file
 * @param {string} text
 */
function createLink(file, text) {
  const key = file + '#' + text;
  if (links.has(key))
    return links.get(key);
  const baseLink = file + '#' + text.toLowerCase().split(',').map(c => c.replace(/[^a-z]/g, '')).join('-');
  let link = baseLink;
  let index = 0;
  while (rLinks.has(link))
    link = baseLink + '-' + (++index);
  const result = `[${text}](${link})`;
  links.set(key, result);
  rLinks.set(link, text);
  return result;
};

/**
 * @param {Documentation.Member} member
 * @return {string}
 */
function createMemberLink(member) {
  const file = `api/class-${member.clazz.name.toLowerCase()}.md`;
  if (member.kind === 'property')
    return createLink(file, `${member.clazz.varName}.${member.name}`);

  if (member.kind === 'event')
    return createLink(file, `${member.clazz.varName}.on('${member.name}')`);

  if (member.kind === 'method')
    return createLink(file, `${member.clazz.varName}.${member.name}(${member.signature})`);
}

/**
 * @param {Documentation.Class} clazz
 * @return {MarkdownNode[]}
 */
function generateClassToc(clazz) {
  /** @type {MarkdownNode[]} */
  const result = [];
  for (const member of clazz.membersArray) {
    result.push({
      type: 'li',
      liType: 'default',
      text: createMemberLink(member)
    });
  }
  return result;
}

/**
 * @param {string} name
 * @param {Type} type
 * @param {MarkdownNode[]} [spec]
 */
function renderProperty(name, type, spec) {
  let comment = '';
  if (spec && spec.length)
    comment = spec[0].text;
  let children;
  if (type.properties && type.properties.length)
    children = type.properties.map(p => renderProperty(`\`${p.name}\``, p.type, p.spec))
  else if (spec && spec.length > 1)
    children = spec.slice(1).map(s => md.clone(s));

  /** @type {MarkdownNode} */
  const result = {
    type: 'li',
    liType: 'default',
    text: `${name} <${renderType(type.name)}>${comment ? ' ' + comment : ''}`,
    children
  };
  return result;
}

/**
 * @param {string} type
 */
function renderType(type) {
  if (type.includes('"'))
    return type.replace(/,/g, '|').replace(/Array/, "[Array]").replace(/null/, "[null]").replace(/number/, "[number]");
  const result = type.replace(/([\w]+)/g, '[$1]');
  if (result === '[Promise]<[void]>')
    return '[Promise]';
  return result.replace(/[(]/g, '\\(').replace(/[)]/g, '\\)');
}
