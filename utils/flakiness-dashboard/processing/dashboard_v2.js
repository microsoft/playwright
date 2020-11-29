/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

const {SimpleBlob, flattenSpecs} = require('./utils.js');

const DASHBOARD_VERSION = 1;

class Dashboard {
  constructor() {
    this._specs = new Map();
    this._commits = new Map();
  }

  initialize(jsonData) {
    if (jsonData.version !== DASHBOARD_VERSION) {
      // Run migrations here!
    }
    for (const spec of jsonData.specs) {
      const commitCoordinates = new Map();
      for (const coord of spec.commitCoordinates)
        commitCoordinates.set(coord.sha, coord);
      this._specs.set(spec.specId, {
        specId: spec.specId,
        file: spec.file,
        title: spec.title,
        problematicTests: spec.problematicTests,
        commitCoordinates,
      });
    }
    for (const commit of jsonData.commits)
      this._commits.set(commit.sha, commit);
  }

  addReport(report) {
    const sha = report.metadata.commitSHA;
    this._commits.set(sha, {
      sha,
      timestamp: report.metadata.commitTimestamp,
      message: report.metadata.commitTitle,
      author: report.metadata.commitAuthorName,
      email: report.metadata.commitAuthorEmail,
    });
    let addedSpecs = 0;
    for (const spec of flattenSpecs(report)) {
      // We cannot use linenumber to identify specs since line numbers
      // might be different across commits.
      const specId = spec.file + ' --- ' + spec.title;
      const tests = spec.tests.filter(test => !isHealthyTest(test));
      // If there are no problematic testruns now and before - ignore the spec.
      if (!tests.length && !this._specs.has(specId))
        continue;
      ++addedSpecs;
      let specInfo = this._specs.get(specId);
      if (!specInfo) {
        specInfo = {
          specId,
          title: spec.title,
          file: spec.file,
          commitCoordinates: new Map(),
          problematicTests: [],
        };
        this._specs.set(specId, specInfo);
      }
      specInfo.problematicTests.push(...tests.map(test => ({sha, test})));
      specInfo.commitCoordinates.set(sha, ({sha, line: spec.line, column: spec.column}));
    }
    return addedSpecs;
  }

  serialize(maxCommits = 100) {
    const commits = [...this._commits.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-maxCommits);
    const whitelistedCommits = new Set();
    for (const c of commits)
      whitelistedCommits.add(c.sha);

    const specs = [...this._specs.values()].map(spec => ({
      specId: spec.specId,
      title: spec.title,
      file: spec.file,
      commitCoordinates: [...spec.commitCoordinates.values()].filter(coord => whitelistedCommits.has(coord.sha)),
      problematicTests: [...spec.problematicTests.values()].filter(test => whitelistedCommits.has(test.sha)),
    })).filter(spec => spec.commitCoordinates.length && spec.problematicTests.length);

    return {
      version: DASHBOARD_VERSION,
      timestamp: Date.now(),
      commits,
      specs,
    };
  }
}

async function processDashboardV2(context, report) {
  const timestamp = Date.now();
  const dashboardBlob = await SimpleBlob.create('dashboards', 'main_v2.json');
  const dashboardData = await dashboardBlob.download();
  const dashboard = new Dashboard();
  if (dashboardData)
    dashboard.initialize(dashboardData);

  try {
    const addedSpecs = dashboard.addReport(report);
    await dashboardBlob.uploadGzipped(dashboard.serialize());
    context.log(`
    ===== started dashboard v2 =====
      SHA: ${report.metadata.commitSHA}
      URL: ${report.metadata.runURL}
      timestamp: ${report.metadata.commitTimestamp}
      added specs: ${addedSpecs}
    ===== complete in ${Date.now() - timestamp}ms =====
    `);
  } catch (e) {
    context.log(e);
    return;
  }
}

module.exports = {processDashboardV2};

function isHealthyTest(test) {
  // If test has any annotations - it's not healthy and requires attention.
  if (test.annotations.length)
    return false;
  // If test does not have annotations and doesn't have runs - it's healthy.
  if (!test.runs.length)
    return true;
  // If test was run more than once - it's been retried and thus unhealthy.
  if (test.runs.length > 1)
    return false;
  const run = test.runs[0];
  // Test might not have status if it was sharded away - consider it healthy.
  if (!run.status)
    return true;
  // if status is not "passed", then it's a bad test.
  if (run.status !== 'passed')
    return false;
  // if run passed, but that's not what we expected - it's a bad test.
  if (run.status !== test.expectedStatus)
    return false;
  // Otherwise, the test is healthy.
  return true;
}
