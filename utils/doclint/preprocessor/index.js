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

const path = require('path');
const Message = require('../Message');

function runCommands(sources, {libversion, chromiumVersion, firefoxVersion, onlyBrowserVersions}) {
  // Release version is everything that doesn't include "-".
  const isReleaseVersion = !libversion.includes('-');

  const messages = [];
  for (const source of sources) {
    const text = source.text();
    const commandStartRegex = /<!--\s*gen:([a-z-]+)\s*-->/ig;
    const commandEndRegex = /<!--\s*gen:stop\s*-->/ig;
    let start;

    const sourceEdits = new SourceEdits(source);
    // Extract all commands from source
    while (start = commandStartRegex.exec(text)) { // eslint-disable-line no-cond-assign
      commandEndRegex.lastIndex = commandStartRegex.lastIndex;
      const end = commandEndRegex.exec(text);
      if (!end) {
        messages.push(Message.error(`Failed to find 'gen:stop' for command ${start[0]}`));
        return messages;
      }
      const commandName = start[1];
      const from = commandStartRegex.lastIndex;
      const to = end.index;
      commandStartRegex.lastIndex = commandEndRegex.lastIndex;

      let newText = null;
      if (commandName === 'chromium-version')
        newText = chromiumVersion;
      else if (commandName === 'firefox-version')
        newText = firefoxVersion;
      else if (commandName === 'chromium-version-badge')
        newText = `[![Chromium version](https://img.shields.io/badge/chromium-${chromiumVersion}-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)`;
      else if (commandName === 'firefox-version-badge')
        newText = `[![Firefox version](https://img.shields.io/badge/firefox-${firefoxVersion}-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)`;
      else if (onlyBrowserVersions)
        continue;
      else if (commandName === 'version')
        newText = isReleaseVersion ? 'v' + libversion : 'Tip-Of-Tree';
      else if (commandName === 'toc')
        newText = generateTableOfContents(source.text(), to, false /* topLevelOnly */);
      else if (commandName === 'toc-top-level')
        newText = generateTableOfContents(source.text(), to, true /* topLevelOnly */);
      else if (commandName.startsWith('toc-extends-'))
        newText = generateTableOfContentsForSuperclass(source.text(), 'class: ' + commandName.substring('toc-extends-'.length));

      if (newText === null)
        messages.push(Message.error(`Unknown command 'gen:${commandName}'`));
      else
        sourceEdits.edit(from, to, newText);
    }
    sourceEdits.commit(messages);
  }
  return messages;
};

