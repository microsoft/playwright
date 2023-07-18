#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

// @ts-check

const fs = require('fs');
const url = require('url');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const COVERAGE_REPORT = path.join(ROOT, 'coverage-report');

const kIndexHtml = `
<body>
  <style>
    * {
      box-sizing: border-box;
      font-family: monospace;
      white-space: nowrap;
    }
  </style>
  <div class=list></div>
  <script>
    const ROOT = $$ROOT$$;
    const FILES = $$FILES$$;
    for (let i = 0; i < FILES.length; ++i) {
      const a = document.createElement('a');
      a.href = './' + i + '.html';
      a.textContent = FILES[i].substring(ROOT.length);
      a.style.display = 'block';
      document.querySelector('.list').appendChild(a);
    }
  </script>
</body>
`;

const kFileHtml = `
<body>
  <style>
    * {
      box-sizing: border-box;
      font-family: monospace;
      min-width: 0;
      min-height: 0;
    }
    .nowrap {
      white-space: nowrap;
    }

    .root {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    .header {
      flex: none;
      display: flex;
      flex-direction: row;
      align-items: baseline;
    }
    .title {
      font-size: larger;
      margin: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .filter-input {
      width: 400px;
    }

    .split {
      flex: 1 1 0;
      display: flex;
      flex-direction: row;
      position: relative;
    }
    .split.list-hidden .list {
      display: none;
    }

    .list {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      overflow: auto;
      flex: 0 0 500px;
      margin-right: 10px;
      border-right: 1px solid gray;
    }
    .list-item {
      display: flex;
      flex-direction: row;
      flex: 0 0 23px;
      align-items: center;
    }

    .content {
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      overflow: auto;
    }
    .spacer {
      height: 500px;
    }
    .line {
      display: flex;
      flex-direction: row;
      flex: none;
    }
    .line-number {
      flex: 0 0 40px;
    }
    .line-counter {
      flex: 0 0 100px;
    }
    .line-content > span {
      border-right: 1px solid gray;
      position: relative;
      white-space: pre;
    }
    .line-content > span:hover {
      background-color: rgb(0, 0, 0, 0.1);
    }
    .line-content > span > div.popover {
      display: none;
      position: absolute;
      top: 20px;
      left: 0;
      right: -1000px;
      background: white;
      border: 1px solid gray;
      z-index: 1;
      overflow: hidden;
    }
    .line-content > span:focus > div.popover {
      display: block;
    }
  </style>
  <div class=root>
    <div class=header>
      <button class=toggle-button>☰</button> <span class="title nowrap"></span> <input class=filter-input>
    </div>
    <div class="split list-hidden">
      <div class=list></div>
      <div class=content></div>
    </div>
  </div>
  <script>
    // File url of the source file.
    const FILEURL = $$FILEURL$$;
    // List of test titles. First title (index=0) is a fake empty one.
    const TITLES = $$TITLES$$;
    // List of coverage ranges, each range contains:
    // [rangeStartOffset, totalHitCountAcrossAllTests, ...encodedTitleIndiciesThatExecutedThisRange]
    // Where title indicies are compressed with something similar to RLE encoding:
    // - positive number X means that title X has executed this range;
    // - negative number Y followed by positive number Z mean that all titles [-Y...Z] have executed this range.
    const OFFSETS = $$OFFSETS$$;
    // Source file content.
    const SOURCE = $$SOURCE$$;

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.activeElement)
        document.activeElement.blur();
    });

    document.querySelector('.title').textContent = FILEURL;

    const filterInput = document.querySelector('.filter-input');
    filterInput.addEventListener('input', () => onFilterChange(filterInput.value));

    document.querySelector('.toggle-button').addEventListener('click', () => document.querySelector('.split').classList.toggle('list-hidden'));

    const sortedTitles = TITLES.map((_, i) => i).slice(1).sort((a, b) => TITLES[a].localeCompare(TITLES[b]));
    const items = [];
    for (const titleIndex of sortedTitles) {
      const item = document.createElement('div');
      item.className = 'list-item';
      const span = document.createElement('span');
      span.className = 'nowrap';
      span.textContent = TITLES[titleIndex];
      item.appendChild(span);
      document.querySelector('.list').appendChild(item);
      items.push({ item, titleIndex });
    }

    function onFilterChange(filter) {
      const titleSet = new Set();
      for (const { item, titleIndex } of items) {
        const title = TITLES[titleIndex];
        const visible = !filter || title.toLowerCase().includes(filter.toLowerCase());
        if (visible)
          titleSet.add(titleIndex);
        item.style.display = visible ? 'flex' : 'none';
      }
      renderContent(titleSet);
    }

    onFilterChange('');

    function renderContent(titleSet) {
      document.querySelector('.content').textContent = '';
      const lines = SOURCE.split('\\n');
      let offset = 0;
      let oi = 0;
      for (let index = 0; index < lines.length; index++) {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'line';

        const lineNumberDiv = document.createElement('div');
        lineNumberDiv.className = 'line-number';
        lineNumberDiv.textContent = index + 1;
        lineDiv.appendChild(lineNumberDiv);

        const lineCounterDiv = document.createElement('div');
        lineCounterDiv.className = 'line-counter';
        lineDiv.appendChild(lineCounterDiv);

        const lineContentDiv = document.createElement('div');
        lineContentDiv.className = 'line-content nowrap';
        lineDiv.appendChild(lineContentDiv);

        const line = lines[index];
        let i = 0;
        let minCoverage = Infinity;
        let maxCoverage = 0;

        while (line[i] === ' ')
          i++;
        // Whitespace indent at the start of the line is artificially merged with the
        // first reported coverage range on the line, to avoid useless red whitespace.
        let prefix = line.substring(0, i);

        while (i < line.length) {
          while (oi + 1 < OFFSETS.length && OFFSETS[oi + 1][0] <= offset + i)
            oi++;
          const next = oi + 1 < OFFSETS.length ? OFFSETS[oi + 1][0] : Infinity;
          const to = Math.min(next, offset + line.length);

          const span = document.createElement('span');
          span.tabIndex = 0;
          span.textContent = prefix + line.substring(i, to - offset);
          prefix = '';
          const popover = document.createElement('div');
          popover.className = 'popover';
          span.appendChild(popover);
          lineContentDiv.appendChild(span);

          let coveringTitles = [];
          for (let j = 2; j < OFFSETS[oi].length;) {
            if (OFFSETS[oi][j] < 0) {
              for (let k = -OFFSETS[oi][j]; k <= OFFSETS[oi][j + 1]; k++)
                coveringTitles.push(k);
              j += 2;
            } else {
              coveringTitles.push(OFFSETS[oi][j]);
              j++;
            }
          }
          coveringTitles = coveringTitles.filter(t => titleSet.has(t));
          const coverageValue = coveringTitles.length ? OFFSETS[oi][1] : 0;

          minCoverage = Math.min(minCoverage, coverageValue);
          maxCoverage = Math.max(maxCoverage, coverageValue);
          if (!coverageValue) {
            span.style.backgroundColor = 'rgba(255, 159, 159, 0.7)';
          } else {
            const ratio = Math.min(1, OFFSETS[oi][1] / (TITLES.length - 1));
            const bad = [192, 183, 86];
            const good = [146, 218, 65];
            const actual = [(bad[0] + (good[0] - bad[0]) * ratio) | 0, (bad[1] + (good[1] - bad[1]) * ratio) | 0, (bad[2] + (good[2] - bad[2]) * ratio) | 0];
            span.style.backgroundColor = 'rgba(' + actual[0] + ',' + actual[1] + ',' + actual[2] + ', 0.7)';
          }

          const popoverLines = coveringTitles.map(t => TITLES[t]);
          popover.innerHTML = 'Executed <b>by all tests</b>: <span style="font-size: larger">' + OFFSETS[oi][1] + '</span> time(s).<br>The following tests <b>from the filtered list</b> covered this code:<br><br>' + popoverLines.sort().join('<br>');
          i = to - offset;
        }
        offset += line.length + 1;

        if (minCoverage !== Infinity)
          lineCounterDiv.textContent = '(' + minCoverage + '-' + maxCoverage + ')';

        document.querySelector('.content').appendChild(lineDiv);
      }

      const spacer = document.createElement('div');
      spacer.className = 'spacer';
      document.querySelector('.content').appendChild(spacer);
    }
  </script>
</body>
`;

