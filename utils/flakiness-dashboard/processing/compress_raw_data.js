#!/usr/bin/env node
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require('path');
const fs = require('fs');
const {SimpleBlob} = require('./utils.js');
const {processDashboardCompressedV1} = require('./dashboard_compressed_v1.js');

(async () => {
  const sha = process.argv[2];
  console.log(sha);
  const dashboardBlob = await SimpleBlob.create('dashboards', `raw/${sha}.json`);
  const reports = await dashboardBlob.download();
  if (!reports) {
    console.error('ERROR: no data found for commit ' + sha);
    process.exit(1);
  }
  await processDashboardCompressedV1({log: console.log}, reports, sha);
})();
