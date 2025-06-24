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

import { test, expect, stripAnsi } from './playwright-test-fixtures';

const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓ ';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x ' : '✘ ';

for (const useIntermediateMergeReport of [false, true] as const) {
  test.describe(`${useIntermediateMergeReport ? 'merged' : 'created'}`, () => {
    test.use({ useIntermediateMergeReport });

    test('render each test with project name', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = { projects: [
            { name: 'foo' },
            { name: 'bar' },
          ] };
        `,
        'a.test.ts': `
          const { test, expect } = require('@playwright/test');
          test('fails', async ({}) => {
            expect(1).toBe(0);
          });
          test('passes', async ({}) => {
            expect(0).toBe(0);
          });
          test.skip('skipped', async () => {
          });
        `,
      }, { reporter: 'list', workers: '1' });
      const text = result.output;

      expect(text).toContain(`${NEGATIVE_STATUS_MARK} 1 [foo] › a.test.ts:3:11 › fails`);
      expect(text).toContain(`${POSITIVE_STATUS_MARK} 2 [foo] › a.test.ts:6:11 › passes`);
      expect(text).toContain(`-  3 [foo] › a.test.ts:9:16 › skipped`);
      expect(text).toContain(`${NEGATIVE_STATUS_MARK} 4 [bar] › a.test.ts:3:11 › fails`);
      expect(text).toContain(`${POSITIVE_STATUS_MARK} 5 [bar] › a.test.ts:6:11 › passes`);
      expect(text).toContain(`-  6 [bar] › a.test.ts:9:16 › skipped`);
      expect(result.exitCode).toBe(1);
    });

    test('render steps', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            await test.step('outer 1.0', async () => {
              await test.step('inner 1.1', async () => {});
              await test.step('inner 1.2', async () => {});
            });
            await test.step('outer 2.0', async () => {
              await test.step('inner 2.1', async () => {});
              await test.step('inner 2.2', async () => {});
            });
          });
        `,
      }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PLAYWRIGHT_LIST_PRINT_STEPS: '1', PLAYWRIGHT_FORCE_TTY: '80' });
      const text = result.output;
      const lines = text.split('\n').filter(l => l.match(/^#.* :/)).map(l => l.replace(/[.\d]+m?s/, 'Xms'));
      lines.pop(); // Remove last item that contains [v] and time in ms.
      expect(lines).toEqual([
        '#0 :      1 a.test.ts:3:15 › passes',
        '#1 :      1.1 passes › outer 1.0',
        '#2 :      1.2 passes › outer 1.0 › inner 1.1',
        '#2 :      1.2 passes › outer 1.0 › inner 1.1 (Xms)',
        '#3 :      1.3 passes › outer 1.0 › inner 1.2',
        '#3 :      1.3 passes › outer 1.0 › inner 1.2 (Xms)',
        '#1 :      1.1 passes › outer 1.0 (Xms)',
        '#4 :      1.4 passes › outer 2.0',
        '#5 :      1.5 passes › outer 2.0 › inner 2.1',
        '#5 :      1.5 passes › outer 2.0 › inner 2.1 (Xms)',
        '#6 :      1.6 passes › outer 2.0 › inner 2.2',
        '#6 :      1.6 passes › outer 2.0 › inner 2.2 (Xms)',
        '#4 :      1.4 passes › outer 2.0 (Xms)',
      ]);
    });

    test('render steps inline', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', async ({}) => {
        await test.step('outer 1.0', async () => {
          await test.step('inner 1.1', async () => {});
          await test.step('inner 1.2', async () => {});
        });
        await test.step('outer 2.0', async () => {
          await test.step('inner 2.1', async () => {});
          await test.step('inner 2.2', async () => {});
        });
      });`,
      }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PLAYWRIGHT_FORCE_TTY: '80' });
      const text = result.output;
      const lines = text.split('\n').filter(l => l.match(/^#.* :/)).map(l => l.replace(/[.\d]+m?s/, 'Xms'));
      lines.pop(); // Remove last item that contains [v] and time in ms.
      expect(lines).toEqual([
        '#0 :      1 a.test.ts:3:11 › passes',
        '#0 :      1 a.test.ts:3:11 › passes › outer 1.0',
        '#0 :      1 a.test.ts:3:11 › passes › outer 1.0 › inner 1.1',
        '#0 :      1 a.test.ts:3:11 › passes › outer 1.0',
        '#0 :      1 a.test.ts:3:11 › passes › outer 1.0 › inner 1.2',
        '#0 :      1 a.test.ts:3:11 › passes › outer 1.0',
        '#0 :      1 a.test.ts:3:11 › passes',
        '#0 :      1 a.test.ts:3:11 › passes › outer 2.0',
        '#0 :      1 a.test.ts:3:11 › passes › outer 2.0 › inner 2.1',
        '#0 :      1 a.test.ts:3:11 › passes › outer 2.0',
        '#0 :      1 a.test.ts:3:11 › passes › outer 2.0 › inner 2.2',
        '#0 :      1 a.test.ts:3:11 › passes › outer 2.0',
        '#0 :      1 a.test.ts:3:11 › passes',
      ]);
    });

    test('render steps in non-TTY mode', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            await test.step('outer 1.0', async () => {
              await test.step('inner 1.1', async () => {});
              await test.step('inner 1.2', async () => {});
            });
            await test.step('outer 2.0', async () => {
              await test.step('inner 2.1', async () => {});
              await test.step('inner 2.2', async () => {});
            });
          });
        `,
      }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PLAYWRIGHT_LIST_PRINT_STEPS: '1' });
      const text = result.output;
      const lines = text.split('\n').filter(l => l.match(/^#.* :/)).map(l => l.replace(/[.\d]+m?s/, 'Xms'));
      expect(lines).toEqual([
        '#0 :      1.1 a.test.ts:3:15 › passes › outer 1.0 › inner 1.1 (Xms)',
        '#1 :      1.2 a.test.ts:3:15 › passes › outer 1.0 › inner 1.2 (Xms)',
        '#2 :      1.3 a.test.ts:3:15 › passes › outer 1.0 (Xms)',
        '#3 :      1.4 a.test.ts:3:15 › passes › outer 2.0 › inner 2.1 (Xms)',
        '#4 :      1.5 a.test.ts:3:15 › passes › outer 2.0 › inner 2.2 (Xms)',
        '#5 :      1.6 a.test.ts:3:15 › passes › outer 2.0 (Xms)',
        `#6 :   ${POSITIVE_STATUS_MARK} 1 a.test.ts:3:15 › passes (Xms)`,
      ]);
    });

    test('very long console line should not mess terminal', async ({ runInlineTest }) => {
      const TTY_WIDTH = 80;
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            console.log('a'.repeat(80) + 'b'.repeat(20));
          });
        `,
      }, { reporter: 'list' }, { PLAYWRIGHT_FORCE_TTY: TTY_WIDTH + '' });

      const renderedText = simpleAnsiRenderer(result.rawOutput, TTY_WIDTH);
      if (process.platform === 'win32')
        expect(renderedText).toContain('  ok 1 a.test.ts:3:15 › passes');
      else
        expect(renderedText).toContain('  ✓  1 a.test.ts:3:15 › passes');
      expect(renderedText).not.toContain('     1 a.test.ts:3:15 › passes');
      expect(renderedText).toContain('a'.repeat(80) + '\n' + 'b'.repeat(20));
    });

    test('render retries', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('flaky', async ({}, testInfo) => {
            expect(testInfo.retry).toBe(1);
          });
        `,
      }, { reporter: 'list', retries: '1' }, { PW_TEST_DEBUG_REPORTERS: '1', PLAYWRIGHT_FORCE_TTY: '80' });
      const text = result.output;
      const lines = text.split('\n').filter(l => l.startsWith('#0 :') || l.startsWith('#1 :')).map(l => l.replace(/\d+(\.\d+)?m?s/, 'XXms'));

      expect(lines).toEqual([
        `#0 :      1 a.test.ts:3:15 › flaky`,
        `#0 :   ${NEGATIVE_STATUS_MARK} 1 a.test.ts:3:15 › flaky (XXms)`,
        `#1 :      2 a.test.ts:3:15 › flaky (retry #1)`,
        `#1 :   ${POSITIVE_STATUS_MARK} 2 a.test.ts:3:15 › flaky (retry #1) (XXms)`,
      ]);
    });

    test('should truncate long test names', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = { projects: [
            { name: 'foo' },
          ] };
        `,
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('failure in very long name', async ({}) => {
            expect(1).toBe(0);
          });
          test('passes', async ({}) => {
          });
          test('passes 2 long name', async () => {
          });
          test.skip('skipped very long name', async () => {
          });
        `,
      }, { reporter: 'list', retries: 0 }, { PLAYWRIGHT_FORCE_TTY: '50' });
      expect(result.exitCode).toBe(1);

      const lines = result.rawOutput.split('\n').map(line => line.split('\x1B[22m\x1B[1E')).flat().map(line => stripAnsi(line)).filter(line => line.trim()).slice(1, 9);
      expect(lines.every(line => line.length <= 50)).toBe(true);

      expect(lines[0]).toBe(`     1 …a.test.ts:3:15 › failure in very long name`);

      expect(lines[1]).toContain(`${NEGATIVE_STATUS_MARK} 1 …`);
      expect(lines[1]).toContain(`:3:15 › failure in very long name (`);
      expect(lines[1].length).toBe(50);

      expect(lines[2]).toBe(`     2 [foo] › a.test.ts:6:15 › passes`);

      expect(lines[3]).toContain(`${POSITIVE_STATUS_MARK} 2 [foo] › a.test.ts:6:15 › passes (`);

      expect(lines[4]).toBe(`     3 [foo] › a.test.ts:8:15 › passes 2 long name`);

      expect(lines[5]).toContain(`${POSITIVE_STATUS_MARK} 3 …`);
      expect(lines[5]).toContain(`test.ts:8:15 › passes 2 long name (`);
      expect(lines[5].length).toBe(50);

      expect(lines[6]).toBe(`     4 …› a.test.ts:10:16 › skipped very long name`);

      expect(lines[7]).toBe(`  -  4 …› a.test.ts:10:16 › skipped very long name`);
    });

    test('render failed test steps', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            await test.step('outer 1.0', async () => {
              await test.step('inner 1.1', async () => {
                expect(1).toBe(2);
              });
            });
          });
        `,
      }, { reporter: 'list' });
      const text = result.output;
      expect(text).toContain('1) a.test.ts:3:15 › passes › outer 1.0 › inner 1.1 ──');
      expect(result.exitCode).toBe(1);
    });

    test('print stdio', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            await new Promise(resolve => process.stdout.write('line1', () => resolve()));
            await new Promise(resolve => process.stdout.write('line2\\n', () => resolve()));
            await new Promise(resolve => process.stderr.write(Buffer.from(''), () => resolve()));
          });

          test('passes 2', async ({}) => {
            await new Promise(resolve => process.stdout.write('partial', () => resolve()));
          });

          test('passes 3', async ({}) => {
            await new Promise(resolve => process.stdout.write('full\\n', () => resolve()));
          });

          test('passes 4', async ({}) => {
          });
        `,
      }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PLAYWRIGHT_FORCE_TTY: '80' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(4);
      const expected = [
        '#0 :      1 a.test.ts:3:15 › passes',
        'line1line2',
        `#0 :   ${POSITIVE_STATUS_MARK} 1 a.test.ts:3:15 › passes`,
        '',
        '#3 :      2 a.test.ts:9:15 › passes 2',
        `partial#3 :   ${POSITIVE_STATUS_MARK} 2 a.test.ts:9:15 › passes 2`,
        '',
        '#5 :      3 a.test.ts:13:15 › passes 3',
        'full',
        `#5 :   ${POSITIVE_STATUS_MARK} 3 a.test.ts:13:15 › passes 3`,
        '#7 :      4 a.test.ts:17:15 › passes 4',
        `#7 :   ${POSITIVE_STATUS_MARK} 4 a.test.ts:17:15 › passes 4`,
      ];
      const lines = result.output.split('\n');
      const firstIndex = lines.indexOf(expected[0]);
      expect(firstIndex, 'first line should be there').not.toBe(-1);
      for (let i = 0; i < expected.length; ++i)
        expect(lines[firstIndex + i]).toContain(expected[i]);
    });

    test('should update test status row only when TTY has not scrolled', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('A', async ({}) => {
            for (let i = 0; i < 20; ++i) {
              console.log('line ' + i);
            }
          });

          test('B', async ({}) => {
            // Go past end of the screen
            for (let i = 20; i < 60; ++i) {
              console.log('line ' + i);
            }

            // Should create new line
            await test.step('First step', async () => {
              console.log('step 1');
            });

            for (let i = 60; i < 80; ++i) {
              console.log('line ' + i);
            }

            // Should update the new (not original) line
            await test.step('Second step', async () => {
              console.log('step 2');
            });
          });
        `,
      }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PLAYWRIGHT_FORCE_TTY: '80' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(2);
      const expected = [
        '#0 :      1 a.test.ts:3:15 › A',
      ];
      for (let i = 0; i < 20; ++i)
        expected.push(`line ${i}`);
      // Update to initial test status row
      expected.push(`#0 :   ${POSITIVE_STATUS_MARK} 1 a.test.ts:3:15 › A`);
      expected.push(`#21 :      2 a.test.ts:9:15 › B`);
      for (let i = 20; i < 60; ++i)
        expected.push(`line ${i}`);
      expected.push(`#62 :      2 a.test.ts:9:15 › B › First step`);
      expected.push(`step 1`);
      expected.push(`#62 :      2 a.test.ts:9:15 › B`);
      for (let i = 60; i < 80; ++i)
        expected.push(`line ${i}`);
      expected.push(`#62 :      2 a.test.ts:9:15 › B › Second step`);
      expected.push(`step 2`);
      expected.push(`#62 :      2 a.test.ts:9:15 › B`);
      expected.push(`#62 :   ${POSITIVE_STATUS_MARK} 2 a.test.ts:9:15 › B`);
      const lines = result.output.split('\n');
      const firstIndex = lines.indexOf(expected[0]);
      expect(firstIndex, 'first line should be there').not.toBe(-1);
      for (let i = 0; i < expected.length; ++i)
        expect(lines[firstIndex + i]).toContain(expected[i]);
    });

    test('should update test status row only within configured TTY height', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('A', async ({}) => {
            // No scroll
            for (let i = 0; i < 60; ++i) {
              console.log('line ' + i);
            }

            // Update original line
            await test.step('First step', async () => {
              console.log('step 1');
            });

            for (let i = 60; i < 120; ++i) {
              console.log('line ' + i);
            }

            // Should create new line
            await test.step('Second step', async () => {
              console.log('step 2');
            });
          });
        `,
      }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PLAYWRIGHT_FORCE_TTY: '80x80' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);
      const expected = [
        '#0 :      1 a.test.ts:3:15 › A',
      ];
      for (let i = 0; i < 60; ++i)
        expected.push(`line ${i}`);
      // Update to initial test status row
      expected.push(`#0 :      1 a.test.ts:3:15 › A › First step`);
      expected.push(`step 1`);
      expected.push(`#0 :      1 a.test.ts:3:15 › A`);
      for (let i = 60; i < 120; ++i)
        expected.push(`line ${i}`);
      expected.push(`#122 :      1 a.test.ts:3:15 › A › Second step`);
      expected.push(`step 2`);
      expected.push(`#122 :      1 a.test.ts:3:15 › A`);
      expected.push(`#122 :   ${POSITIVE_STATUS_MARK} 1 a.test.ts:3:15 › A`);
      const lines = result.output.split('\n');
      const firstIndex = lines.indexOf(expected[0]);
      expect(firstIndex, 'first line should be there').not.toBe(-1);
      for (let i = 0; i < expected.length; ++i)
        expect(lines[firstIndex + i]).toContain(expected[i]);
    });
  });
}

