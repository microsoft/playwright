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

const Message = require('../Message');
const {firefox, webkit, chromium} = require('../../../');

module.exports.ensureReleasedAPILinks = function(sources, libversion) {
  // Release version is everything that doesn't include "-".
  const apiLinkRegex = /https:\/\/github.com\/microsoft\/playwright\/blob\/v[^/]*\/docs\/api.md/ig;
  const lastReleasedAPI = `https://github.com/microsoft/playwright/blob/v${libversion.split('-')[0]}/docs/api.md`;

  const messages = [];
  for (const source of sources) {
    const text = source.text();
    const newText = text.replace(apiLinkRegex, lastReleasedAPI);
    if (source.setText(newText))
      messages.push(Message.warning(`GEN: updated ${source.projectPath()}`));
  }
  return messages;
};

module.exports.runCommands = function(sources, {libversion, chromiumVersion, firefoxVersion}) {
  // Release version is everything that doesn't include "-".
  const isReleaseVersion = !libversion.includes('-');

  const messages = [];
  const commands = [];
  for (const source of sources) {
    const text = source.text();
    const commandStartRegex = /<!--\s*gen:([a-z-]+)\s*-->/ig;
    const commandEndRegex = /<!--\s*gen:stop\s*-->/ig;
    let start;

    while (start = commandStartRegex.exec(text)) { // eslint-disable-line no-cond-assign
      commandEndRegex.lastIndex = commandStartRegex.lastIndex;
      const end = commandEndRegex.exec(text);
      if (!end) {
        messages.push(Message.error(`Failed to find 'gen:stop' for command ${start[0]}`));
        return messages;
      }
      const name = start[1];
      const from = commandStartRegex.lastIndex;
      const to = end.index;
      const originalText = text.substring(from, to);
      commands.push({name, from, to, originalText, source});
      commandStartRegex.lastIndex = commandEndRegex.lastIndex;
    }
  }

  const changedSources = new Set();
  // Iterate commands in reverse order so that edits don't conflict.
  commands.sort((a, b) => b.from - a.from);
  for (const command of commands) {
    let newText = null;
    if (command.name === 'version')
      newText = isReleaseVersion ? 'v' + libversion : 'Tip-Of-Tree';
    else if (command.name === 'empty-if-release')
      newText = isReleaseVersion ? '' : command.originalText;
    else if (command.name === 'chromium-version-if-release')
      newText = isReleaseVersion ? chromiumVersion : command.originalText;
    else if (command.name === 'firefox-version-if-release')
      newText = isReleaseVersion ? firefoxVersion : command.originalText;
    else if (command.name === 'chromium-version-badge-if-release')
      newText = isReleaseVersion ? `[![Chromium version](https://img.shields.io/badge/chromium-${chromiumVersion}-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)` : command.originalText;
    else if (command.name === 'firefox-version-badge-if-release')
      newText = isReleaseVersion ? `[![Firefox version](https://img.shields.io/badge/firefox-${firefoxVersion}-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)` : command.originalText;
    else if (command.name === 'toc')
      newText = generateTableOfContents(command.source.text(), command.to, false /* topLevelOnly */);
    else if (command.name === 'toc-top-level')
      newText = generateTableOfContents(command.source.text(), command.to, true /* topLevelOnly */);
    else if (command.name.startsWith('toc-extends-'))
      newText = generateTableOfContentsForSuperclass(command.source.text(), 'class: ' + command.name.substring('toc-extends-'.length));
    if (newText === null)
      messages.push(Message.error(`Unknown command 'gen:${command.name}'`));
    else if (applyCommand(command, newText))
      changedSources.add(command.source);
  }
  for (const source of changedSources)
    messages.push(Message.warning(`GEN: updated ${source.projectPath()}`));
  return messages;
};

/**
 * @param {{name: string, from: number, to: number, source: !Source}} command
 * @param {string} editText
 * @return {boolean}
 */
function applyCommand(command, editText) {
  const text = command.source.text();
  const newText = text.substring(0, command.from) + editText + text.substring(command.to);
  return command.source.setText(newText);
}

function getTOCEntriesForText(text) {
  const ids = new Set();
  const titles = [];
  let insideCodeBlock = false;
  let offset = 0;
  text.split('\n').forEach((aLine, lineNumber) => {
    const line = aLine.trim();
    if (line.startsWith('```'))
      insideCodeBlock = !insideCodeBlock;
    else if (!insideCodeBlock && line.startsWith('#'))
      titles.push({line, offset: offset + lineNumber});
    offset += aLine.length;
  });
  let tocEntries = [];
  for (const {line, offset} of titles) {
    const [, nesting, name] = line.match(/^(#+)\s+(.*)$/);
    const delinkifiedName = name.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    const id = delinkifiedName.trim().toLowerCase().replace(/\s/g, '-').replace(/[^-0-9a-zа-яё]/ig, '');
    let dedupId = id;
    let counter = 0;
    while (ids.has(dedupId))
      dedupId = id + '-' + (++counter);
    ids.add(dedupId);
    tocEntries.push({
      level: nesting.length,
      name: delinkifiedName,
      id: dedupId,
      offset,
    });
  }
  return tocEntries;
}

function generateTableOfContents(text, offset, topLevelOnly) {
  const allTocEntries = getTOCEntriesForText(text);

  let tocEntries = [];
  let nesting = 0;
  for (const tocEntry of allTocEntries) {
    if (tocEntry.offset < offset)
      continue;
    if (tocEntries.length) {
      nesting += tocEntry.level - tocEntries[tocEntries.length - 1].level;
      if (nesting < 0)
        break;
    }
    tocEntries.push(tocEntry);
  }

  const minLevel = Math.min(...tocEntries.map(entry => entry.level));
  tocEntries.forEach(entry => entry.level -= minLevel);
  if (topLevelOnly)
    tocEntries = tocEntries.filter(entry => !entry.level);
  return '\n' + tocEntries.map(entry => {
    const prefix = entry.level % 2 === 0 ? '-' : '*';
    const padding = '  '.repeat(entry.level);
    return `${padding}${prefix} [${entry.name}](#${entry.id})`;
  }).join('\n') + '\n';
}

function generateTableOfContentsForSuperclass(text, name) {
  const allTocEntries = getTOCEntriesForText(text);

  for (const tocEntry of allTocEntries) {
    if (tocEntry.name !== name)
      continue;
    const offset = text.indexOf('<!-- GEN:stop -->', tocEntry.offset);
    return generateTableOfContents(text, offset, false);
  }
  return text;
}
