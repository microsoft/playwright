const { TestRunner } = require('../TestRunner');
const { TestCollector, FocusedFilter, Repeater } = require('../TestCollector');
const { TestExpectation, Environment } = require('../Test');

class Runner {
  constructor(options = {}) {
    this._options = options;
    this._filter = new FocusedFilter();
    this._repeater = new Repeater();
    this._collector = new TestCollector(options);
    this._collector.addSuiteAttribute('only', s => this._filter.focusSuite(s));
    this._collector.addTestAttribute('only', t => this._filter.focusTest(t));
    this._collector.addSuiteAttribute('skip', s => s.setSkipped(true));
    this._collector.addTestAttribute('skip', t => t.setSkipped(true));
    this._collector.addTestAttribute('fail', t => t.setExpectation(t.Expectations.Fail));
    this._collector.addSuiteModifier('repeat', (s, count) => this._repeater.repeat(s, count));
    this._collector.addTestModifier('repeat', (t, count) => this._repeater.repeat(t, count));

    const api = this._collector.api();
    for (const [key, value] of Object.entries(api))
      this[key] = value;
    this.fdescribe = api.describe.only;
    this.xdescribe = api.describe.skip;
    this.fit = api.it.only;
    this.xit = api.it.skip;
    this.Expectations = { ...TestExpectation };
  }

  createTestRuns() {
    return this._repeater.createTestRuns(this._filter.filter(this._collector.tests()));
  }

  run() {
    this._testRunner = new TestRunner();
    return this._testRunner.run(this.createTestRuns(), this._options);
  }

  tests() {
    return this._collector.tests();
  }

  focusedTests() {
    return this._filter.focusedTests(this._collector.tests());
  }

  suites() {
    return this._collector.suites();
  }

  focusedSuites() {
    return this._filter.focusedSuites(this._collector.suites());
  }

  terminate() {
    this._testRunner.terminate();
  }
}

