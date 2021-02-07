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

const {SimpleBlob} = require('./utils.js');

async function processDashboardRaw(context, report) {
  const timestamp = Date.now();
  const dashboardBlob = await SimpleBlob.create('dashboards', `raw/${report.metadata.commitSHA}.json`);
  const dashboardData = (await dashboardBlob.download()) || [];
  dashboardData.push(report);
  await dashboardBlob.uploadGzipped(dashboardData);

  context.log(`
  ===== started dashboard raw =====
    SHA: ${report.metadata.commitSHA}
    URL: ${report.metadata.runURL}
    timestamp: ${report.metadata.commitTimestamp}
  ===== complete in ${Date.now() - timestamp}ms =====
  `);
  return {
    reports: dashboardData,
    commitSHA: report.metadata.commitSHA,
  };
}

module.exports = {processDashboardRaw};

