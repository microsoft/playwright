/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {registerFixture} from '..';
import {Suite, Test} from '../lib/test';
import {makeApi} from '../lib/spec';
import { FixturePool } from '../lib/fixtures';
declare global {
  interface TestState {
    suite: Suite;
    api: ReturnType<typeof makeApi>;
    runTests: (timeout?: number) => Promise<{status: 'pass'|'fail'|'skip', error?: any, test: Test}[]>
  }
}
registerFixture('suite', async ({}, runTest) => {
  await runTest(new Suite(''));
});
registerFixture('api', async ({suite}, runTest) => {
  await runTest(makeApi(suite, __filename, 1000));
});
registerFixture('runTests', async ({suite}, runTest) => {
  await runTest(async(timeout = 500) => {
    const results = [];
    suite.filterOnly();
    await suite.run({
      fixturePool: new FixturePool(),
      onResult: (test, status, error) => {
        results.push({status, error, test});
      },
      onTestStart: test => {},
      testFilter: test => true,
      timeout,
      trialRun: false
    });
    return results;
  });
});

describe('it', () => {
  it('should run a test', async ({api, runTests}) => {
    let tested = false;
    api.it('is a test', () => tested = true);
    const [{status, error}] = await runTests();
    expect(status).toBe('pass');
    expect(tested).toBe(true);
    expect(error).toBeUndefined();
  });
  
  it('should fail test', async ({api, runTests}) => {
    api.it('is a test', () => {
      throw 'not an error';
    });
    const [{status, error}] = await runTests();
    expect(status).toBe('fail');
    expect(error).toBe('not an error');
  });

  it('should allow throwing null', async ({api, runTests}) => {
    api.it('is a test', () => {
      throw null;
    });
    const [{status, error}] = await runTests();
    expect(status).toBe('fail');
    expect(error).toBe(null);
  });

  it('should allow throwing undefined', async ({api, runTests}) => {
    api.it('is a test', () => {
      throw undefined;
    });
    const [{status, error}] = await runTests();
    expect(status).toBe('fail');
    expect(error).toBe(undefined);
  });
});

describe('describe', () => {
  it('should use support anonymous describe', async ({api, runTests}) => {
    api.describe(() => {
      api.it('first test', () => void 0);
      api.it('second test', () => void 0);
      api.it('third test', () => void 0);
    });
    const tests = (await runTests()).map(t => t.test);
    expect(tests.map(test => test.fullTitle())).toEqual([
      'first test',
      'second test',
      'third test'
    ]);
  });

  it('should use describe to group tests', async ({api, runTests}) => {
    api.describe('', () => {
      api.it('first test', () => void 0);
      api.it('second test', () => void 0);
      api.it('third test', () => void 0);
    });
    const tests = (await runTests()).map(t => t.test);
    expect(tests.map(test => test.fullTitle())).toEqual([
      'first test',
      'second test',
      'third test'
    ]);
  });

  it('should support nested describe', async ({api, runTests}) => {
    api.describe('outer', () => {
      api.it('first test', () => void 0);
      api.describe('inner', () => {
        api.it('second test', () => void 0);
      });
    });
    const tests = (await runTests()).map(t => t.test);
    expect(tests.map(test => test.fullTitle())).toEqual([
      'outer first test',
      'outer inner second test',
    ]);
  });

  it.fail(true)('should support async describe', async ({api, runTests}) => {
    api.describe('async describe', async () => {
      api.it('first test', () => void 0);
      await new Promise(x => setTimeout(x, 0));
      api.it('second test', () => void 0);
    });
    const tests = (await runTests()).map(t => t.test);
    expect(tests.map(test => test.fullTitle())).toEqual([
      'async describe first test',
      'async describe second test',
    ]);
  });

  it.fail(true)('should tricky async scenarios', async ({api, runTests}) => {
    api.describe('async describe', async () => {
      api.it('first test', () => void 0);
      await new Promise(x => setTimeout(x, 0));
      api.describe('suite a', async () => {
        api.it('second test', () => void 0);
        await new Promise(x => setTimeout(x, 10));
        api.it('third test', () => void 0);
      });
      api.it('fourth test', () => void 0);

      api.describe('suite b', async () => {
        api.describe('child 1', async () => {
          api.it('fifth test', () => void 0);
          await new Promise(x => setTimeout(x, 5));
          api.it('sixth test', () => void 0);
        });
        api.it('seventh test', () => void 0);
        await new Promise(x => setTimeout(x, 5));
        api.it('eighth test', () => void 0);

        api.describe('child 2', async () => {
          api.it('nineth test', () => void 0);
          await new Promise(x => setTimeout(x, 5));
          api.it('tenth test', () => void 0);
        });
      });
    });
    const tests = (await runTests()).map(t => t.test);
    expect(tests.map(test => test.fullTitle())).toEqual([
      'async describe first test',
      'async describe suite a second test',
      'async describe suite a third test',
      'async describe fourth test',
      'async describe suite b child 1 fifth test',
      'async describe suite b child 1 sixth test',
      'async describe suite b seventh test',
      'async describe suite b eighth test',
      'async describe suite b child 2 nineth test',
      'async describe suite b child 2 tenth test',
    ]);
  });
});