module.exports.addTests = function({describe, fdescribe, xdescribe, it, xit, fit, expect}) {
  describe('TestRunner.it', () => {
    it('should declare a test', async() => {
      const t = new Runner();
      t.it('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name()).toBe('uno');
      expect(test.fullName()).toBe('uno');
      expect(test.skipped()).toBe(false);
      expect(test.location().filePath()).toEqual(__filename);
      expect(test.location().fileName()).toEqual('testrunner.spec.js');
      expect(test.location().lineNumber()).toBeTruthy();
      expect(test.location().columnNumber()).toBeTruthy();
    });
    it('should run a test', async() => {
      const t = new Runner();
      t.it('uno', () => {});
      const result = await t.run();
      expect(result.runs.length).toBe(1);
      expect(result.runs[0].test()).toBe(t.tests()[0]);
      expect(result.runs[0].result()).toBe('ok');
    });
  });

  describe('TestRunner.xit', () => {
    it('should declare a skipped test', async() => {
      const t = new Runner();
      t.xit('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name()).toBe('uno');
      expect(test.fullName()).toBe('uno');
      expect(test.skipped()).toBe(true);
    });
    it('should not run a skipped test', async() => {
      const t = new Runner();
      t.xit('uno', () => {});
      const result = await t.run();
      expect(result.runs.length).toBe(1);
      expect(result.runs[0].test()).toBe(t.tests()[0]);
      expect(result.runs[0].result()).toBe('skipped');
    });
  });

  describe('TestRunner.fit', () => {
    it('should declare a focused test', async() => {
      const t = new Runner();
      t.fit('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name()).toBe('uno');
      expect(test.fullName()).toBe('uno');
      expect(test.skipped()).toBe(false);
      expect(t.focusedTests()[0]).toBe(test);
    });
    it('should run a focused test', async() => {
      const t = new Runner();
      t.fit('uno', () => {});
      const result = await t.run();
      expect(result.runs.length).toBe(1);
      expect(result.runs[0].test()).toBe(t.tests()[0]);
      expect(result.runs[0].result()).toBe('ok');
    });
    it('should run a failed focused test', async() => {
      const t = new Runner();
      let run = false;
      t.it.only.fail('uno', () => {
        run = true; throw new Error('failure');
      });
      expect(t.focusedTests().length).toBe(1);
      expect(t.tests()[0].expectation()).toBe(t.Expectations.Fail);
      const result = await t.run();
      expect(run).toBe(true);
      expect(result.runs.length).toBe(1);
      expect(result.runs[0].test()).toBe(t.tests()[0]);
      expect(result.runs[0].result()).toBe('failed');
    });
  });

  describe('TestRunner.describe', () => {
    it('should declare a suite', async() => {
      const t = new Runner();
      t.describe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name()).toBe('uno');
      expect(test.fullName()).toBe('suite uno');
      expect(test.skipped()).toBe(false);
      expect(test.suite().name()).toBe('suite');
      expect(test.suite().fullName()).toBe('suite');
      expect(test.suite().skipped()).toBe(false);
    });
  });

  describe('TestRunner.xdescribe', () => {
    it('should declare a skipped suite', async() => {
      const t = new Runner();
      t.xdescribe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.skipped()).toBe(false);
      expect(test.suite().skipped()).toBe(true);
    });
    it('focused tests inside a skipped suite are not run', async() => {
      const t = new Runner();
      let run = false;
      t.xdescribe('suite', () => {
        t.fit('uno', () => { run = true; });
      });
      const result = await t.run();
      expect(run).toBe(false);
      expect(result.runs.length).toBe(1);
      expect(result.runs[0].test()).toBe(t.tests()[0]);
      expect(result.runs[0].result()).toBe('skipped');
    });
  });

  describe('TestRunner.fdescribe', () => {
    it('should declare a focused suite', async() => {
      const t = new Runner();
      t.fdescribe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.skipped()).toBe(false);
      expect(t.focusedSuites()[0]).toBe(test.suite());
      expect(test.suite().skipped()).toBe(false);
    });
    it('skipped tests inside a focused suite should not be run', async() => {
      const t = new Runner();
      t.fdescribe('suite', () => {
        t.xit('uno', () => {});
      });
      const result = await t.run();
      expect(result.runs.length).toBe(1);
      expect(result.runs[0].test()).toBe(t.tests()[0]);
      expect(result.runs[0].result()).toBe('skipped');
    });
    it('should run all "run" tests inside a focused suite', async() => {
      const log = [];
      const t = new Runner();
      t.it('uno', () => log.push(1));
      t.fdescribe('suite1', () => {
        t.it('dos', () => log.push(2));
        t.it('tres', () => log.push(3));
      });
      t.it('cuatro', () => log.push(4));
      await t.run();
      expect(log.join()).toBe('2,3');
    });
    it('should run only "focus" tests inside a focused suite', async() => {
      const log = [];
      const t = new Runner();
      t.it('uno', () => log.push(1));
      t.fdescribe('suite1', () => {
        t.fit('dos', () => log.push(2));
        t.it('tres', () => log.push(3));
      });
      t.it('cuatro', () => log.push(4));
      await t.run();
      expect(log.join()).toBe('2');
    });
    it('should run both "run" tests in focused suite and non-descendant focus tests', async() => {
      const log = [];
      const t = new Runner();
      t.it('uno', () => log.push(1));
      t.fdescribe('suite1', () => {
        t.it('dos', () => log.push(2));
        t.it('tres', () => log.push(3));
      });
      t.fit('cuatro', () => log.push(4));
      await t.run();
      expect(log.join()).toBe('2,3,4');
    });
  });

  describe('TestRunner attributes', () => {
    it('should work', async() => {
      const t = new Runner({timeout: 123});
      const log = [];

      t._collector.addTestModifier('foo', (t, ...args) => {
        log.push('foo');

        expect(t.skipped()).toBe(false);
        expect(t.Expectations.Ok).toBeTruthy();
        expect(t.Expectations.Fail).toBeTruthy();
        expect(t.expectation()).toBe(t.Expectations.Ok);
        expect(t.timeout()).toBe(123);

        expect(args.length).toBe(2);
        expect(args[0]).toBe('uno');
        expect(args[1]).toBe('dos');

        t.setExpectation(t.Expectations.Fail);
        t.setTimeout(234);
      });

      t._collector.addTestAttribute('bar', t => {
        log.push('bar');
        t.setSkipped(true);
        expect(t.skipped()).toBe(true);
        expect(t.expectation()).toBe(t.Expectations.Fail);
        expect(t.timeout()).toBe(234);
      });

      t.it.foo('uno', 'dos').bar('test', () => { });
      expect(log).toEqual(['foo', 'bar']);
    });
  });

  describe('TestRunner hooks', () => {
    it('should run all hooks in proper order', async() => {
      const log = [];
      const t = new Runner();
      const e = new Environment('env');
      e.beforeAll(() => log.push('env:beforeAll'));
      e.afterAll(() => log.push('env:afterAll'));
      e.beforeEach(() => log.push('env:beforeEach'));
      e.afterEach(() => log.push('env:afterEach'));
      const e2 = new Environment('env2', e);
      e2.beforeAll(() => log.push('env2:beforeAll'));
      e2.afterAll(() => log.push('env2:afterAll'));
      t.beforeAll(() => log.push('root:beforeAll'));
      t.beforeEach(() => log.push('root:beforeEach1'));
      t.beforeEach(() => log.push('root:beforeEach2'));
      t.it('uno', () => log.push('test #1'));
      t.describe('suite1', () => {
        t.beforeAll(() => log.push('suite:beforeAll1'));
        t.beforeAll(() => log.push('suite:beforeAll2'));
        t.beforeEach(() => log.push('suite:beforeEach'));
        t.it('dos', () => log.push('test #2'));
        t.tests()[t.tests().length - 1].environment().beforeEach(() => log.push('test:before1'));
        t.tests()[t.tests().length - 1].environment().beforeEach(() => log.push('test:before2'));
        t.tests()[t.tests().length - 1].environment().afterEach(() => log.push('test:after1'));
        t.tests()[t.tests().length - 1].environment().afterEach(() => log.push('test:after2'));
        t.it('tres', () => log.push('test #3'));
        t.tests()[t.tests().length - 1].environment().beforeEach(() => log.push('test:before1'));
        t.tests()[t.tests().length - 1].environment().beforeEach(() => log.push('test:before2'));
        t.tests()[t.tests().length - 1].environment().afterEach(() => log.push('test:after1'));
        t.tests()[t.tests().length - 1].environment().afterEach(() => log.push('test:after2'));
        t.afterEach(() => log.push('suite:afterEach1'));
        t.afterEach(() => log.push('suite:afterEach2'));
        t.afterAll(() => log.push('suite:afterAll'));
      });
      t.it('cuatro', () => log.push('test #4'));
      t.tests()[t.tests().length - 1].addEnvironment(e2);
      t.describe('no hooks suite', () => {
        t.describe('suite2', () => {
          t.beforeAll(() => log.push('suite2:beforeAll'));
          t.afterAll(() => log.push('suite2:afterAll'));
          t.describe('no hooks suite 2', () => {
            t.it('cinco', () => log.push('test #5'));
          });
        });
      });
      t.suites()[t.suites().length - 1].addEnvironment(e2);
      t.afterEach(() => log.push('root:afterEach'));
      t.afterAll(() => log.push('root:afterAll1'));
      t.afterAll(() => log.push('root:afterAll2'));
      await t.run();
      expect(log).toEqual([
        'root:beforeAll',
        'root:beforeEach1',
        'root:beforeEach2',
        'test #1',
        'root:afterEach',

        'suite:beforeAll1',
        'suite:beforeAll2',

        'root:beforeEach1',
        'root:beforeEach2',
        'suite:beforeEach',
        'test:before1',
        'test:before2',
        'test #2',
        'test:after1',
        'test:after2',
        'suite:afterEach1',
        'suite:afterEach2',
        'root:afterEach',

        'root:beforeEach1',
        'root:beforeEach2',
        'suite:beforeEach',
        'test:before1',
        'test:before2',
        'test #3',
        'test:after1',
        'test:after2',
        'suite:afterEach1',
        'suite:afterEach2',
        'root:afterEach',

        'suite:afterAll',

        'env:beforeAll',
        'env2:beforeAll',

        'root:beforeEach1',
        'root:beforeEach2',
        'env:beforeEach',
        'test #4',
        'env:afterEach',
        'root:afterEach',

        'suite2:beforeAll',
        'root:beforeEach1',
        'root:beforeEach2',
        'env:beforeEach',
        'test #5',
        'env:afterEach',
        'root:afterEach',
        'suite2:afterAll',

        'env2:afterAll',
        'env:afterAll',

        'root:afterAll1',
        'root:afterAll2',
      ]);
    });
    it('should remove environment', async() => {
      const log = [];
      const t = new Runner();
      const e = new Environment('env');
      e.beforeAll(() => log.push('env:beforeAll'));
      e.afterAll(() => log.push('env:afterAll'));
      e.beforeEach(() => log.push('env:beforeEach'));
      e.afterEach(() => log.push('env:afterEach'));
      const e2 = new Environment('env2');
      e2.beforeAll(() => log.push('env2:beforeAll'));
      e2.afterAll(() => log.push('env2:afterAll'));
      e2.beforeEach(() => log.push('env2:beforeEach'));
      e2.afterEach(() => log.push('env2:afterEach'));
      t.it('uno', () => log.push('test #1'));
      t.tests()[0].addEnvironment(e).addEnvironment(e2).removeEnvironment(e);
      await t.run();
      expect(log).toEqual([
        'env2:beforeAll',
        'env2:beforeEach',
        'test #1',
        'env2:afterEach',
        'env2:afterAll',
      ]);
    });
    it('should have the same state object in hooks and test', async() => {
      const states = [];
      const t = new Runner();
      t.beforeEach(state => states.push(state));
      t.afterEach(state => states.push(state));
      t.beforeAll(state => states.push(state));
      t.afterAll(state => states.push(state));
      t.it('uno', state => states.push(state));
      await t.run();
      expect(states.length).toBe(5);
      for (let i = 1; i < states.length; ++i)
        expect(states[i]).toBe(states[0]);
    });
    it('should unwind hooks properly when terminated', async() => {
      const log = [];
      const t = new Runner({timeout: 10000});
      t.beforeAll(() => log.push('beforeAll'));
      t.beforeEach(() => log.push('beforeEach'));
      t.afterEach(() => log.push('afterEach'));
      t.afterAll(() => log.push('afterAll'));
      t.it('uno', () => {
        log.push('terminating...');
        t.terminate();
      });
      await t.run();

      expect(log).toEqual([
        'beforeAll',
        'beforeEach',
        'terminating...',
        'afterEach',
        'afterAll',
      ]);
    });
    it('should report as terminated even when hook crashes', async() => {
      const t = new Runner({timeout: 10000});
      t.afterEach(() => { throw new Error('crash!'); });
      t.it('uno', () => { t.terminate(); });
      const result = await t.run();
      expect(result.runs[0].result()).toBe('terminated');
    });
    it('should report as terminated when terminated during hook', async() => {
      const t = new Runner({timeout: 10000});
      t.afterEach(() => { t.terminate(); });
      t.it('uno', () => { });
      const result = await t.run();
      expect(result.runs[0].result()).toBe('terminated');
    });
    it('should unwind hooks properly when crashed', async() => {
      const log = [];
      const t = new Runner({timeout: 10000});
      t.beforeAll(() => log.push('root beforeAll'));
      t.beforeEach(() => log.push('root beforeEach'));
      t.describe('suite', () => {
        t.beforeAll(() => log.push('suite beforeAll'));
        t.beforeEach(() => log.push('suite beforeEach'));
        t.it('uno', () => log.push('uno'));
        t.afterEach(() => {
          log.push('CRASH >> suite afterEach');
          throw new Error('crash!');
        });
        t.afterAll(() => log.push('suite afterAll'));
      });
      t.afterEach(() => log.push('root afterEach'));
      t.afterAll(() => log.push('root afterAll'));
      await t.run();

      expect(log).toEqual([
        'root beforeAll',
        'suite beforeAll',
        'root beforeEach',
        'suite beforeEach',
        'uno',
        'CRASH >> suite afterEach',
        'root afterEach',
        'suite afterAll',
        'root afterAll'
      ]);
    });
  });

  describe('TestRunner.run', () => {
    it('should run a test', async() => {
      const t = new Runner();
      let ran = false;
      t.it('uno', () => ran = true);
      await t.run();
      expect(ran).toBe(true);
    });
    it('should handle repeat', async() => {
      const t = new Runner();
      let suite = 0;
      let test = 0;
      let beforeAll = 0;
      let beforeEach = 0;
      t.describe.repeat(2)('suite', () => {
        suite++;
        t.beforeAll(() => beforeAll++);
        t.beforeEach(() => beforeEach++);
        t.it.repeat(3)('uno', () => test++);
      });
      await t.run();
      expect(suite).toBe(1);
      expect(beforeAll).toBe(1);
      expect(beforeEach).toBe(6);
      expect(test).toBe(6);
    });
    it('should repeat without breaking test order', async() => {
      const t = new Runner();
      const log = [];
      t.describe.repeat(2)('suite', () => {
        t.it('uno', () => log.push(1));
        t.it.repeat(2)('dos', () => log.push(2));
      });
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,2,2,1,2,2,3');
    });
    it('should run tests if some fail', async() => {
      const t = new Runner();
      const log = [];
      t.it('uno', () => log.push(1));
      t.it('dos', () => { throw new Error('bad'); });
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should run tests if some timeout', async() => {
      const t = new Runner({timeout: 1});
      const log = [];
      t.it('uno', () => log.push(1));
      t.it('dos', async() => new Promise(() => {}));
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should break on first failure if configured so', async() => {
      const log = [];
      const t = new Runner({breakOnFailure: true});
      t.it('test#1', () => log.push('test#1'));
      t.it('test#2', () => log.push('test#2'));
      t.it('test#3', () => { throw new Error('crash'); });
      t.it('test#4', () => log.push('test#4'));
      await t.run();
      expect(log).toEqual([
        'test#1',
        'test#2',
      ]);
    });
    it('should pass a state and a test as a test parameters', async() => {
      const log = [];
      const t = new Runner();
      t.beforeEach(state => state.FOO = 42);
      t.it('uno', (state, testRun) => {
        log.push('state.FOO=' + state.FOO);
        log.push('test=' + testRun.test().name());
      });
      await t.run();
      expect(log.join()).toBe('state.FOO=42,test=uno');
    });
    it('should run async test', async() => {
      const t = new Runner();
      let ran = false;
      t.it('uno', async() => {
        await new Promise(x => setTimeout(x, 10));
        ran = true;
      });
      await t.run();
      expect(ran).toBe(true);
    });
    it('should run async tests in order of their declaration', async() => {
      const log = [];
      const t = new Runner();
      t.it('uno', async() => {
        await new Promise(x => setTimeout(x, 30));
        log.push(1);
      });
      t.it('dos', async() => {
        await new Promise(x => setTimeout(x, 20));
        log.push(2);
      });
      t.it('tres', async() => {
        await new Promise(x => setTimeout(x, 10));
        log.push(3);
      });
      await t.run();
      expect(log.join()).toBe('1,2,3');
    });
    it('should run multiple tests', async() => {
      const log = [];
      const t = new Runner();
      t.it('uno', () => log.push(1));
      t.it('dos', () => log.push(2));
      await t.run();
      expect(log.join()).toBe('1,2');
    });
    it('should NOT run a skipped test', async() => {
      const t = new Runner();
      let ran = false;
      t.xit('uno', () => ran = true);
      await t.run();
      expect(ran).toBe(false);
    });
    it('should run ONLY non-skipped tests', async() => {
      const log = [];
      const t = new Runner();
      t.it('uno', () => log.push(1));
      t.xit('dos', () => log.push(2));
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should run ONLY focused tests', async() => {
      const log = [];
      const t = new Runner();
      t.it('uno', () => log.push(1));
      t.xit('dos', () => log.push(2));
      t.fit('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('3');
    });
    it('should run tests in order of their declaration', async() => {
      const log = [];
      const t = new Runner();
      t.it('uno', () => log.push(1));
      t.describe('suite1', () => {
        t.it('dos', () => log.push(2));
        t.it('tres', () => log.push(3));
      });
      t.it('cuatro', () => log.push(4));
      await t.run();
      expect(log.join()).toBe('1,2,3,4');
    });
    it('should respect total timeout', async() => {
      const t = new Runner({timeout: 10000, totalTimeout: 1});
      t.it('uno', async () => { await new Promise(() => {}); });
      const result = await t.run();
      expect(result.runs[0].result()).toBe('terminated');
      expect(result.message).toContain('Total timeout');
    });
  });

  describe('TestRunner.run result', () => {
    it('should return OK if all tests pass', async() => {
      const t = new Runner();
      t.it('uno', () => {});
      const result = await t.run();
      expect(result.result).toBe('ok');
    });
    it('should return FAIL if at least one test fails', async() => {
      const t = new Runner();
      t.it('uno', () => { throw new Error('woof'); });
      const result = await t.run();
      expect(result.result).toBe('failed');
    });
    it('should return FAIL if at least one test times out', async() => {
      const t = new Runner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      const result = await t.run();
      expect(result.result).toBe('failed');
    });
    it('should return TERMINATED if it was terminated', async() => {
      const t = new Runner({timeout: 1000000});
      t.it('uno', async() => new Promise(() => {}));
      const [result] = await Promise.all([
        t.run(),
        t.terminate(),
      ]);
      expect(result.result).toBe('terminated');
    });
    it('should return CRASHED if it crashed', async() => {
      const t = new Runner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      t.afterAll(() => { throw new Error('woof');});
      const result = await t.run();
      expect(result.result).toBe('crashed');
    });
  });

  describe('TestRunner parallel', () => {
    it('should run tests in parallel', async() => {
      const log = [];
      const t = new Runner({parallel: 2});
      t.it('uno', async state => {
        log.push(`Worker #${state.parallelIndex} Starting: UNO`);
        await Promise.resolve();
        log.push(`Worker #${state.parallelIndex} Ending: UNO`);
      });
      t.it('dos', async state => {
        log.push(`Worker #${state.parallelIndex} Starting: DOS`);
        await Promise.resolve();
        log.push(`Worker #${state.parallelIndex} Ending: DOS`);
      });
      await t.run();
      expect(log).toEqual([
        'Worker #0 Starting: UNO',
        'Worker #1 Starting: DOS',
        'Worker #0 Ending: UNO',
        'Worker #1 Ending: DOS',
      ]);
    });
  });

  describe('TestRunner.hasFocusedTestsOrSuitesOrFiles', () => {
    it('should work', () => {
      const t = new Runner();
      t.it('uno', () => {});
      expect(t._filter.hasFocusedTestsOrSuitesOrFiles()).toBe(false);
    });
    it('should work #2', () => {
      const t = new Runner();
      t.fit('uno', () => {});
      expect(t._filter.hasFocusedTestsOrSuitesOrFiles()).toBe(true);
    });
    it('should work #3', () => {
      const t = new Runner();
      t.describe('suite #1', () => {
        t.fdescribe('suite #2', () => {
          t.describe('suite #3', () => {
            t.it('uno', () => {});
          });
        });
      });
      expect(t._filter.hasFocusedTestsOrSuitesOrFiles()).toBe(true);
    });
  });

  describe('TestRunner result', () => {
    it('should work for both throwing and timeouting tests', async() => {
      const t = new Runner({timeout: 1});
      t.it('uno', () => { throw new Error('boo');});
      t.it('dos', () => new Promise(() => {}));
      const result = await t.run();
      expect(result.runs[0].result()).toBe('failed');
      expect(result.runs[1].result()).toBe('timedout');
    });
    it('should report crashed tests', async() => {
      const t = new Runner();
      t.beforeEach(() => { throw new Error('woof');});
      t.it('uno', () => {});
      const result = await t.run();
      expect(result.runs[0].result()).toBe('crashed');
    });
    it('skipped should work for both throwing and timeouting tests', async() => {
      const t = new Runner({timeout: 1});
      t.xit('uno', () => { throw new Error('boo');});
      const result = await t.run();
      expect(result.runs[0].result()).toBe('skipped');
    });
    it('should return OK', async() => {
      const t = new Runner();
      t.it('uno', () => {});
      const result = await t.run();
      expect(result.runs[0].result()).toBe('ok');
    });
    it('should return TIMEDOUT', async() => {
      const t = new Runner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      const result = await t.run();
      expect(result.runs[0].result()).toBe('timedout');
    });
    it('should return SKIPPED', async() => {
      const t = new Runner();
      t.xit('uno', () => {});
      const result = await t.run();
      expect(result.runs[0].result()).toBe('skipped');
    });
    it('should return FAILED', async() => {
      const t = new Runner();
      t.it('uno', async() => Promise.reject('woof'));
      const result = await t.run();
      expect(result.runs[0].result()).toBe('failed');
    });
    it('should return TERMINATED', async() => {
      const t = new Runner();
      t.it('uno', async() => t.terminate());
      const result = await t.run();
      expect(result.runs[0].result()).toBe('terminated');
    });
    it('should return CRASHED', async() => {
      const t = new Runner();
      t.it('uno', () => {});
      t.afterEach(() => {throw new Error('foo');});
      const result = await t.run();
      expect(result.runs[0].result()).toBe('crashed');
    });
  });

  describe('TestRunner delegate', () => {
    it('should call delegate methods in proper order', async() => {
      const log = [];
      const t = new Runner({
        onStarted: () => log.push('E:started'),
        onTestRunStarted: () => log.push('E:teststarted'),
        onTestRunFinished: () => log.push('E:testfinished'),
        onFinished: () => log.push('E:finished'),
      });
      t.beforeAll(() => log.push('beforeAll'));
      t.beforeEach(() => log.push('beforeEach'));
      t.it('test#1', () => log.push('test#1'));
      t.afterEach(() => log.push('afterEach'));
      t.afterAll(() => log.push('afterAll'));
      await t.run();
      expect(log).toEqual([
        'E:started',
        'beforeAll',
        'E:teststarted',
        'beforeEach',
        'test#1',
        'afterEach',
        'E:testfinished',
        'afterAll',
        'E:finished',
      ]);
    });
    it('should call onFinished with result', async() => {
      let onFinished;
      const finishedPromise = new Promise(f => onFinished = f);
      const [result] = await Promise.all([
        finishedPromise,
        new TestRunner().run([], { onFinished }),
      ]);
      expect(result.result).toBe('ok');
    });
    it('should crash when onStarted throws', async() => {
      const t = new Runner({
        onStarted: () => { throw 42; },
      });
      const result = await t.run();
      expect(result.ok()).toBe(false);
      expect(result.message).toBe('INTERNAL ERROR: 42');
    });
    it('should crash when onFinished throws', async() => {
      const t = new Runner({
        onFinished: () => { throw new Error('42'); },
      });
      const result = await t.run();
      expect(result.ok()).toBe(false);
      expect(result.message).toBe('INTERNAL ERROR');
      expect(result.result).toBe('crashed');
    });
  });
};

