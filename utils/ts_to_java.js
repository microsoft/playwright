/**
 * Copyright (c) Microsoft Corporation.
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

// The script does basic transformation of .spec.ts code to .java unit tests.

const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');
const { argv } = require('process');

(async () => {
  if (process.argv.length < 3) throw new Error("Usage: node to_java.js <test>.spec.js");
  const file = argv[2];
  if (!file.endsWith('.spec.ts')) throw new Error("Unexpected input: " + file);
  console.log('Reading: ' + file);
  let content = await util.promisify(fs.readFile)(file);
  content = content.toString();

  function toCamelCase(match, p1, offset, string) {
    return p1.toUpperCase();
  }

  function itReplacer(match, p1, p2, p3, offset, string) {
    // let name = p1.replace(/[ :'\-=\[\]\<\>]/g, '_');
    let name = p1.replace(/\W+(.)/g, toCamelCase);
    // Remove special chars from the end.
    name = name.replace(/\W+$/, '');
    // console.log(name);
    return `@Test
void ${name}() {`;
  }
  content = content.replace(/playwrightTest\('(.+)',.*{/g, itReplacer);
  content = content.replace(/browserTest\('(.+)',.*{/g, itReplacer);
  content = content.replace(/pageTest\('(.+)',.*{/g, itReplacer);
  content = content.replace(/test\('(.+)',.*{/g, itReplacer);
  content = content.replace(/it\('(.+)',.*{/g, itReplacer);
  content = content.replace(/it\(`(.+)`,.*{/g, itReplacer);

  // Test's closing bracket: });
  content = content.replace(/\n\}\);/g, '\n}');

  content = content.replace(/ async route => {/g, ' (route, request) -> {');
  content = content.replace(/ route => {/g, ' (route, request) -> {');
  content = content.replace(/ async \(route, request\) => {/g, ' (route, request) -> {');
  content = content.replace(/ \(route, request\) => {/g, ' (route, request) -> {');
  content = content.replace(/(server.setRoute.+)\(req, res\) => \{/g, '$1exchange -> {');

  content = content.replace(/([^\\])"/g, '$1SINGLE_QUOTE');
  // content = content.replace(/(\) \=\>.*)'/g, '$1 XXX');

  // Replace single quotes with double quotes
  content = content.replace(/''/g, '""');
  content = content.replace(/(?<!\) \=\>.*)([^\\])'/g, '$1"');
  // Replace double quotes with single quotes
  content = content.replace(/SINGLE_QUOTE/g, "'");
  content = content.replace(/`/g, '"');

  // quote lambdas
  content = content.replace(/request => requests.push\(request\)/g, 'request -> requests.add(request)');
  // content = content.replace(/, ([^,\(]+ \=\> [^\)]+)\)/g, ', "$1")');
  content = content.replace(/page.evaluate\((\(\) => [^\)]+)\)/g, 'page.evaluate("$1")');

  // Remove await/Promise.all
  // Match all [^;] inside Promise.all([...]); to overcome greedy match and not include next foo([...]) calls.
  content = content.replace(/const \[(.+)\] = await Promise.all\(\[([^;]+|)\]\);/g, '$1 = $2');
  content = content.replace(/await Promise.all\(\[([^;]+|)\]\);/g, '$1');
  content = content.replace(/Promise\.all\(\[/g, '');
  content = content.replace(/await /g, '');

  // Rename some methods
  content = content.replace(/context\.tracing/g, 'context.tracing()');
  content = content.replace(/\.goto\(/g, '.navigate(');
  content = content.replace(/\.continue\(/g, '.resume(');
  content = content.replace(/\.\$eval\(/g, '.evalOnSelector(');
  content = content.replace(/\.\$\$eval\(/g, '.evalOnSelectorAll(');
  content = content.replace(/\.\$\(/g, '.querySelector(');
  content = content.replace(/\.\$\$\(/g, '.querySelectorAll(');

  content = content.replace(/\.keyboard\./g, '.keyboard().');
  content = content.replace(/\.mouse\./g, '.mouse().');
  content = content.replace(/\.coverage\./g, '.coverage().');
  content = content.replace(/\.accessibility\./g, '.accessibility().');
  content = content.replace(/\.length/g, '.size()');

  content = content.replace(/expect\((.+)\).toBeTruthy\(\);/g, 'assertNotNull($1);');
  content = content.replace(/expect\(error.message\)\.toContain\((.+)\);/g, 'assertTrue(e.getMessage().contains($1), e.getMessage());');
  content = content.replace(/expect\((.+)\)\.toContain\((.+)\);/g, 'assertTrue($1.contains($2));');
  content = content.replace(/expect\((.+)\)\.toBe\(null\);/g, 'assertNull($1);');
  content = content.replace(/expect\((.+)\)\.not.toBe\(null\);/g, 'assertNotNull($1);');
  content = content.replace(/expect\((.+\.evaluate.+)\)\.toBe\(true\);/g, 'assertEquals(true, $1);');
  content = content.replace(/expect\((.+)\)\.toBe\(true\);/g, 'assertTrue($1);');
  content = content.replace(/expect\((.+)\)\.toBe\((.+)\);/g, 'assertEquals($2, $1);');
  // Match all [^;] inside .toEqual([...]); to overcome greedy match and not include next foo([...]) calls.
  content = content.replace(/expect\((.+)\)\.toEqual\(\[([^;]+|)\]\);/g, 'assertEquals(asList($2), $1);');
  for (let before = null; before !== content;) {
    before = content;
    content = content.replace(/(asList\([^\)\']*)'/g, '$1"');
  }
  content = content.replace(/expect\((.+)\)\.toEqual\((.+)\);/g, 'assertEquals($2, $1);');

  content = content.replace(/(?<!.files)\[(\d+)\]/g, '.get($1)');
  content = content.replace(/\[("[^"]+")\]/g, '.get($1)');
  content = content.replace(/.push\(/g, '.add(');

  // Define common types
  content = content.replace(/const request = playwright.request.newContext/g, 'APIRequestContext request = playwright.request.newContext');
  content = content.replace(/const (browser[^\s=]*) = /g, 'Browser $1 = ');
  content = content.replace(/const sizes = /g, 'Sizes sizes = ');
  content = content.replace(/const remote = /g, 'Browser remote = ');
  content = content.replace(/const context = /g, 'BrowserContext context = ');
  content = content.replace(/const (page[^\s=]*) = /g, 'Page $1 = ');
  content = content.replace(/const newPage = /g, 'Page newPage = ');
  content = content.replace(/const button/g, 'ElementHandle button');
  content = content.replace(/const result = /g, 'Object result = ');
  content = content.replace(/const response = /g, 'Response response = ');
  content = content.replace(/const request = /g, 'Request request = ');
  content = content.replace(/const requests = \[\];/g, 'List<Request> requests = new ArrayList<>();');
  content = content.replace(/const snapshot = page.accessibility/g, 'AccessibilityNode snapshot = page.accessibility');
  content = content.replace(/snapshot\.children\./g, 'snapshot.children().');
  content = content.replace(/const (.+) = \[\];/g, 'List<> $1 = new ArrayList<>();');
  content = content.replace(/const (\w+ = .+evalOnSelector)/g, 'Object $1');
  content = content.replace(/const (\w+ = .+querySelector)/g, 'ElementHandle $1');
  content = content.replace(/const messages = \[\]/g, 'List<String> messages = new ArrayList<>()');
  content = content.replace(/const frame = /g, 'Frame frame = ');
  content = content.replace(/const elementHandle = (.+)/g, 'JSHandle jsHandle = $1\n  ElementHandle elementHandle = jsHandle.asElement();\n  assertNotNull(elementHandle);');
  content = content.replace(/const (\w+ = \w+\.boundingBox)/g, 'ElementHandle.BoundingBox $1');
  content = content.replace(/assertEquals\({ x: (\d+), y: (\d+), width: (\d+), height: (\d+) }, box\);/g, `assertEquals(box.x, $1);
  assertEquals(box.y, $2);
  assertEquals(box.width, $3);
  assertEquals(box.height, $4);`);
  content = content.replace(/setViewportSize\({ width: (\d+), height: (\d+) }\)/g, 'setViewportSize($1, $2)');
  content = content.replace(/\.on\("([^"]+)", /g, (match, p1, offset, string) => `\.on${toTitleCase(p1)}(`);
  content = content.replace(/page.waitForEvent\("([^"]+)"/g, (match, p1, offset, string) => `page.waitFor${toTitleCase(p1)}(`);
  content = content.replace(/server.waitForRequest/g, 'server.futureRequest');
  content = content.replace(/context.request/g, 'context.request()');
  content = content.replace(/page.request/g, 'page.request()');
  content = content.replace(/playwright.request/g, 'playwright.request()');

  // try/catch
  content = content.replace(/const error = /g, 'try {\n');
  content = content.replace(/\.catch\(e => e\)[;,]/g, ';\nfail("did not throw");\n} catch (PlaywrightException e) {}\n');
  content = content.replace(/(.+)\.catch\(e => error = e\);/g, '  try {\n  $1;\n    fail("did not throw");\n  } catch (PlaywrightException e) {\n  }\n');

  const output = file.replace(/\.spec\.ts$/, ".java")
  console.log('Writing: ' + output);
  await util.promisify(fs.writeFile)(output, content)
})();

function toTitleCase(s) {
  return s[0].toUpperCase() + s.substr(1);
}