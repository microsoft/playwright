import { test as it, expect } from '@playwright/test';
import { PlaywrightTest } from '../../../packages/playwright-core/src/server/PlaywrightTest';

it.describe('PlaywrightTest', () => {
  it('should handle malformed JSON from test list command', async () => {
    const mockProcess = {
      stdout: {
        on: (event: string, handler: (data: any) => void) => {
          if (event === 'data') {
            // Simulate malformed JSON in stdout
            handler(Buffer.from('{ not: "json"'));
          }
        }
      },
      stderr: {
        on: (event: string, handler: (data: any) => void) => {}
      },
      on: (event: string, handler: (code: number) => void) => {
        if (event === 'close') {
          handler(0);
        }
      }
    };

    const mockSpawnFunction = () => mockProcess;

    const playwrightTest = new PlaywrightTest({
      workspaceRoot: '/fake/workspace',
      childProcess: { spawn: mockSpawnFunction }
    });

    try {
      await playwrightTest.listTests();
      throw new Error('Expected listTests() to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Failed to parse test list output');
      expect(error.message).toContain('Unexpected end of JSON input');
    }
  });
});
