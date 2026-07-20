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

import { test, expect } from './playwright-test-fixtures';

test('should record calls and support call assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('mock function calls', async () => {
        const fn = expect.fn();
        fn('a', 1);
        fn('b');
        fn();
        await expect(fn).toHaveBeenCalled();
        await expect(fn).toHaveBeenCalledTimes(3);
        await expect(fn).toHaveBeenCalledWith('a', 1);
        await expect(fn).toHaveBeenCalledWith('b');
        await expect(fn).toHaveBeenLastCalledWith();
        await expect(fn).toHaveBeenNthCalledWith(1, 'a', 1);
        await expect(fn).toHaveBeenNthCalledWith(2, 'b');
        await expect(fn).not.toHaveBeenCalledWith('c');
        await expect(fn).not.toHaveBeenCalledTimes(2);
        expect(fn.mock.calls).toEqual([['a', 1], ['b'], []]);
        expect(fn.mock.lastCall).toEqual([]);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should retry until the mock function is called', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('async callback', async () => {
        const fn = expect.fn();
        setTimeout(() => fn('first'), 300);
        setTimeout(() => fn('second'), 600);
        await expect(fn).toHaveBeenCalledWith('first');
        await expect(fn).toHaveBeenCalledWith('second');
        await expect(fn).toHaveBeenCalledTimes(2);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should time out with a helpful message when never called', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('never called', async () => {
        const fn = expect.fn();
        await expect.configure({ timeout: 500 })(fn).toHaveBeenCalled();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('expect(expect.fn()).toHaveBeenCalled()');
  expect(result.output).toContain('Expected number of calls: >= 1');
  expect(result.output).toContain('Received number of calls: 0');
  expect(result.output).toContain('Timeout 500ms exceeded while waiting on the predicate');
});

