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

async function processDashboardCompressedV1(context, reports, commitSHA) {
  const timestamp = Date.now();
  const dashboardBlob = await SimpleBlob.create('dashboards', `compressed_v1/${commitSHA}.json`);
  await dashboardBlob.uploadGzipped(compressReports(reports));

  context.log(`
  ===== started dashboard compressed v1 =====
    SHA: ${commitSHA}
  ===== complete in ${Date.now() - timestamp}ms =====
  `);
}

module.exports = {processDashboardCompressedV1, compressReports};

function compressReports(reports) {
  const files = {};
  for (const report of reports) {
    const projectNameToMetadata = new Map();
    if (report.config && report.config.projects) {
      for (const project of report.config.projects) {
        if (project.metadata.headful === false)
          delete project.metadata.headful;
        if (project.metadata.mode === 'default')
          delete project.metadata.mode;
        if (project.metadata.platform.toLowerCase() !== 'android')
          delete project.metadata.platform;
        projectNameToMetadata.set(project.name, project.metadata);
      }
    }
    for (const spec of flattenSpecs(report)) {
      let specs = files[spec.file];
      if (!specs) {
        specs = new Map();
        files[spec.file] = specs;
      }
      const specId = spec.file + '---' + spec.title + ' --- ' + spec.line;
      let specObject = specs.get(specId);
      if (!specObject) {
        specObject = {
          title: spec.title,
          line: spec.line,
          column: spec.column,
          tests: new Map(),
        };
        specs.set(specId, specObject);
      }
      for (const test of spec.tests || []) {
        // It's unclear how many results we get in the new test runner - let's
        // stay on the safe side and skip test without any results.
        if (!test.results || !test.results.length)
          continue;
        // We get tests with a single result without status for sharded
        // tests that are inside shard that we don't run.
        if (test.results.length === 1 && !test.results[0].status)
          continue;
        // Folio currently reports `data` as part of test results.
        // In our case, all data will be identical - so pick
        // from the first result.
        let testParameters = test.results[0].data;
        if (!testParameters && test.projectName)
          testParameters = projectNameToMetadata.get(test.projectName);
        // Prefer test platform when it exists, and fallback to
        // the host platform when it doesn't. This way we can attribute
        // android tests to android.
        let platform = testParameters.platform;
        if (!platform) {
          const osName = report.metadata.osName.toUpperCase().startsWith('MINGW') ? 'Windows' : report.metadata.osName;
          const arch = report.metadata.arch && !report.metadata.arch.includes('x86') ? report.metadata.arch : '';
          platform = (osName + ' ' + report.metadata.osVersion + ' ' + arch).trim();
        }
        const browserName = testParameters.browserName || 'N/A';

        const testName = getTestName(browserName, platform, testParameters);
        let testObject = specObject.tests.get(testName);
        if (!testObject) {
          testObject = {
            parameters: {
              ...testParameters,
              browserName,
              platform,
            },
          };
          // By default, all tests are expected to pass. We can have this as a hidden knowledge.
          if (test.expectedStatus !== 'passed')
            testObject.expectedStatus = test.expectedStatus;
          if (test.annotations.length)
            testObject.annotations = test.annotations;
          specObject.tests.set(testName, testObject);
        }

        for (const run of test.results) {
          // Record duration of slow tests only, i.e. > 1s.
          if (run.status === 'passed' && run.duration > 1000) {
            testObject.minTime = Math.min((testObject.minTime || Number.MAX_VALUE), run.duration);
            testObject.maxTime = Math.max((testObject.maxTime || 0), run.duration);
          }
          if (run.status === 'failed') {
            if (!Array.isArray(testObject.failed))
              testObject.failed = [];
            testObject.failed.push(run.error);
          } else {
            testObject[run.status] = (testObject[run.status] || 0) + 1;
          }
        }
      }
    }
  }

  const pojo = Object.entries(files).map(([file, specs]) => ({
    file,
    specs: [...specs.values()].map(specObject => ({
      ...specObject,
      tests: [...specObject.tests.values()],
    })),
  }));
  return pojo;
}

function getTestName(browserName, platform, parameters) {
  return [browserName, platform, ...Object.entries(parameters).filter(([key, value]) => !!value).map(([key, value]) => {
    if (key === 'browserName' || key === 'platform')
      return;
    if (typeof value === 'string')
      return value;
    if (typeof value === 'boolean')
      return key;
    return `${key}=${value}`;
  }).filter(Boolean)].join(' / ');
}
