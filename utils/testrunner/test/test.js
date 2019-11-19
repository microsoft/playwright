const {TestRunner, Matchers, Reporter} = require('..');

const testRunner = new TestRunner();
const {expect} = new Matchers();

require('./testrunner.spec.js').addTests({testRunner, expect});

new Reporter(testRunner, {
  verbose: process.argv.includes('--verbose'),
  summary: true,
  projectFolder: require('path').join(__dirname, '..'),
  showSlowTests: 0,
});
testRunner.run();