test('should respect mock name in error messages', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('named mock', async () => {
        const fn = expect.fn().mockName('onChange');
        await expect.configure({ timeout: 100 })(fn).toHaveBeenCalled();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('expect(onChange).toHaveBeenCalled()');
});

test('should fail fast when the call count exceeds the expectation', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('too many calls', async () => {
        test.setTimeout(3000);
        const fn = expect.fn();
        fn();
        fn();
        fn();
        // Default expect timeout is 5 seconds, but the assertion must fail
        // immediately because the call count can only grow.
        await expect(fn).toHaveBeenCalledTimes(2);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Expected number of calls: 2');
  expect(result.output).toContain('Received number of calls: 3');
  expect(result.output).not.toContain('Test timeout of 3000ms exceeded');
});

test('should fail fast on not.toHaveBeenCalled when already called', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('not called', async () => {
        test.setTimeout(3000);
        const fn = expect.fn();
        fn('a');
        await expect(fn).not.toHaveBeenCalled();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Expected number of calls: 0');
  expect(result.output).toContain('Received number of calls: 1');
  expect(result.output).not.toContain('Test timeout of 3000ms exceeded');
});

test('should support asymmetric matchers in toHaveBeenCalledWith', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('asymmetric matchers', async () => {
        const fn = expect.fn();
        fn({ email: 'ellen@example.com', id: 42 }, 'extra');
        await expect(fn).toHaveBeenCalledWith(expect.objectContaining({ email: 'ellen@example.com' }), expect.any(String));
        await expect(fn).not.toHaveBeenCalledWith(expect.objectContaining({ email: 'other@example.com' }), expect.any(String));
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should support implementations and return value assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('async implementations resolve', async () => {
        const fn = expect.fn(async (a: number, b: number) => a + b);
        expect(await fn(1, 2)).toBe(3);
        await expect(fn).toHaveResolved();
        await expect(fn).toHaveResolvedTimes(1);
        await expect(fn).toHaveResolvedWith(3);
        await expect(fn).toHaveLastResolvedWith(3);
        await expect(fn).toHaveNthResolvedWith(1, 3);
      });
      test('return values are synchronous', async () => {
        const stub = expect.fn()
            .mockReturnValue('default')
            .mockReturnValueOnce('first');
        expect(stub()).toBe('first');
        expect(stub()).toBe('default');
        await expect(stub).toHaveReturned();
        await expect(stub).toHaveReturnedTimes(2);
        await expect(stub).toHaveReturnedWith('first');
        await expect(stub).toHaveLastReturnedWith('default');
        await expect(stub).toHaveNthReturnedWith(1, 'first');
        await expect(stub).toHaveNthReturnedWith(2, 'default');
      });
      test('resolved and rejected values', async () => {
        const resolved = expect.fn().mockResolvedValue('value');
        expect(await resolved()).toBe('value');
        await expect(resolved).toHaveResolvedWith('value');

        const rejected = expect.fn().mockRejectedValue(new Error('nope'));
        await expect(rejected()).rejects.toThrow('nope');
        await expect(rejected).not.toHaveResolved();
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should not count thrown calls as returns', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('throwing mock', async () => {
        const fn = expect.fn(() => { throw new Error('boom'); });
        expect(() => fn()).toThrow('boom');
        await expect(fn).toHaveBeenCalledTimes(1);
        await expect(fn).not.toHaveReturned();
        await expect(fn).not.toHaveResolved();
        expect(fn.mock.results).toEqual([{ type: 'throw', value: expect.any(Error) }]);
        expect(fn.mock.settledResults).toEqual([{ type: 'rejected', value: expect.any(Error) }]);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should support mockClear and mockReset', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('clear keeps the implementation', async () => {
        const fn = expect.fn(() => 'value');
        fn();
        await expect(fn).toHaveBeenCalledTimes(1);
        fn.mockClear();
        await expect(fn).not.toHaveBeenCalled();
        expect(fn()).toBe('value');
      });
      test('reset restores the original implementation', async () => {
        const fn = expect.fn(async () => 'original');
        fn.mockImplementation(async () => 'override');
        fn.mockReturnValueOnce('once');
        expect(fn()).toBe('once');
        expect(await fn()).toBe('override');
        fn.mockReset();
        await expect(fn).not.toHaveBeenCalled();
        expect(await fn()).toBe('original');
      });
      test('reset clears the implementation when none was passed', async () => {
        const fn = expect.fn();
        fn.mockImplementation(async () => 'override');
        expect(await fn()).toBe('override');
        fn.mockReset();
        expect(fn()).toBe(undefined);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should require a mock function for mock assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('not a mock', async () => {
        await expect(() => {}).toHaveBeenCalled();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('toHaveBeenCalled() can only be used with a mock function created by expect.fn()');
});

test('should not support mock matchers in expect.poll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('poll', async () => {
        const fn = expect.fn();
        await expect.poll(() => fn).toHaveBeenCalled();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('`expect.poll()` does not support "toHaveBeenCalled" matcher');
});

test('should support expect.poll over mock state', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('poll over derived mock state', async () => {
        const fn = expect.fn();
        setTimeout(() => { fn(1); fn(2); fn(3); }, 200);
        await expect.poll(() => fn.mock.calls.length).toBeGreaterThan(2);
        expect(fn.mock.lastCall?.[0]).toBe(3);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should store call arguments by reference', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('by-reference storage', async () => {
        const fn = expect.fn();
        const payload = { status: 'pending' };
        fn(payload);
        payload.status = 'done';
        // Arguments are recorded by reference, so the mutation is visible.
        await expect(fn).toHaveBeenCalledWith({ status: 'done' });
        await expect(fn).not.toHaveBeenCalledWith({ status: 'pending' });
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should support asymmetric matchers in all argument matchers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('asymmetric matchers across the calledWith family', async () => {
        const fn = expect.fn();
        fn({ email: 'ellen@example.com' }, ['a', 'b']);
        fn('code-123', 42.0001);
        await expect(fn).toHaveBeenNthCalledWith(1, expect.objectContaining({ email: 'ellen@example.com' }), expect.arrayContaining(['b']));
        await expect(fn).toHaveBeenNthCalledWith(2, expect.stringMatching(/^code-\\d+$/), expect.closeTo(42, 2));
        await expect(fn).toHaveBeenLastCalledWith(expect.stringContaining('code'), expect.any(Number));
        await expect(fn).toHaveBeenCalledWith(expect.not.objectContaining({ email: 'other@example.com' }), expect.any(Array));
        await expect(fn).not.toHaveBeenLastCalledWith(expect.stringMatching(/nope/), expect.any(Number));
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should support asymmetric matchers in all return matchers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('asymmetric matchers across the returnedWith family', async () => {
        const fn = expect.fn()
            .mockReturnValueOnce({ id: 1, tags: ['x', 'y'] })
            .mockReturnValue({ id: 2, tags: ['x', 'y'] });
        fn();
        fn();
        await expect(fn).toHaveReturnedWith(expect.objectContaining({ id: 1 }));
        await expect(fn).toHaveLastReturnedWith(expect.objectContaining({ id: 2, tags: expect.arrayContaining(['y']) }));
        await expect(fn).toHaveNthReturnedWith(1, expect.objectContaining({ tags: expect.any(Array) }));
        await expect(fn).not.toHaveReturnedWith(expect.objectContaining({ id: 3 }));
      });
      test('asymmetric matchers across the resolvedWith family', async () => {
        const fn = expect.fn(async (id: number) => ({ id, tags: ['x', 'y'] }));
        await fn(1);
        await fn(2);
        await expect(fn).toHaveResolvedWith(expect.objectContaining({ id: 1 }));
        await expect(fn).toHaveLastResolvedWith(expect.objectContaining({ id: 2, tags: expect.arrayContaining(['y']) }));
        await expect(fn).toHaveNthResolvedWith(1, expect.objectContaining({ tags: expect.any(Array) }));
        await expect(fn).not.toHaveResolvedWith(expect.objectContaining({ id: 3 }));
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should retry last and returned matchers until they pass', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('last call changes with later calls', async () => {
        const fn = expect.fn(async (value: string) => 'resolved ' + value);
        await fn('first');
        setTimeout(() => fn('second'), 300);
        // Initially the last call is 'first'; the assertion retries until the
        // later call arrives and becomes the last one.
        await expect(fn).toHaveBeenLastCalledWith('second');
        await expect(fn).toHaveLastResolvedWith('resolved second');
        await expect(fn).toHaveResolvedTimes(2);
        await expect(fn).toHaveNthResolvedWith(2, 'resolved second');
      });
      test('toHaveReturned retries', async () => {
        const fn = expect.fn().mockReturnValue('ok');
        setTimeout(() => fn(), 300);
        await expect(fn).toHaveReturned();
        await expect(fn).toHaveReturnedWith('ok');
      });
      test('resolved matchers await settlement', async () => {
        const fn = expect.fn(() => new Promise(f => setTimeout(() => f('late'), 300)));
        fn();
        // The settled result is 'incomplete' at first; the assertion retries
        // until the promise is fulfilled.
        await expect(fn).toHaveResolvedWith('late');
        await expect(fn).toHaveNthResolvedWith(1, 'late');
        await expect(fn).toHaveResolved();
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should fail fast when the return count exceeds the expectation', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('too many returns', async () => {
        test.setTimeout(3000);
        const fn = expect.fn(() => 'ok');
        fn();
        fn();
        await expect(fn).toHaveReturnedTimes(1);
      });
      test('nth call mismatch is final', async () => {
        test.setTimeout(3000);
        const fn = expect.fn();
        fn('actual');
        // The first call is made and can never change, so this fails immediately.
        await expect(fn).toHaveBeenNthCalledWith(1, 'expected');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.output).toContain('Expected number of returns: 1');
  expect(result.output).toContain('Received number of returns: 2');
  expect(result.output).not.toContain('Test timeout of 3000ms exceeded');
});

test('should validate matcher arguments', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('negative call count', async () => {
        await expect(expect.fn()).toHaveBeenCalledTimes(-1);
      });
      test('fractional return count', async () => {
        await expect(expect.fn()).toHaveReturnedTimes(1.5);
      });
      test('zero n in nth called', async () => {
        await expect(expect.fn()).toHaveBeenNthCalledWith(0, 'a');
      });
      test('zero n in nth returned', async () => {
        await expect(expect.fn()).toHaveNthReturnedWith(0, 'a');
      });
      test('negative resolved count', async () => {
        await expect(expect.fn()).toHaveResolvedTimes(-1);
      });
      test('zero n in nth resolved', async () => {
        await expect(expect.fn()).toHaveNthResolvedWith(0, 'a');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(6);
  expect(result.output).toContain('toHaveBeenCalledTimes: expected must be a non-negative integer, received -1');
  expect(result.output).toContain('toHaveReturnedTimes: expected must be a non-negative integer, received 1.5');
  expect(result.output).toContain('toHaveBeenNthCalledWith: n must be a positive integer, received 0');
  expect(result.output).toContain('toHaveNthReturnedWith: n must be a positive integer, received 0');
  expect(result.output).toContain('toHaveResolvedTimes: expected must be a non-negative integer, received -1');
  expect(result.output).toContain('toHaveNthResolvedWith: n must be a positive integer, received 0');
});

test('should support the full implementation API', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('once implementations fall back to the default', async () => {
        const fn = expect.fn(async () => 'default')
            .mockImplementationOnce(async () => 'first call')
            .mockImplementationOnce(async () => 'second call');
        expect(await Promise.all([fn(), fn(), fn(), fn()])).toEqual(['first call', 'second call', 'default', 'default']);
      });
      test('once values fall back to the default value', async () => {
        const fn = expect.fn()
            .mockReturnValue('default')
            .mockReturnValueOnce('first call')
            .mockReturnValueOnce('second call');
        expect([fn(), fn(), fn(), fn()]).toEqual(['first call', 'second call', 'default', 'default']);
      });
      test('mockImplementation replaces the default', async () => {
        const fn = expect.fn(async () => 'original');
        fn.mockImplementation(async () => 'replaced');
        expect(await fn()).toBe('replaced');
      });
      test('resolved and rejected once chains', async () => {
        const fn = expect.fn()
            .mockResolvedValueOnce('first')
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValue('rest');
        expect(await fn()).toBe('first');
        await expect(fn()).rejects.toThrow('boom');
        expect(await fn()).toBe('rest');
        expect(await fn()).toBe('rest');
        await expect(fn).toHaveResolvedTimes(3);
      });
      test('mock names', async () => {
        const fn = expect.fn();
        expect(fn.getMockName()).toBe('expect.fn()');
        fn.mockName('onChange');
        expect(fn.getMockName()).toBe('onChange');
      });
      test('mock state', async () => {
        const fn = expect.fn().mockReturnValue('v');
        expect(fn.mock.lastCall).toBe(undefined);
        fn(1);
        fn(2);
        expect(fn.mock.calls).toEqual([[1], [2]]);
        expect(fn.mock.results).toEqual([{ type: 'return', value: 'v' }, { type: 'return', value: 'v' }]);
        expect(fn.mock.settledResults).toEqual([{ type: 'fulfilled', value: 'v' }, { type: 'fulfilled', value: 'v' }]);
        expect(fn.mock.lastCall).toEqual([2]);
      });
      test('settled results track promise state', async () => {
        const fn = expect.fn(async (n: number) => n + 1);
        const promise = fn(1);
        expect(fn.mock.settledResults).toEqual([{ type: 'incomplete', value: undefined }]);
        expect(fn.mock.results[0].value).toBeInstanceOf(Promise);
        await promise;
        await expect(fn).toHaveResolvedWith(2);
        expect(fn.mock.settledResults).toEqual([{ type: 'fulfilled', value: 2 }]);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(7);
});

test('should list received calls in the failure message', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('calledWith mismatch', async () => {
        const fn = expect.fn();
        fn('actual', 1);
        fn();
        await expect.configure({ timeout: 500 })(fn).toHaveBeenCalledWith('expected');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('expect(expect.fn()).toHaveBeenCalledWith(...expected)');
  expect(result.output).toContain('Received calls:');
  expect(result.output).toContain('called with 0 arguments');
  expect(result.output).toContain('Number of calls:');
});

test('should work with soft assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('soft', async () => {
        const fn = expect.fn();
        await expect.configure({ timeout: 100 }).soft(fn).toHaveBeenCalled();
        expect(test.info().errors.length).toBe(1);
        fn();
        await expect.soft(fn).toHaveBeenCalled();
        expect(test.info().errors.length).toBe(1);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Expected number of calls: >= 1');
});
