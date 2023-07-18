/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

type V8SourceMapData = {
  lineLengths: number[],
  data: any,  // source map itself
};

type V8Range = { startOffset: number, endOffset: number, count: number };

type V8CoverageData = {
  result: {
    url: string,
    functions?: {
      ranges?: V8Range[],
    }[],
  }[],
  ['source-map-cache']?: Record<string, V8SourceMapData>,
};

// Points is a compressed way to represent a list of continuous ranges.
// Consider ranges in the form of [0..a0], [a0..a1], [a1..a2], ..., [a(N-1)...aN=<file-length>],
// with corresponding coverage values of c0, c1, ..., cN.
// Compressed "points" list range start and coverage value for each range:
// [0, c0, a0, c1, a1, c2, ...., a(N-1), cN, aN, 0]
type Points = Int32Array;

export class CoverageCollector {
  private _fileFilter: (fileUrl: string) => boolean;
  private _shouldIgnoreCache: { [key: string]: boolean } = {};
  private _processedCoverage = new Map<string, Points>();

  constructor(fileFilter: (fileUrl: string) => boolean) {
    this._fileFilter = fileFilter;
  }

  // This function is called for each source mapping range and takes a lot of time if not cached.
  private _shouldIgnore(fileUrl: string): boolean {
    let value = this._shouldIgnoreCache[fileUrl];
    if (value !== undefined)
      return value;
    value = !fileUrl.startsWith('file://') || !this._fileFilter(fileUrl);
    this._shouldIgnoreCache[fileUrl] = value;
    return value;
  }

  // Converts ranges in V8 coverage format to Points.
  // `takeMax` controls what value we should take when two ranges overlap:
  // - max value in the case of source map;
  // - or the value of the innermost range in the case of V8 coverage data.
  private _compressRangesToPoints(ranges: V8Range[], takeMax: boolean): Int32Array {
    const events: { offset: number, value: number, len: number, isStart: number }[] = [];
    for (const range of ranges) {
      const len = range.endOffset - range.startOffset;
      events.push({ offset: range.startOffset, value: range.count, len, isStart: 1 });
      events.push({ offset: range.endOffset, value: range.count, len, isStart: 0 });
    }

    // Sort by offset, all ends before starts, so that shortest interval starts last and ends first.
    events.sort((a, b) => {
      const delta = a.offset - b.offset;
      if (delta)
        return delta;
      if (a.isStart !== b.isStart)
        return a.isStart - b.isStart;
      if (a.isStart)
        return b.len - a.len;
      return a.len - b.len;
    });

    let lastOffset = 0;
    let lastValue = -1;
    const stack = [0];
    const result = [0];
    for (const event of events) {
      if (event.offset !== lastOffset) {
        // Handled all ranges startin/ending at lastOffset, now considering interval [lastOffset ... event.offset].
        lastOffset = event.offset;
        const current = takeMax ? Math.max(...stack) : stack[stack.length - 1];
        if (current !== lastValue) {
          // Push a new pair [<value for the last interval>, <next offset>] to the result.
          result.push(current, event.offset);
          lastValue = current;
        } else {
          // Same value as the last interval - we can compress points by making last interval longer,
          // effectively merging two consecutive intervals.
          result[result.length - 1] = event.offset;
        }
      }
      if (event.isStart)
        stack.push(event.value);
      else
        stack.pop();
    }
    result.push(0);
    return new Int32Array(result);
  }

  private _addCoverageFromTwoSources(points1: Points, points2: Points): Points {
    const result = [0];
    let lastValue = -1;
    let i = 2;
    let j = 2;
    while (i < points1.length || j < points2.length) {
      const offset = Math.min(points1[i] ?? Infinity, points2[j] ?? Infinity);
      const current = points1[i - 1] + points2[j - 1];
      if (current !== lastValue) {
        result.push(current, offset);
        lastValue = current;
      } else {
        result[result.length - 1] = offset;
      }
      if (points1[i] === offset)
        i += 2;
      if (points2[j] === offset)
        j += 2;
    }
    result.push(0);
    return new Int32Array(result);
  }

  private _generateLineOffsets(source: string): number[] {
    const result = [0];
    for (let i = 0; i < source.length;) {
      let nextLine = source.indexOf('\n', i);
      if (nextLine === -1)
        nextLine = source.length;
      result.push(nextLine + 1);
      i = nextLine + 1;
    }
    return result;
  }