function getTOCEntriesForText(text) {
  const ids = new Set();
  const titles = [];
  const titleRegex = /^(#+)\s+(.*)$/;
  let insideCodeBlock = false;
  let offset = 0;
  text.split('\n').forEach((aLine, lineNumber) => {
    const line = aLine.trim();
    if (line.startsWith('```'))
      insideCodeBlock = !insideCodeBlock;
    else if (!insideCodeBlock && line.match(titleRegex))
      titles.push({line, offset: offset + lineNumber});
    offset += aLine.length;
  });
  let tocEntries = [];
  for (const {line, offset} of titles) {
    const [, nesting, name] = line.match(titleRegex);
    const delinkifiedName = name.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    const id = delinkifiedName.trim().toLowerCase().replace(/\s/g, '-').replace(/[^-_0-9a-zа-яё]/ig, '');
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

/**
 * @param {string} text
 */
function autocorrectInvalidLinks(projectRoot, sources, allowedFilePaths) {
  const pathToHashLinks = new Map();
  for (const source of sources) {
    const text = source.text();
    const hashLinks = new Set(getTOCEntriesForText(text).map(entry => entry.id));
    pathToHashLinks.set(source.filePath(), hashLinks);
  }

  const messages = [];
  for (const source of sources) {
    const allRelativePaths = [];
    for (const filepath of allowedFilePaths) {
      allRelativePaths.push('/' + path.relative(projectRoot, filepath));
      allRelativePaths.push(path.relative(path.dirname(source.filePath()), filepath));
    }
    const sourceEdits = new SourceEdits(source);
    let offset = 0;
    const edits = [];

    const lines = source.text().split('\n');
    lines.forEach((line, lineNumber) => {
      const linkRegex = /\]\(([^\)]*)\)/gm;
      let match;
      while (match = linkRegex.exec(line)) {
        const hrefOffset = offset + lineNumber + match.index + 2; // +2 since we have to skip ](
        const [, href] = match;
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))
          continue;
        const [relativePath, hash] = href.split('#');
        const hashOffset = hrefOffset + relativePath.length + 1;

        let resolvedPath = resolveLinkPath(source, relativePath);
        let hashLinks = pathToHashLinks.get(resolvedPath);

        if (!hashLinks) {
          // Attempt to autocorrect
          const newRelativePath = autocorrectText(relativePath, allRelativePaths);
          if (!newRelativePath) {
            messages.push(Message.error(`Bad link in ${source.projectPath()}:${lineNumber + 1}: file ${relativePath} does not exist`));
            continue;
          }
          resolvedPath = resolveLinkPath(source, newRelativePath);
          hashLinks = pathToHashLinks.get(resolvedPath);
          sourceEdits.edit(hrefOffset, hrefOffset + relativePath.length, newRelativePath);
        }

        if (!hash || hashLinks.has(hash))
          continue;

        const newHashLink = autocorrectText(hash, [...hashLinks]);
        if (newHashLink) {
          sourceEdits.edit(hashOffset, hashOffset + hash.length, newHashLink);
        } else {
          messages.push(Message.error(`Bad link in ${source.projectPath()}:${lineNumber + 1}: hash "#${hash}" does not exist in "${path.relative(projectRoot, resolvedPath)}"`));
        }
      }
      offset += line.length;
    });

    sourceEdits.commit(messages);
  }
  return messages;

  function resolveLinkPath(source, relativePath) {
    if (!relativePath)
      return source.filePath();
    if (relativePath.startsWith('/'))
      return path.resolve(projectRoot, '.' + relativePath);
    return path.resolve(path.dirname(source.filePath()), relativePath);
  }
}

class SourceEdits {
  constructor(source) {
    this._source = source;
    this._edits = [];
  }

  edit(from, to, newText) {
    this._edits.push({from, to, newText});
  }

  commit(messages = []) {
    if (!this._edits.length)
      return;
    this._edits.sort((a, b) => a.from - b.from);
    for (const edit of this._edits) {
      if (edit.from > edit.to) {
        messages.push(Message.error('INTERNAL ERROR: incorrect edit!'));
        return;
      }
    }
    for (let i = 0; i < this._edits.length - 1; ++i) {
      if (this._edits[i].to > this._edits[i + 1].from) {
        messages.push(Message.error('INTERNAL ERROR: edits are overlapping!'));
        return;
      }
    }
    this._edits.reverse();
    let text = this._source.text();
    for (const edit of this._edits)
      text = text.substring(0, edit.from) + edit.newText + text.substring(edit.to);
    this._source.setText(text);
  }
}

function autocorrectText(text, options, maxCorrectionsRatio = 0.5) {
  if (!options.length)
    return null;
  const scores = options.map(option => ({option, score: levenshteinDistance(text, option)}));
  scores.sort((a, b) => a.score - b.score);
  if (scores[0].score > text.length * maxCorrectionsRatio)
    return null;
  return scores[0].option;
}

function levenshteinDistance(a, b) {
  const N = a.length, M = b.length;
  const d = new Int32Array(N * M);
  for (let i = 0; i < N * M; ++i)
    d[i] = 0;
  for (let j = 0; j < M; ++j)
    d[j] = j;
  for (let i = 0; i < N; ++i)
    d[i * M] = i;
  for (let i = 1; i < N; ++i) {
    for (let j = 1; j < M; ++j) {
      const cost = a[i] === b[j] ? 0 : 1;
      d[i * M + j] = Math.min(
        d[(i - 1) * M + j] + 1, // d[i-1][j] + 1
        d[i * M + j - 1] + 1, // d[i][j - 1] + 1
        d[(i - 1) * M + j - 1] + cost // d[i - 1][j - 1] + cost
      );
    }
  }
  return d[N * M - 1];
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

module.exports = {autocorrectInvalidLinks, runCommands};
