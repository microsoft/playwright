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
const Source = require('./Source');
const md = require('../markdown');
const { spawnSync } = require('child_process');
const preprocessor = require('./preprocessor');
const { MDOutline } = require('./MDBuilder');
const missingDocs = require('./missingDocs');
const Documentation = require('./Documentation');

/** @typedef {import('./Documentation').Type} Type */
/** @typedef {import('../markdown').MarkdownNode} MarkdownNode */

const PROJECT_DIR = path.join(__dirname, '..', '..');
const VERSION = require(path.join(PROJECT_DIR, 'package.json')).version;

const RED_COLOR = '\x1b[31m';
const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

const links = new Map();
const rLinks = new Map();

run().catch(e => {
  console.error(e);
  process.exit(1);
});;

async function run() {
  const startTime = Date.now();

  /** @type {!Array<string>} */
  const errors = [];
  let changedFiles = false;

  const header = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-header.md')).toString();
  let footer = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-footer.md')).toString();
  const links = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-links.md')).toString();
  const outline = new MDOutline(path.join(PROJECT_DIR, 'docs-src', 'api-body.md'), path.join(PROJECT_DIR, 'docs-src', 'api-params.md'));
  const generatedComment = '<!-- THIS FILE IS NOW GENERATED -->';
  let generatedLinksSuffix;
  const api = await Source.readFile(path.join(PROJECT_DIR, 'docs', 'api.md'));
  const docs = await (await Source.readdir(path.join(PROJECT_DIR, 'docs'), '.md')).filter(s => s.name() !== 'api.md');

  // Produce api.md
  {
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

    {
      const localLinks = [];
      for (const clazz of outline.classesArray)
        localLinks.push(`[${clazz.name}]: api.md#class-${clazz.name.toLowerCase()} "${clazz.name}"`);
      generatedLinksSuffix = localLinks.join('\n') + '\n' + links;
    }

    {
      /** @type {MarkdownNode[]} */
      const result = [];
      for (const clazz of outline.classesArray) {
        // Iterate over classes, create header node.
        /** @type {MarkdownNode} */
        const classNode = { type: 'h3', text: `class: ${clazz.name}` };
        result.push(classNode);
        // Append class comments
        classNode.children = (clazz.spec || []).map(c => md.clone(c));
        classNode.children.push({
          type: 'text',
          text: ''
        });
        classNode.children.push(...generateToc(clazz));
        if (clazz.extends && clazz.extends !== 'EventEmitter' && clazz.extends !== 'Error') {
          const superClass = outline.documentation.classes.get(clazz.extends);
          classNode.children.push(...generateToc(superClass));
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
          classNode.children.push(memberNode);
        }
      }
      footer = outline.renderLinksInText(footer);
      api.setText([generatedComment, header, md.render(result), footer, generatedLinksSuffix].join('\n'));
    }
  }

  // Produce other docs
  {
    for (const doc of docs) {
      if (!fs.existsSync(path.join(PROJECT_DIR, 'docs-src', doc.name())))
        continue;
      const content = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', doc.name())).toString();
      doc.setText([generatedComment, outline.renderLinksInText(content), generatedLinksSuffix].join('\n'));
    }
  }

  // Documentation checks.
  {
    const readme = await Source.readFile(path.join(PROJECT_DIR, 'README.md'));
    const binReadme = await Source.readFile(path.join(PROJECT_DIR, 'bin', 'README.md'));
    const contributing = await Source.readFile(path.join(PROJECT_DIR, 'CONTRIBUTING.md'));
    const mdSources = [readme, binReadme, api, contributing, ...docs];

    const browserVersions = await getBrowserVersions();
    errors.push(...(await preprocessor.runCommands(mdSources, {
      libversion: VERSION,
      chromiumVersion: browserVersions.chromium,
      firefoxVersion: browserVersions.firefox,
      webkitVersion: browserVersions.webkit,
    })));

    errors.push(...preprocessor.findInvalidLinks(PROJECT_DIR, mdSources, getRepositoryFiles()));
    const jsSources = await Source.readdir(path.join(PROJECT_DIR, 'src', 'client'), '', []);
    errors.push(...missingDocs(outline, jsSources, path.join(PROJECT_DIR, 'src', 'client', 'api.ts')));

    for (const source of mdSources) {
      if (!source.hasUpdatedText())
        continue;
      await source.save();
      changedFiles = true;
    }
  }

  // Report results.
  if (errors.length) {
    for (let i = 0; i < errors.length; ++i) {
      const error = errors[i].split('\n').join('\n      ');
      console.log(`  ${i + 1}) ${RED_COLOR}${error}${RESET_COLOR}`);
    }
  }
  let clearExit = errors.length === 0;
  if (changedFiles) {
    if (clearExit)
      console.log(`${YELLOW_COLOR}Some files were updated.${RESET_COLOR}`);
    clearExit = false;
  }
  console.log(`${errors.length} failures.`);
  const runningTime = Date.now() - startTime;
  console.log(`DocLint Finished in ${runningTime / 1000} seconds`);
  process.exit(clearExit ? 0 : 1);
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

function getRepositoryFiles() {
  const out = spawnSync('git', ['ls-files'], {cwd: PROJECT_DIR});
  const files = out.stdout.toString().trim().split('\n').filter(f => !f.startsWith('docs-src'));
  return files.map(file => path.join(PROJECT_DIR, file));
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
  const file = `./api.md`;
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
function generateToc(clazz) {
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