describe('focus and skip', () => {
  it('should run only the focused test', async ({api, runTests}) => {
    const ran = [];
    api.it('a', () => ran.push('a'));
    api.fit('b', () => ran.push('b'));
    api.it('c', () => ran.push('c'));
    const results = await runTests();
    expect(ran).toEqual(['b']);
    expect(results.map(result => result.status)).toEqual(['pass']);
  });
  it('should not run the skipped test', async ({api, runTests}) => {
    const ran = [];
      api.it('a', () => ran.push('a'));
      api.xit('b', () => ran.push('b'));
      api.it('c', () => ran.push('c'));
    const results = await runTests();
    expect(ran).toEqual(['a', 'c']);
    expect(results.map(result => result.status)).toEqual(['pass', 'skip', 'pass']);
  });
  it('should work with describes', async ({api, runTests}) => {
    const ran = [];
    api.fdescribe(() => {
      api.it('a', () => ran.push('a'));
    });
    api.describe(() => {
      api.fit('b', () => ran.push('b'));
      api.it('c', () => ran.push('c'));
    });
    api.fdescribe(() => {
      api.fit('d', () => ran.push('d'));
      api.it('e', () => ran.push('e'));
    });
    const results = await runTests();
    expect(ran).toEqual(['a', 'b', 'd']);
    expect(results.map(result => result.status)).toEqual(['pass', 'pass', 'pass']);
  });
});

describe('timeout', () => {
  it('should handle test timeout', async ({api, runTests}) => {
    api.describe(() => {
      api.it('test', () => new Promise(() => {}));
    });
    const results = await runTests(1);
    expect(results[0].status).toEqual('fail');
    expect(results[0].error.message).toEqual('Timeout of 1ms exceeded');
  });
  it('should handle hook timeout', async ({api, runTests} ) => {
    const log = [];
    api.describe(() => {
      api.beforeEach(() => {
        log.push('before');
        return new Promise(() => {});
      });
      api.afterEach(() => log.push('after'));
      api.it('test', () => log.push('test'));
    });
    const results = await runTests(1);
    expect(log).toEqual(['before']);
    expect(results[0].status).toEqual('fail');
    expect(results[0].error.message).toEqual('Timeout of 1ms exceeded');
  });
});