(async () => {
  const coverageDir = process.argv[2] || path.join(ROOT, 'test-results', 'coverage-data');
  const entries = fs.existsSync(coverageDir) ? fs.readdirSync(coverageDir, { withFileTypes: true }).filter(e => e.isFile()) : [];

  /** @type {Map<string, { fileUrl: string, offsets: Set<number>, rangesWithTitles: { title: number, ranges: Int32Array }[] }>} */
  const filesMap = new Map();
  const titlesMap = new Map([['', 0]]);
  const titlesList = [''];
  for (let entryIndex = 0; entryIndex < entries.length; ++entryIndex) {
    const entry = entries[entryIndex];
    console.log(`[${entryIndex + 1}/${entries.length}] Reading coverage file ${entry.name}`);
    const data = JSON.parse(fs.readFileSync(path.join(coverageDir, entry.name), 'utf-8'));
    for (const fileUrl of Object.keys(data.files)) {
      if (!filesMap.has(fileUrl))
        filesMap.set(fileUrl, { fileUrl, offsets: new Set(), rangesWithTitles: [] });
      const file = filesMap.get(fileUrl);
      if (!file)
        throw new Error('Internal error');
      let title = titlesMap.get(data.metadata.testTitle);
      if (title === undefined) {
        title = titlesList.length;
        titlesMap.set(data.metadata.testTitle, title);
        titlesList.push(data.metadata.testTitle);
      }
      const ranges = new Int32Array(data.files[fileUrl]);
      file.rangesWithTitles.push({ ranges, title });
      for (let i = 0; i < ranges.length; i += 2)
        file.offsets.add(ranges[i]);
    }
  }

  const filesList = [...filesMap.values()];
  fs.mkdirSync(COVERAGE_REPORT, { recursive: true });
  const indexFilePath = path.join(COVERAGE_REPORT, 'index.html');
  fs.writeFileSync(indexFilePath, kIndexHtml
    .replace('$$ROOT$$', () => JSON.stringify('file://' + ROOT))
    .replace('$$FILES$$', () => JSON.stringify(filesList.map(f => f.fileUrl))));

  for (let fileIndex = 0; fileIndex < filesList.length; fileIndex++) {
    const file = filesList[fileIndex];
    console.log(`[${fileIndex + 1}/${filesList.length}] Processing source file ` + file.fileUrl);
    const offsetsList = [...file.offsets].sort((a, b) => a - b);
    /** @type {number[][]} */
    const seenAt = [];
    /** @type {number[]} */
    const totals = [];
    for (const offset of offsetsList) {
      seenAt.push([]);
      totals.push(0);
    }
    const offsetsMap = new Map(offsetsList.map((o, i) => [o, i]));

    for (const { ranges, title } of file.rangesWithTitles) {
      for (let i = 0; i + 2 < ranges.length; i += 2) {
        if (!ranges[i + 1])
          continue;
        const start = offsetsMap.get(ranges[i]) || 0;
        const end = offsetsMap.get(ranges[i + 2]) || 0;
        for (let k = start; k < end; k++) {
          seenAt[k].push(title);
          totals[k] += ranges[i + 1];
        }
      }
    }

    /** @type {number[][]} - [offset, total, ...seenAtCompressed][] */
    const fileOffsets = [];
    for (let i = 0; i < offsetsList.length; i++) {
      const compressed = [offsetsList[i], totals[i]];
      const list = [...seenAt[i]].sort((a, b) => a - b);
      for (let j = 0; j < list.length;) {
        let k = j;
        while (list[k + 1] === list[k] + 1)
          k++;
        if (k == j)
          compressed.push(list[j]);
        else
          compressed.push(-list[j], list[k]);
        j = k + 1;
      }
      fileOffsets.push(compressed);
    }

    let source = '';
    try {
      source = fs.readFileSync(url.fileURLToPath(file.fileUrl), 'utf8');
    } catch (e) {
    }

    fs.writeFileSync(path.join(COVERAGE_REPORT, fileIndex + '.html'), kFileHtml
      .replace('$$FILEURL$$', () => jsonStringifyForceASCII(file.fileUrl.substring(('file://' + ROOT).length)))
      .replace('$$SOURCE$$', () => jsonStringifyForceASCII(source))
      .replace('$$TITLES$$', () => jsonStringifyForceASCII(titlesList))
      .replace('$$OFFSETS$$', () => JSON.stringify(fileOffsets)));
  }

  if (!process.env.CI)
    await require('../packages/playwright-core/lib/utilsBundle').open(path.relative(process.cwd(), indexFilePath));
})();

function jsonStringifyForceASCII(value) {
  return JSON.stringify(value).replace(
      /[\u007f-\uffff]/g,
      c => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
  );
}