function simpleAnsiRenderer(text, ttyWidth) {
  let lineNumber = 0;
  let columnNumber = 0;
  const screenLines: string[][] = [];
  const ensureScreenSize = () => {
    if (lineNumber < 0)
      throw new Error('Bad terminal navigation!');
    while (lineNumber >= screenLines.length)
      screenLines.push(new Array(ttyWidth).fill(''));
  };
  const print = ch => {
    ensureScreenSize();
    if (ch === '\n') {
      columnNumber = 0;
      ++lineNumber;
    } else {
      screenLines[lineNumber][columnNumber++] = ch;
      if (columnNumber === ttyWidth) {
        columnNumber = 0;
        ++lineNumber;
      }
    }
    ensureScreenSize();
  };

  let index = 0;

  const ansiCodes = [...text.matchAll(/\u001B\[(\d*)(.)/g)];
  for (const ansiCode of ansiCodes) {
    const [matchText, codeValue, codeType] = ansiCode;
    const code = (codeValue + codeType).toUpperCase();
    while (index < ansiCode.index)
      print(text[index++]);
    if (codeType.toUpperCase() === 'E') {
      // Go X lines down
      lineNumber += +codeValue;
      ensureScreenSize();
    } else if (codeType.toUpperCase() === 'A') {
      // Go X lines up
      lineNumber -= +codeValue;
      ensureScreenSize();
    } else if (code === '2K') {
      // Erase full line
      ensureScreenSize();
      screenLines[lineNumber] = new Array(ttyWidth).fill('');
    } else if (code === '0G') {
      // Go to start
      columnNumber = 0;
    } else {
      // Unsupported ANSI code (e.g. all colors).
    }
    index += matchText.length;
  }
  while (index < text.length)
    print(text[index++]);

  return screenLines.map(line => line.join('')).join('\n');
}
