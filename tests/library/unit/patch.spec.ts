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


import { test as it, expect } from '@playwright/test';
import { generateUnifiedDiff } from '../../../packages/playwright-core/lib/utils/patch';

it('Identical texts should produce an empty diff', () => {
  const text1 = `line1
line2
line3`;
  const text2 = `line1
line2
line3`;

  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toBe(`--- a/file
+++ b/file
`);
});

it('Text with an inserted line', () => {
  const text1 = `line1
line2
line3`;
  const text2 = `line1
line2
line2.5
line3`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,3 +1,4 @@
 line1
 line2
+line2.5
 line3
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});

it('Text with a deleted line', () => {
  const text1 = `line1
line2
line3`;
  const text2 = `line1
line3`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,3 +1,2 @@
 line1
-line2
 line3
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});

it('Text with modified line', () => {
  const text1 = `line1
line2
line3`;
  const text2 = `line1
line2 modified
line3`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+line2 modified
 line3
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});

it('Empty original text', () => {
  const text1 = ``;
  const text2 = `line1
line2`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -0,0 +1,2 @@
+line1
+line2
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});

it('Empty modified text', () => {
  const text1 = `line1
line2`;
  const text2 = ``;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,2 +0,0 @@
-line1
-line2
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});

it('Handling different line endings (CRLF vs LF)', () => {
  const text1 = `line1\r\nline2\r\nline3`;
  const text2 = `line1\nline2 modified\nline3`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+line2 modified
 line3
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});

it('Large text diff', () => {
  const text1 = Array(1000)
      .fill('line')
      .join('\n');
  const text2 = Array(1000)
      .fill('line')
      .map((line, index) => (index === 500 ? 'modified line' : line))
      .join('\n');

  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain('-line\n+modified line');
});

it('Unicode characters', () => {
  const text1 = `こんにちは
世界`;
  const text2 = `こんにちは
世界！
さようなら`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,2 +1,3 @@
 こんにちは
-世界
+世界！
+さようなら
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});

it('Texts with only whitespace differences', () => {
  const text1 = `line1
line2
line3`;
  const text2 = `line1
line2  
line3`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+line2  
 line3
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toBe(expectedDiff);
});

it('Custom file names in diff header', () => {
  const text1 = `line1
line2
line3`;
  const text2 = `line1
line2 modified
line3`;

  const diff = generateUnifiedDiff(text1, text2, 'original.txt');
  expect(diff.startsWith('--- a/original.txt\n+++ b/original.txt\n')).toBe(true);
});

it('Multiple consecutive insertions and deletions', () => {
  const text1 = `line1
line2
line3
line4
line5`;
  const text2 = `line1
line2 modified
line3
line4 modified
line5`;

  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain('-line2\n+line2 modified');
  expect(diff).toContain('-line4\n+line4 modified');
});

it('Handling tabs and special characters', () => {
  const text1 = `line1
line\t2
line3`;
  const text2 = `line1
line2
line3`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line\t2
+line2
 line3
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});

it('Texts with leading and trailing whitespace differences', () => {
  const text1 = `  line1
line2  
line3`;
  const text2 = `line1
line2
line3`;

  const expectedDiff = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
-  line1
-line2  
+line1
+line2
 line3
`;
  const diff = generateUnifiedDiff(text1, text2);
  expect(diff).toContain(expectedDiff);
});
