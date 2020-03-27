const {TestRunner} = require('..');

function newTestRunner(options) {
  return new TestRunner({
    crashIfTestsAreFocusedOnCI: false,
    ...options,
  });
}

module.exports.addTests = function({testRunner, expect}) {
  const {describe, fdescribe, xdescribe} = testRunner;
  const {it, xit, fit} = testRunner;

  describe('TestRunner.it', () => {
    it('should declare a test', async() => {
      const t = newTestRunner();
      t.it('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name()).toBe('uno');
      expect(test.fullName()).toBe('uno');
      expect(test.effectiveMode()).toBe('run');
      expect(test.location().filePath).toEqual(__filename);
      expect(test.location().fileName).toEqual('testrunner.spec.js');
      expect(test.location().lineNumber).toBeTruthy();
      expect(test.location().columnNumber).toBeTruthy();
    });
  });

  describe('TestRunner.xit', () => {
    it('should declare a skipped test', async() => {
      const t = newTestRunner();
      t.xit('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name()).toBe('uno');
      expect(test.fullName()).toBe('uno');
      expect(test.effectiveMode()).toBe('skip');
    });
  });

  describe('TestRunner.fit', () => {
    it('should declare a focused test', async() => {
      const t = newTestRunner();
      t.fit('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name()).toBe('uno');
      expect(test.fullName()).toBe('uno');
      expect(test.effectiveMode()).toBe('focus');
    });
    it('should run a failed focused test', async() => {
      const t = newTestRunner();
      let run = false;
      t.fit.fail(true)('uno', () => { run = true; throw new Error('failure'); });
      expect(t.tests().length).toBe(1);
      await t.run();
      expect(run).toBe(true);
      expect(t.failedTests()[0].name()).toBe('uno');
    });
  });

  describe('TestRunner.describe', () => {
    it('should declare a suite', async() => {
      const t = newTestRunner();
      t.describe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name()).toBe('uno');
      expect(test.fullName()).toBe('suite uno');
      expect(test.effectiveMode()).toBe('run');
      expect(test.suite().name()).toBe('suite');
      expect(test.suite().fullName()).toBe('suite');
      expect(test.suite().mode()).toBe('run');
    });
  });

  describe('TestRunner.xdescribe', () => {
    it('should declare a skipped suite', async() => {
      const t = newTestRunner();
      t.xdescribe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.effectiveMode()).toBe('skip');
      expect(test.suite().mode()).toBe('skip');
    });
    it('focused tests inside a skipped suite are considered skipped', async() => {
      const t = newTestRunner();
      t.xdescribe('suite', () => {
        t.fit('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.effectiveMode()).toBe('skip');
      expect(test.suite().mode()).toBe('skip');
    });
  });

  describe('TestRunner.fdescribe', () => {
    it('should declare a focused suite', async() => {
      const t = newTestRunner();
      t.fdescribe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.effectiveMode()).toBe('run');
      expect(test.suite().mode()).toBe('focus');
    });
    it('skipped tests inside a focused suite should stay skipped', async() => {
      const t = newTestRunner();
      t.fdescribe('suite', () => {
        t.xit('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.effectiveMode()).toBe('skip');
      expect(test.suite().mode()).toBe('focus');
    });
    it('should run all "run" tests inside a focused suite', async() => {
      const log = [];
      const t = newTestRunner();
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
      const t = newTestRunner();
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
      const t = newTestRunner();
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
      const t = newTestRunner({timeout: 123});
      const log = [];

      t.testModifier('foo', (t, ...args) => {
        log.push('foo');

        expect(t.Modes.Run).toBeTruthy();
        expect(t.Modes.Skip).toBeTruthy();
        expect(t.Modes.Focus).toBeTruthy();
        expect(t.mode()).toBe(t.Modes.Run);
        expect(t.Expectations.Ok).toBeTruthy();
        expect(t.Expectations.Fail).toBeTruthy();
        expect(t.expectation()).toBe(t.Expectations.Ok);
        expect(t.timeout()).toBe(123);
        expect(t.repeat()).toBe(1);

        expect(args.length).toBe(2);
        expect(args[0]).toBe('uno');
        expect(args[1]).toBe('dos');

        t.setMode(t.Modes.Focus);
        t.setExpectation(t.Expectations.Fail);
        t.setTimeout(234);
        t.setRepeat(42);
      });

      t.testAttribute('bar', t => {
        log.push('bar');
        expect(t.mode()).toBe(t.Modes.Focus);
        t.setMode(t.Modes.Skip);
        expect(t.mode()).toBe(t.Modes.Focus);
        expect(t.expectation()).toBe(t.Expectations.Fail);
        expect(t.timeout()).toBe(234);
        expect(t.repeat()).toBe(42);
      });

      t.it.foo('uno', 'dos').bar('test', () => { });
      expect(log).toEqual(['foo', 'bar']);
    });
  });

  describe('TestRunner hooks', () => {
    it('should run all hooks in proper order', async() => {
      const log = [];
      const t = newTestRunner();
      t.beforeAll(() => log.push('root:beforeAll'));
      t.beforeEach(() => log.push('root:beforeEach'));
      t.it('uno', () => log.push('test #1'));
      t.describe('suite1', () => {
        t.beforeAll(() => log.push('suite:beforeAll'));
        t.beforeEach(() => log.push('suite:beforeEach'));
        t.it('dos', () => log.push('test #2'));
        t.it('tres', () => log.push('test #3'));
        t.afterEach(() => log.push('suite:afterEach'));
        t.afterAll(() => log.push('suite:afterAll'));
      });
      t.it('cuatro', () => log.push('test #4'));
      t.afterEach(() => log.push('root:afterEach'));
      t.afterAll(() => log.push('root:afterAll'));
      await t.run();
      expect(log).toEqual([
        'root:beforeAll',
        'root:beforeEach',
        'test #1',
        'root:afterEach',

        'suite:beforeAll',

        'root:beforeEach',
        'suite:beforeEach',
        'test #2',
        'suite:afterEach',
        'root:afterEach',

        'root:beforeEach',
        'suite:beforeEach',
        'test #3',
        'suite:afterEach',
        'root:afterEach',

        'suite:afterAll',

        'root:beforeEach',
        'test #4',
        'root:afterEach',

        'root:afterAll',
      ]);
    });
    it('should have the same state object in hooks and test', async() => {
      const states = [];
      const t = newTestRunner();
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
      const t = newTestRunner({timeout: 10000});
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
      const t = newTestRunner({timeout: 10000});
      t.afterEach(() => { throw new Error('crash!'); });
      t.it('uno', () => { t.terminate(); });
      await t.run();
      expect(t.tests()[0].result).toBe('terminated');
    });
    it('should report as terminated when terminated during hook', async() => {
      const t = newTestRunner({timeout: 10000});
      t.afterEach(() => { t.terminate(); });
      t.it('uno', () => { });
      await t.run();
      expect(t.tests()[0].result).toBe('terminated');
    });
    it('should unwind hooks properly when crashed', async() => {
      const log = [];
      const t = newTestRunner({timeout: 10000});
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
      const t = newTestRunner();
      let ran = false;
      t.it('uno', () => ran = true);
      await t.run();
      expect(ran).toBe(true);
    });
    it('should handle repeat', async() => {
      const t = newTestRunner();
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
      expect(suite).toBe(2);
      expect(beforeAll).toBe(2);
      expect(beforeEach).toBe(6);
      expect(test).toBe(6);
    });
    it('should run tests if some fail', async() => {
      const t = newTestRunner();
      const log = [];
      t.it('uno', () => log.push(1));
      t.it('dos', () => { throw new Error('bad'); });
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should run tests if some timeout', async() => {
      const t = newTestRunner({timeout: 1});
      const log = [];
      t.it('uno', () => log.push(1));
      t.it('dos', async() => new Promise(() => {}));
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should break on first failure if configured so', async() => {
      const log = [];
      const t = newTestRunner({breakOnFailure: true});
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
      const t = newTestRunner();
      t.beforeEach(state => state.FOO = 42);
      t.it('uno', (state, test) => {
        log.push('state.FOO=' + state.FOO);
        log.push('test=' + test.name());
      });
      await t.run();
      expect(log.join()).toBe('state.FOO=42,test=uno');
    });
    it('should run async test', async() => {
      const t = newTestRunner();
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
      const t = newTestRunner();
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
      const t = newTestRunner();
      t.it('uno', () => log.push(1));
      t.it('dos', () => log.push(2));
      await t.run();
      expect(log.join()).toBe('1,2');
    });
    it('should NOT run a skipped test', async() => {
      const t = newTestRunner();
      let ran = false;
      t.xit('uno', () => ran = true);
      await t.run();
      expect(ran).toBe(false);
    });
    it('should run ONLY non-skipped tests', async() => {
      const log = [];
      const t = newTestRunner();
      t.it('uno', () => log.push(1));
      t.xit('dos', () => log.push(2));
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should run ONLY focused tests', async() => {
      const log = [];
      const t = newTestRunner();
      t.it('uno', () => log.push(1));
      t.xit('dos', () => log.push(2));
      t.fit('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('3');
    });
    it('should run tests in order of their declaration', async() => {
      const log = [];
      const t = newTestRunner();
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
      const t = newTestRunner({timeout: 10000});
      t.it('uno', async () => { await new Promise(() => {}); });
      const result = await t.run({totalTimeout: 1});
      expect(t.tests()[0].result).toBe('terminated');
      expect(result.message).toContain('Total timeout');
    });
  });

  describe('TestRunner.run result', () => {
    it('should return OK if all tests pass', async() => {
      const t = newTestRunner();
      t.it('uno', () => {});
      const result = await t.run();
      expect(result.result).toBe('ok');
    });
    it('should return FAIL if at least one test fails', async() => {
      const t = newTestRunner();
      t.it('uno', () => { throw new Error('woof'); });
      const result = await t.run();
      expect(result.result).toBe('failed');
    });
    it('should return FAIL if at least one test times out', async() => {
      const t = newTestRunner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      const result = await t.run();
      expect(result.result).toBe('failed');
    });
    it('should return TERMINATED if it was terminated', async() => {
      const t = newTestRunner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      const [result] = await Promise.all([
        t.run(),
        t.terminate(),
      ]);
      expect(result.result).toBe('terminated');
    });
    it('should return CRASHED if it crashed', async() => {
      const t = newTestRunner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      t.afterAll(() => { throw new Error('woof');});
      const result = await t.run();
      expect(result.result).toBe('crashed');
    });
  });

  describe('TestRunner parallel', () => {
    it('should run tests in parallel', async() => {
      const log = [];
      const t = newTestRunner({parallel: 2});
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

  describe('TestRunner.hasFocusedTestsOrSuites', () => {
    it('should work', () => {
      const t = newTestRunner();
      t.it('uno', () => {});
      expect(t.hasFocusedTestsOrSuites()).toBe(false);
    });
    it('should work #2', () => {
      const t = newTestRunner();
      t.fit('uno', () => {});
      expect(t.hasFocusedTestsOrSuites()).toBe(true);
    });
    it('should work #3', () => {
      const t = newTestRunner();
      t.describe('suite #1', () => {
        t.fdescribe('suite #2', () => {
          t.describe('suite #3', () => {
            t.it('uno', () => {});
          });
        });
      });
      expect(t.hasFocusedTestsOrSuites()).toBe(true);
    });
  });

  describe('TestRunner.passedTests', () => {
    it('should work', async() => {
      const t = newTestRunner();
      t.it('uno', () => {});
      await t.run();
      expect(t.failedTests().length).toBe(0);
      expect(t.skippedTests().length).toBe(0);
      expect(t.passedTests().length).toBe(1);
      const [test] = t.passedTests();
      expect(test.result).toBe('ok');
    });
  });

  describe('TestRunner.failedTests', () => {
    it('should work for both throwing and timeouting tests', async() => {
      const t = newTestRunner({timeout: 1});
      t.it('uno', () => { throw new Error('boo');});
      t.it('dos', () => new Promise(() => {}));
      await t.run();
      expect(t.skippedTests().length).toBe(0);
      expect(t.passedTests().length).toBe(0);
      expect(t.failedTests().length).toBe(2);
      const [test1, test2] = t.failedTests();
      expect(test1.result).toBe('failed');
      expect(test2.result).toBe('timedout');
    });
    it('should report crashed tests', async() => {
      const t = newTestRunner();
      t.beforeEach(() => { throw new Error('woof');});
      t.it('uno', () => {});
      await t.run();
      expect(t.failedTests().length).toBe(1);
      expect(t.failedTests()[0].result).toBe('crashed');
    });
  });

  describe('TestRunner.skippedTests', () => {
    it('should work for both throwing and timeouting tests', async() => {
      const t = newTestRunner({timeout: 1});
      t.xit('uno', () => { throw new Error('boo');});
      await t.run();
      expect(t.skippedTests().length).toBe(1);
      expect(t.passedTests().length).toBe(0);
      expect(t.failedTests().length).toBe(0);
      const [test] = t.skippedTests();
      expect(test.result).toBe('skipped');
    });
  });

  describe('Test.result', () => {
    it('should return OK', async() => {
      const t = newTestRunner();
      t.it('uno', () => {});
      await t.run();
      expect(t.tests()[0].result).toBe('ok');
    });
    it('should return TIMEDOUT', async() => {
      const t = newTestRunner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      await t.run();
      expect(t.tests()[0].result).toBe('timedout');
    });
    it('should return SKIPPED', async() => {
      const t = newTestRunner();
      t.xit('uno', () => {});
      await t.run();
      expect(t.tests()[0].result).toBe('skipped');
    });
    it('should return FAILED', async() => {
      const t = newTestRunner();
      t.it('uno', async() => Promise.reject('woof'));
      await t.run();
      expect(t.tests()[0].result).toBe('failed');
    });
    it('should return TERMINATED', async() => {
      const t = newTestRunner();
      t.it('uno', async() => t.terminate());
      await t.run();
      expect(t.tests()[0].result).toBe('terminated');
    });
    it('should return CRASHED', async() => {
      const t = newTestRunner();
      t.it('uno', () => {});
      t.afterEach(() => {throw new Error('foo');});
      await t.run();
      expect(t.tests()[0].result).toBe('crashed');
    });
  });

  describe('TestRunner Events', () => {
    it('should emit events in proper order', async() => {
      const log = [];
      const t = newTestRunner();
      t.beforeAll(() => log.push('beforeAll'));
      t.beforeEach(() => log.push('beforeEach'));
      t.it('test#1', () => log.push('test#1'));
      t.afterEach(() => log.push('afterEach'));
      t.afterAll(() => log.push('afterAll'));
      t.on('started', () => log.push('E:started'));
      t.on('teststarted', () => log.push('E:teststarted'));
      t.on('testfinished', () => log.push('E:testfinished'));
      t.on('finished', () => log.push('E:finished'));
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
    it('should emit finish event with result', async() => {
      const t = newTestRunner();
      const [result] = await Promise.all([
        new Promise(x => t.once('finished', x)),
        t.run(),
      ]);
      expect(result.result).toBe('ok');
    });
  });
};

