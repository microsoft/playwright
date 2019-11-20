const path = require('path');
const {TestRunner} = require('../utils/testrunner/');
const utils = require('./utils');
const {addTests} = require('./playwright.spec.js');
const firefoxTests = testsForProduct('Firefox');
const chromiumTests = testsForProduct('Chromium');
const webkitTests = testsForProduct('WebKit');
const goalSuite = intersectSets(firefoxTests.all, chromiumTests.all, webkitTests.all);
const skippedSuite = intersectSets(goalSuite, joinSets(firefoxTests.skipped, chromiumTests.skipped, webkitTests.skipped));

module.exports = {
  firefox: {
    total: firefoxTests.all.size,
    skipped: firefoxTests.skipped.size,
  },
  chromium: {
    total: chromiumTests.all.size,
    skipped: chromiumTests.skipped.size,
  },
  webkit: {
    total: webkitTests.all.size,
    skipped: webkitTests.skipped.size,
  },
  all: {
    total: goalSuite.size,
    skipped: skippedSuite.size,
  }
};

/**
 * @param {string} product 
 */
function testsForProduct(product) {
  const testRunner = new TestRunner();
  addTests({
    product,
    playwrightPath: path.join(utils.projectRoot(), `${product.toLowerCase()}.js`),
    testRunner
  });
  return {
    all: new Set(testRunner.tests().map(test => test.fullName)),
    skipped: new Set(testRunner.tests().filter(test => test.declaredMode === 'skip').map(test => test.fullName))
  }
}

/**
 * @param  {...Set} sets 
 */
function intersectSets(...sets) {
  if (!sets.length)
    return new Set();
  const intersect = new Set();
  const [first, ...rest] = sets;
  outer: for (const item of first) {
    for (const set of rest)
      if (!set.has(item))
        continue outer;
    intersect.add(item);
  }
  return intersect;
}

function joinSets(...sets) {
  const joined = new Set();
  for (const set of sets)
    for (const item of set)
      joined.add(item);
  return joined;
}