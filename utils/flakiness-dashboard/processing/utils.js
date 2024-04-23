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
// @ts-check
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');
const defaultAzureCredential = new DefaultAzureCredential();
const zlib = require('zlib');
const util = require('util');

const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);

const AZURE_STORAGE_ACCOUNT = 'folioflakinessdashboard';

const blobServiceClient = new BlobServiceClient(
  `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
  defaultAzureCredential
);

function flattenSpecs(suite, result = [], titlePaths = []) {
  if (suite.suites) {
    for (const child of suite.suites) {
      const isFileSuite = child.column === 0 && child.line === 0;
      flattenSpecs(child, result, (!isFileSuite && child.title) ? [...titlePaths, child.title]: titlePaths);
    }
  }
  for (const spec of suite.specs || []) {
    spec.titlePath = [...titlePaths, spec.title];
    result.push(spec);
  }
  return result;
}

class SimpleBlob {
  static async create(container, blobName) {
    const dashboardContainerClient = await blobServiceClient.getContainerClient(container);
    return new SimpleBlob(dashboardContainerClient, blobName);
  }

  constructor(containerClient, blobName) {
    this._blobClient = containerClient.getBlobClient(blobName);
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
    const zipped = await gzipAsync(content, {
      level: 9,
    });
    await this._blockBlobClient.upload(zipped, Buffer.byteLength(zipped), {
      blobHTTPHeaders: {
        blobContentEncoding: 'gzip',
        blobContentType: 'application/json; charset=UTF-8',
      }
    });
  }
}

async function deleteBlob(container, blobName) {
  const containerClient = await blobServiceClient.getContainerClient(container);
  await containerClient.deleteBlob(blobName, {});
}

module.exports = {gzipAsync, gunzipAsync, flattenSpecs, SimpleBlob, blobServiceClient, deleteBlob};
