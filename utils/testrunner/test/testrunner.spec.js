const {TestRunner} = require('..');

module.exports.addTests = function({testRunner, expect}) {
  const {describe, fdescribe, xdescribe} = testRunner;
  const {it, xit, fit} = testRunner;

  describe('TestRunner.it', () => {
    it('should declare a test', async() => {
      const t = new TestRunner();
      t.it('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name).toBe('uno');
      expect(test.fullName).toBe('uno');
      expect(test.declaredMode).toBe('run');
      expect(test.location.filePath).toEqual(__filename);
      expect(test.location.fileName).toEqual('testrunner.spec.js');
      expect(test.location.lineNumber).toBeTruthy();
      expect(test.location.columnNumber).toBeTruthy();
    });
  });

  describe('TestRunner.xit', () => {
    it('should declare a skipped test', async() => {
      const t = new TestRunner();
      t.xit('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name).toBe('uno');
      expect(test.fullName).toBe('uno');
      expect(test.declaredMode).toBe('skip');
    });
  });

  describe('TestRunner.fit', () => {
    it('should declare a focused test', async() => {
      const t = new TestRunner();
      t.fit('uno', () => {});
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name).toBe('uno');
      expect(test.fullName).toBe('uno');
      expect(test.declaredMode).toBe('focus');
    });
  });

  describe('TestRunner.describe', () => {
    it('should declare a suite', async() => {
      const t = new TestRunner();
      t.describe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.name).toBe('uno');
      expect(test.fullName).toBe('suite uno');
      expect(test.declaredMode).toBe('run');
      expect(test.suite.name).toBe('suite');
      expect(test.suite.fullName).toBe('suite');
      expect(test.suite.declaredMode).toBe('run');
    });
  });

  describe('TestRunner.xdescribe', () => {
    it('should declare a skipped suite', async() => {
      const t = new TestRunner();
      t.xdescribe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.declaredMode).toBe('skip');
      expect(test.suite.declaredMode).toBe('skip');
    });
    it('focused tests inside a skipped suite are considered skipped', async() => {
      const t = new TestRunner();
      t.xdescribe('suite', () => {
        t.fit('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.declaredMode).toBe('skip');
      expect(test.suite.declaredMode).toBe('skip');
    });
  });

  describe('TestRunner.fdescribe', () => {
    it('should declare a focused suite', async() => {
      const t = new TestRunner();
      t.fdescribe('suite', () => {
        t.it('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.declaredMode).toBe('run');
      expect(test.suite.declaredMode).toBe('focus');
    });
    it('skipped tests inside a focused suite should stay skipped', async() => {
      const t = new TestRunner();
      t.fdescribe('suite', () => {
        t.xit('uno', () => {});
      });
      expect(t.tests().length).toBe(1);
      const test = t.tests()[0];
      expect(test.declaredMode).toBe('skip');
      expect(test.suite.declaredMode).toBe('focus');
    });
    it('should run all "run" tests inside a focused suite', async() => {
      const log = [];
      const t = new TestRunner();
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
      const t = new TestRunner();
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
      const t = new TestRunner();
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

  describe('TestRunner hooks', () => {
    it('should run all hooks in proper order', async() => {
      const log = [];
      const t = new TestRunner();
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
      const t = new TestRunner();
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
      const t = new TestRunner({timeout: 10000});
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
    it('should unwind hooks properly when crashed', async() => {
      const log = [];
      const t = new TestRunner({timeout: 10000});
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
      const t = new TestRunner();
      let ran = false;
      t.it('uno', () => ran = true);
      await t.run();
      expect(ran).toBe(true);
    });
    it('should run tests if some fail', async() => {
      const t = new TestRunner();
      const log = [];
      t.it('uno', () => log.push(1));
      t.it('dos', () => { throw new Error('bad'); });
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should run tests if some timeout', async() => {
      const t = new TestRunner({timeout: 1});
      const log = [];
      t.it('uno', () => log.push(1));
      t.it('dos', async() => new Promise(() => {}));
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should break on first failure if configured so', async() => {
      const log = [];
      const t = new TestRunner({breakOnFailure: true});
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
      const t = new TestRunner();
      t.beforeEach(state => state.FOO = 42);
      t.it('uno', (state, test) => {
        log.push('state.FOO=' + state.FOO);
        log.push('test=' + test.name);
      });
      await t.run();
      expect(log.join()).toBe('state.FOO=42,test=uno');
    });
    it('should run async test', async() => {
      const t = new TestRunner();
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
      const t = new TestRunner();
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
      const t = new TestRunner();
      t.it('uno', () => log.push(1));
      t.it('dos', () => log.push(2));
      await t.run();
      expect(log.join()).toBe('1,2');
    });
    it('should NOT run a skipped test', async() => {
      const t = new TestRunner();
      let ran = false;
      t.xit('uno', () => ran = true);
      await t.run();
      expect(ran).toBe(false);
    });
    it('should run ONLY non-skipped tests', async() => {
      const log = [];
      const t = new TestRunner();
      t.it('uno', () => log.push(1));
      t.xit('dos', () => log.push(2));
      t.it('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('1,3');
    });
    it('should run ONLY focused tests', async() => {
      const log = [];
      const t = new TestRunner();
      t.it('uno', () => log.push(1));
      t.xit('dos', () => log.push(2));
      t.fit('tres', () => log.push(3));
      await t.run();
      expect(log.join()).toBe('3');
    });
    it('should run tests in order of their declaration', async() => {
      const log = [];
      const t = new TestRunner();
      t.it('uno', () => log.push(1));
      t.describe('suite1', () => {
        t.it('dos', () => log.push(2));
        t.it('tres', () => log.push(3));
      });
      t.it('cuatro', () => log.push(4));
      await t.run();
      expect(log.join()).toBe('1,2,3,4');
    });
    it('should support async test suites', async() => {
      const log = [];
      const t = new TestRunner();
      t.it('uno', () => log.push(1));
      await t.describe('suite1', async() => {
        await Promise.resolve();
        t.it('dos', () => log.push(2));
        await Promise.resolve();
        t.it('tres', () => log.push(3));
      });
      t.it('cuatro', () => log.push(4));
      await t.run();
      expect(log.join()).toBe('1,2,3,4');
    });
  });

  describe('TestRunner.run result', () => {
    it('should return OK if all tests pass', async() => {
      const t = new TestRunner();
      t.it('uno', () => {});
      const result = await t.run();
      expect(result.result).toBe('ok');
    });
    it('should return FAIL if at least one test fails', async() => {
      const t = new TestRunner();
      t.it('uno', () => { throw new Error('woof'); });
      const result = await t.run();
      expect(result.result).toBe('failed');
    });
    it('should return FAIL if at least one test times out', async() => {
      const t = new TestRunner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      const result = await t.run();
      expect(result.result).toBe('failed');
    });
    it('should return TERMINATED if it was terminated', async() => {
      const t = new TestRunner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      const [result] = await Promise.all([
        t.run(),
        t.terminate(),
      ]);
      expect(result.result).toBe('terminated');
    });
    it('should return CRASHED if it crashed', async() => {
      const t = new TestRunner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      t.afterAll(() => { throw new Error('woof');});
      const result = await t.run();
      expect(result.result).toBe('crashed');
    });
  });

  describe('TestRunner parallel', () => {
    it('should run tests in parallel', async() => {
      const log = [];
      const t = new TestRunner({parallel: 2});
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
      const t = new TestRunner();
      t.it('uno', () => {});
      expect(t.hasFocusedTestsOrSuites()).toBe(false);
    });
    it('should work #2', () => {
      const t = new TestRunner();
      t.fit('uno', () => {});
      expect(t.hasFocusedTestsOrSuites()).toBe(true);
    });
    it('should work #3', () => {
      const t = new TestRunner();
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
      const t = new TestRunner();
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
      const t = new TestRunner({timeout: 1});
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
      const t = new TestRunner();
      t.beforeEach(() => { throw new Error('woof');});
      t.it('uno', () => {});
      await t.run();
      expect(t.failedTests().length).toBe(1);
      expect(t.failedTests()[0].result).toBe('crashed');
    });
  });

  describe('TestRunner.skippedTests', () => {
    it('should work for both throwing and timeouting tests', async() => {
      const t = new TestRunner({timeout: 1});
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
      const t = new TestRunner();
      t.it('uno', () => {});
      await t.run();
      expect(t.tests()[0].result).toBe('ok');
    });
    it('should return TIMEDOUT', async() => {
      const t = new TestRunner({timeout: 1});
      t.it('uno', async() => new Promise(() => {}));
      await t.run();
      expect(t.tests()[0].result).toBe('timedout');
    });
    it('should return SKIPPED', async() => {
      const t = new TestRunner();
      t.xit('uno', () => {});
      await t.run();
      expect(t.tests()[0].result).toBe('skipped');
    });
    it('should return FAILED', async() => {
      const t = new TestRunner();
      t.it('uno', async() => Promise.reject('woof'));
      await t.run();
      expect(t.tests()[0].result).toBe('failed');
    });
    it('should return TERMINATED', async() => {
      const t = new TestRunner();
      t.it('uno', async() => t.terminate());
      await t.run();
      expect(t.tests()[0].result).toBe('terminated');
    });
    it('should return CRASHED', async() => {
      const t = new TestRunner();
      t.it('uno', () => {});
      t.afterEach(() => {throw new Error('foo');});
      await t.run();
      expect(t.tests()[0].result).toBe('crashed');
    });
  });

  describe('TestRunner Events', () => {
    it('should emit events in proper order', async() => {
      const log = [];
      const t = new TestRunner();
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
      const t = new TestRunner();
      const [result] = await Promise.all([
        new Promise(x => t.once('finished', x)),
        t.run(),
      ]);
      expect(result.result).toBe('ok');
    });
  });
};

