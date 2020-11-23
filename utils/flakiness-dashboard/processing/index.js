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

const { BlobServiceClient } = require("@azure/storage-blob");
const zlib = require('zlib');
const path = require('path');
const util = require('util');

const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage);

const DASHBOARD_CONTAINER = 'dashboards';
const DASHBOARD_NAME = 'main.json';
const DASHBOARD_VERSION = 1;

class SimpleBlob {
  static async create(container, blobName) {
    const dashboardContainerClient = await blobServiceClient.getContainerClient(DASHBOARD_CONTAINER);
    return new SimpleBlob(dashboardContainerClient);
  }

  constructor(containerClient) {
    this._blobClient = containerClient.getBlobClient(DASHBOARD_NAME);
    this._blockBlobClient = this._blobClient.getBlockBlobClient();
  }

  async download() {
    if (!await this._blobClient.exists())
      return undefined;
    const response = await this._blobClient.download();
    const responseStream = response.readableStreamBody;
    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      responseStream.on('data', data => chunks.push(data instanceof Buffer ? data : Buffer.from(data)));
      responseStream.on('end', () => resolve(Buffer.concat(chunks)));
      responseStream.on('error', reject);
    });
    const properties = await this._blobClient.getProperties();
    const content = properties.contentEncoding.toLowerCase().trim() === 'gzip' ? await gunzipAsync(buffer) : buffer.toString('utf8');
    return JSON.parse(content);
  }

  async uploadGzipped(data) {
    const content = JSON.stringify(data);
    const zipped = await gzipAsync(content);
    await this._blockBlobClient.upload(zipped, Buffer.byteLength(zipped), {
      blobHTTPHeaders: {
        blobContentEncoding: 'gzip',
        blobContentType: 'application/json; charset=UTF-8',
      }
    });
  }
}

async function deleteUploadBlob(blobName) {
  // First we do - delete the blob.
  const containerClient = await blobServiceClient.getContainerClient('uploads');
  await containerClient.deleteBlob(blobName, {});
}

function flattenSpecs(suite, result = []) {
  if (suite.suites) {
    for (const child of suite.suites)
      flattenSpecs(child, result);
  }
  for (const spec of suite.specs || [])
    result.push(spec);
  return result;
}

class Dashboard {
  constructor() {
    this._runs = [];
  }

  initialize(jsonData) {
    if (jsonData.version !== DASHBOARD_VERSION) {
      // Run migrations here!
    }
    this._runs = jsonData.buildbotRuns;
  }

  addReport(report) {
    // We cannot use linenumber to identify specs since line numbers
    // might be different across commits.
    const getSpecId = spec => spec.file + ' @@@ ' + spec.title;

    const faultySpecIds = new Set();
    for (const run of this._runs) {
      for (const spec of run.specs)
        faultySpecIds.add(getSpecId(spec));
    }
    const specs = [];
    for (const spec of flattenSpecs(report)) {
      // Filter out specs that didn't have a single test that was run in the
      // given shard.
      if (spec.tests.every(test => test.runs.length === 1 && !test.runs[0].status))
        continue;
      const hasFlakyAnnotation = spec.tests.some(test => test.annotations.some(a => a.type === 'flaky'));

      if (!spec.ok || hasFlakyAnnotation || faultySpecIds.has(getSpecId(spec)))
        specs.push(spec);
    }
    if (specs.length) {
      this._runs.push({
        metadata: report.metadata,
        specs,
      });
    }
    return specs.length;
  }

  serialize(maxCommits = 100) {
    const shaToTimestamp = new Map();
    for (const run of this._runs)
      shaToTimestamp.set(run.metadata.commitSHA, run.metadata.commitTimestamp);
    const commits = [...shaToTimestamp].sort(([sha1, ts1], [sha2, ts2]) => ts2 - ts1).slice(0, maxCommits);
    const commitsSet = new Set(commits.map(([sha, ts]) => sha));
    return {
      version: DASHBOARD_VERSION,
      timestamp: Date.now(),
      buildbotRuns: this._runs.filter(run => commitsSet.has(run.metadata.commitSHA)),
    };
  }
}


module.exports = async function(context) {
  const timestamp = Date.now();
  const blobName = context.bindingData.name;
  // First thing we do - delete the blob.
  await deleteUploadBlob(blobName);

  const dashboardBlob = await SimpleBlob.create();
  const dashboardData = await dashboardBlob.download();
  const dashboard = new Dashboard();
  if (dashboardData)
    dashboard.initialize(dashboardData);

  try {
    const data = await gunzipAsync(context.bindings.newBlob);
    const report = JSON.parse(data.toString('utf8'));
    const addedSpecs = dashboard.addReport(report);
    await dashboardBlob.uploadGzipped(dashboard.serialize());
    context.log(`
    ===== started =====
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