describe('hooks', () => {
  it('should run once or with every test', async ({api, runTests}) => {
    const log = [];
    api.describe(() => {
      api.beforeAll(() => log.push('beforeAll'));
      api.afterAll(() => log.push('afterAll'));
      api.beforeEach(() => log.push('beforeEach'));
      api.afterEach(() => log.push('afterEach'));
      api.it('first test', () => log.push('first'));
      api.it('second test', () => log.push('second'));
    });
    await runTests();
    expect(log).toEqual(['beforeAll', 'beforeEach', 'first', 'afterEach', 'beforeEach', 'second', 'afterEach', 'afterAll']);
  });
  it('should setup and teardown state', async ({api, runTests}) => {
    api.describe(() => {
      let bar;
      let foo;
      api.beforeAll(() => bar = true);
      api.beforeEach(() => {
        expect(bar).toEqual(true);
        foo = true;
      });
      api.afterEach(() => {
        expect(bar).toEqual(true);
        expect(foo).toEqual(true);
        foo = false;
      });
      api.afterAll(() => {
        expect(bar).toEqual(true);
        expect(foo).toEqual(false);
      });
      api.it('test', () => {
        expect(foo).toEqual(true);
        expect(bar).toEqual(true);
      });
    });
    const results = await runTests();
    expect(results.map(r => r.test.fullTitle())).toEqual(['test']);
    expect(results.map(r => r.status)).toEqual(['pass']);
  });
  it('should run in order', async ({api, runTests}) => {
    const log = [];
    api.describe(() => {
      api.beforeAll(() => log.push('ba1'));
      api.beforeAll(() => log.push('ba2'));
      api.beforeEach(() => log.push('b1'));
      api.beforeEach(() => log.push('b2'));
      api.beforeEach(() => log.push('b3'));
      api.afterEach(() => log.push('a1'));
      api.afterEach(() => log.push('a2'));
      api.afterEach(() => log.push('a3'));
      api.afterAll(() => log.push('aa1'));
      api.afterAll(() => log.push('aa2'));
      api.it('test', () => log.push('test'));
    });
    await runTests();
    expect(log).toEqual(['ba1', 'ba2', 'b1', 'b2', 'b3', 'test', 'a3', 'a2', 'a1', 'aa2', 'aa1']);
  });
  it('should work with nested describes', async ({api, runTests}) => {
    const log = [];
    api.describe(() => {
      api.beforeAll(() => log.push('ba1'));
      api.afterAll(() => log.push('aa1'));
      api.beforeEach(() => log.push('b1'));
      api.afterEach(() => log.push('a1'));

      api.it('outer first', () => {
        log.push('outer first');
      });

      api.describe(() => {
        api.describe(() => {
          api.beforeAll(() => log.push('ba2'));
          api.afterAll(() => log.push('aa2'));

          api.beforeEach(() => log.push('b2'));
          api.afterEach(() => log.push('a2'));
          api.describe(() => {
            api.it('inner',() => {
              log.push('inner')
            });
          });
        });
      });

      api.it('outer last', () => {
        log.push('outer last');
      });
    });
    const results = await runTests();
    expect(results.map(r => r.test.fullTitle())).toEqual(['outer first', 'inner', 'outer last']);
    expect(results.map(r => r.status)).toEqual(['pass', 'pass', 'pass']);
    expect(log).toEqual(['ba1','b1', 'outer first', 'a1', 'ba2', 'b1', 'b2', 'inner', 'a2', 'a1', 'aa2', 'b1', 'outer last', 'a1', 'aa1']);
  });
  fit('should fail in a beforeAll', async ({api, runTests}) => {
    let i = 0;
    const log = [];
    api.beforeAll(() => {
      log.push('beforeAll');
      throw 'my error ' + ++i
    });
    api.it('test 1', () => log.push('test 1'));
    api.it('test 2', () => log.push('test 2'));
    const results = await runTests();
    expect(log).toEqual(['beforeAll']);
    expect(results.map(r => r.status)).toEqual(['fail', 'fail']);
    expect(results.map(r => r.error)).toEqual(['my error 1', 'my error 1']);
  });
  fit('should fail in a beforeEach', async ({api, runTests}) => {
    let i = 0;
    const log = [];
    api.beforeEach(() => {
      log.push('beforeEach');
      throw 'my error ' + ++i
    });
    api.it('test 1', () => log.push('test 1'));
    api.it('test 2', () => log.push('test 2'));
    const results = await runTests();
    expect(log).toEqual(['beforeEach', 'beforeEach']);
    expect(results.map(r => r.status)).toEqual(['fail', 'fail']);
    expect(results.map(r => r.error)).toEqual(['my error 1', 'my error 2']);
  });
  fit('should fail in an afterEach', async ({api, runTests}) => {
    let i = 0;
    const log = [];
    api.afterEach(() => {
      log.push('afterEach');
      throw 'my error ' + ++i
    });
    api.it('test 1', () => log.push('test 1'));
    api.it('test 2', () => log.push('test 2'));
    const results = await runTests();
    expect(log).toEqual(['test 1', 'afterEach', 'test 2', 'afterEach']);
    expect(results.map(r => r.status)).toEqual(['fail', 'fail']);
    expect(results.map(r => r.error)).toEqual(['my error 1', 'my error 2']);
  });
  fit('should fail in an afterAll', async ({api, runTests}) => {
    let i = 0;
    const log = [];
    api.afterAll(() => {
      log.push('afterAll');
      throw 'my error ' + ++i
    });
    api.it('test 1', () => log.push('test 1'));
    api.it('test 2', () => log.push('test 2'));
    const results = await runTests();
    expect(log).toEqual(['test 1', 'test 2', 'afterAll']);
    // afterAll errors actually don't cause tests to fail.
    expect(results.map(r => r.status)).toEqual(['pass', 'pass']);
  });
});