  private async _applySourceMapToCoveragePoints(v8SourceMapData: V8SourceMapData, points: Points): Promise<Map<string, Points>> {
    const lineOffsets = [0];
    for (const lineLength of v8SourceMapData.lineLengths)
      lineOffsets.push(lineOffsets[lineOffsets.length - 1] + lineLength + 1);

    // Keyed by original source's fileUrl.
    const sourceData = new Map<string, {
      lineOffsets: number[],
      offsetSet: Set<number>,
      offsetMap: Map<number, number>,
      offsetList: number[],
      ranges: V8Range[],
    }>();
    // Mappings are generated in the order of increasing generatedOffset.
    const mappings: { generatedOffset: number, originalOffset: number, sourceName: string }[] = [];

    const consumer = await new SourceMapConsumer(v8SourceMapData.data);
    consumer.eachMapping(m => {
      if (this._shouldIgnore(m.source))
        return;
      if (!sourceData.has(m.source)) {
        const lineOffsets = this._generateLineOffsets(consumer.sourceContentFor(m.source) || '');
        // Add line endings to the offsetSet, so that mapped ranges in the original source are hard-capped by the line end.
        // This is consistent with how most tools like Babel generate source maps.
        sourceData.set(m.source, { lineOffsets, offsetSet: new Set(lineOffsets), offsetMap: new Map(), offsetList: [], ranges: [] });
      }
      const mapping = {
        generatedOffset: m.generatedColumn + lineOffsets[m.generatedLine - 1],
        originalOffset: m.originalColumn + (sourceData.get(m.source)!.lineOffsets[m.originalLine - 1] || 0),
        sourceName: m.source,
      };
      mappings.push(mapping);
      sourceData.get(m.source)!.offsetSet.add(mapping.originalOffset);
    });
    mappings.push({ generatedOffset: Infinity, originalOffset: Infinity, sourceName: '' });
    consumer.destroy();

    for (const data of sourceData.values()) {
      data.offsetList = [...data.offsetSet].sort((a, b) => a - b);
      data.offsetMap = new Map(data.offsetList.map((o, i) => [o, i]));
    }

    let currentMappingIndex = 0;
    for (let i = 0; i + 2 < points.length; i += 2) {
      // This iteration considers a coverage range in the generated file:
      // [points[i] ... points[i + 2]] with the coverage value of points[i + 1].

      // Skip mapping ending before next coverage range.
      while (mappings[currentMappingIndex + 1].generatedOffset <= points[i])
        currentMappingIndex++;

      while (mappings[currentMappingIndex].generatedOffset < points[i + 2]) {
        const source = sourceData.get(mappings[currentMappingIndex].sourceName)!;

        // Intersect the coverage range and the mapping range.
        const startGenerated = Math.max(points[i], mappings[currentMappingIndex].generatedOffset);
        const endGenerated = Math.min(points[i + 2], mappings[currentMappingIndex + 1].generatedOffset);

        // Calculate the corresponding range in the original source.
        const startOriginal = mappings[currentMappingIndex].originalOffset + startGenerated - mappings[currentMappingIndex].generatedOffset;
        const indexInOriginalMappings = source.offsetMap.get(mappings[currentMappingIndex].originalOffset) || 0;
        const nextOriginalMappedOffset = indexInOriginalMappings + 1 < source.offsetList.length ? source.offsetList[indexInOriginalMappings + 1] : Infinity;
        // Heuristic: consider the original range to be of the same length, but no longer than the whole mapped range.
        let endOriginal = Math.min(startOriginal + endGenerated - startGenerated, nextOriginalMappedOffset);
        // Heuristic: if the full mapping range is covered at the same coverage value,
        // consider the full original range covered with the same value. This takes care of original ranges
        // longer than corresponding generated ones. Some examples:
        // - minified code;
        // - TS-only constructs like `x as any`, `private _y` or `z: number`.
        if (startGenerated === mappings[currentMappingIndex].generatedOffset && endGenerated === mappings[currentMappingIndex + 1].generatedOffset)
          endOriginal = nextOriginalMappedOffset;
        if (startOriginal < endOriginal) {
          source.ranges.push({
            startOffset: startOriginal,
            endOffset: endOriginal,
            count: points[i + 1],
          });
        }
        // If current mapping range is not fully covered by the coverage range, we should intersect it
        // with the next coverage range again, so bail out.
        if (mappings[currentMappingIndex + 1].generatedOffset > points[i + 2])
          break;
        currentMappingIndex++;
      }
    }

    const result = new Map<string, Int32Array>();
    for (const [source, { ranges }] of sourceData)
      result.set(source, this._compressRangesToPoints(ranges, true /* takeMax */));
    return result;
  }

  async appendV8Coverage(data: V8CoverageData) {
    for (const entry of data.result) {
      if (this._shouldIgnore(entry.url))
        continue;
      const v8Ranges = (entry.functions || []).map(f => f.ranges || []).flat();
      const points = this._compressRangesToPoints(v8Ranges, false /* takeMax */);
      const sourceMap = data['source-map-cache']?.[entry.url];
      const pointsForFile = sourceMap ? await this._applySourceMapToCoveragePoints(sourceMap, points) : new Map([[entry.url, points]]);
      for (const [fileUrl, points] of pointsForFile) {
        const existing = this._processedCoverage.get(fileUrl);
        this._processedCoverage.set(fileUrl, existing ? this._addCoverageFromTwoSources(existing, points) : points);
      }
    }
  }

  async writeToFile(outputFile: string, metadata: any) {
    const files: Record<string, number[]> = {};
    for (const [fileUrl, points] of this._processedCoverage)
      files[fileUrl] = Array.from(points);
    await fs.promises.writeFile(outputFile, JSON.stringify({ metadata, files }));
  }
}
