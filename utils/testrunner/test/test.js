const TestRunner = require('..');
const testRunner = new TestRunner();
require('./testrunner.spec.js').addTests(testRunner.api());
testRunner.run();
