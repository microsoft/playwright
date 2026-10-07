/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import fs from 'fs';

import yauzl from 'yauzl';

export type Artifact = {
  id: string;
  name: string;
};

export type ArtifactScan = {
  artifacts: Artifact[];
  // Runs created inside the lookback window.
  runCount: number;
  // Runs whose artifacts we actually listed.
  listedRunCount: number;
};

type ListOptions = {
  ingested: Set<string>;
  lookbackDays: number;
  // Completed runs last updated before this time (epoch ms) are not listed.
  rescanSince: number;
  concurrency: number;
};

type RawRun = {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type RawArtifact = {
  id: number;
  name: string;
  expired: boolean;
  created_at: string;
};

// A single runs query returns at most this many results, no matter how you
// page it. Larger windows have to be split into several queries.
const RUNS_QUERY_CAP = 1000;

const FETCH_ATTEMPTS = 3;

// Thin GitHub REST client over global fetch. Only the endpoints this CLI
// needs: list runs, list a run's artifacts, list artifacts by name, and
// download an artifact zip.
export class GitHubClient {
  private _base: string;
  private _headers: Record<string, string>;

  constructor(token: string, repo: string = 'microsoft/playwright') {
    if (!token)
      throw new Error('A GitHub token is required (set GITHUB_TOKEN).');
    this._base = `https://api.github.com/repos/${repo}`;
    this._headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  // Return the not-yet-ingested artifacts matching `prefix` from the runs
  // created in the last `lookbackDays`.
  //
  // We walk run by run: list the recent runs, then each run's artifacts. The
  // repo-wide artifact listing (GET /actions/artifacts without a name filter)
  // returns 500 for large repositories, so it cannot be used here.
  //
  // Listing every run on each cron tick would be expensive, so a run is only
  // listed when it can still hold artifacts we have not seen. Artifacts are
  // uploaded by jobs, and a run's `updated_at` moves whenever a job finishes,
  // so a run that completed before `rescanSince` was already final the last
  // time we looked and everything it has is ingested. In-progress runs are
  // always listed.
  async listArtifacts(prefix: string, options: ListOptions): Promise<ArtifactScan> {
    const { ingested, lookbackDays, rescanSince, concurrency } = options;
    const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const runs = await this._listRecentRuns(cutoff);
    const toList = runs.filter(run => run.status !== 'completed' || Date.parse(run.updated_at) >= rescanSince);

    const artifacts: Artifact[] = [];
    const queued = new Set<string>();
    for (const batch of chunk(toList, concurrency)) {
      const lists = await Promise.all(batch.map(run => this._listRunArtifacts(run.id)));
      for (const artifact of lists.flat()) {
        if (artifact.expired || !artifact.name.startsWith(prefix))
          continue;
        const id = String(artifact.id);
        if (ingested.has(id) || queued.has(id))
          continue;
        queued.add(id);
        artifacts.push({ id, name: artifact.name });
      }
    }
    return { artifacts, runCount: runs.length, listedRunCount: toList.length };
  }

  // The newest non-expired artifact with the exact name, or null if none.
  async findLatestArtifact(name: string): Promise<string | null> {
    const query = `/actions/artifacts?name=${encodeURIComponent(name)}&per_page=100`;
    for await (const artifact of this._paginate<RawArtifact>(query, 'artifacts')) {
      if (!artifact.expired)
        return String(artifact.id);
    }
    return null;
  }

  async downloadArtifactZip(id: string): Promise<Buffer> {
    // 302 -> blob storage; fetch follows it and strips the Authorization header
    // on the cross-origin redirect, as required by the signed URL.
    const response = await this._fetch(`${this._base}/actions/artifacts/${id}/zip`);
    if (!response.ok)
      throw new Error(`Failed to download artifact ${id}: ${response.status} ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  }

  // All runs created at or after `cutoff`, newest first. The `created` filter
  // takes an inclusive `from..to` range; when a range hits the result cap we
  // issue the next query ending at the oldest run seen so far.
  private async _listRecentRuns(cutoff: number): Promise<RawRun[]> {
    const runs: RawRun[] = [];
    const seen = new Set<number>();
    const from = isoSeconds(cutoff);
    let to = isoSeconds(Date.now() + 60 * 60 * 1000);
    while (true) {
      const query = `/actions/runs?created=${from}..${to}&per_page=100`;
      let count = 0;
      let oldest = to;
      for await (const run of this._paginate<RawRun>(query, 'workflow_runs')) {
        count++;
        oldest = run.created_at;
        if (seen.has(run.id))
          continue;
        seen.add(run.id);
        runs.push(run);
      }
      if (count < RUNS_QUERY_CAP || oldest === to)
        return runs;
      to = oldest;
    }
  }

  private async _listRunArtifacts(runId: number): Promise<RawArtifact[]> {
    const artifacts: RawArtifact[] = [];
    for await (const artifact of this._paginate<RawArtifact>(`/actions/runs/${runId}/artifacts?per_page=100`, 'artifacts'))
      artifacts.push(artifact);
    return artifacts;
  }

  private async * _paginate<T>(path: string, key: string): AsyncGenerator<T> {
    let url: string | null = `${this._base}${path}`;
    while (url) {
      const response = await this._fetch(url);
      if (!response.ok)
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} for ${url}`);
      const body = await response.json() as Record<string, T[] | undefined>;
      for (const item of body[key] ?? [])
        yield item;
      url = nextPageUrl(response.headers.get('link'));
    }
  }

  // GET with a few retries on network errors and 5xx/429 responses.
  private async _fetch(url: string): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch(url, { headers: this._headers });
        if (attempt >= FETCH_ATTEMPTS || (response.status < 500 && response.status !== 429))
          return response;
      } catch (error) {
        if (attempt >= FETCH_ATTEMPTS)
          throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// ISO 8601 without milliseconds, the form GitHub's `created` filter accepts.
function isoSeconds(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Parse the `rel="next"` target out of a GitHub Link header, or null if absent.
function nextPageUrl(link: string | null): string | null {
  if (!link)
    return null;
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (match)
      return match[1];
  }
  return null;
}

// Extract the first zip entry whose name ends with `ext` to `destPath`.
export async function extractSingle(zipBuffer: Buffer, ext: string, destPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(error ?? new Error('Failed to open zip'));
        return;
      }
      let found = false;
      zipFile.on('entry', entry => {
        if (/\/$/.test(entry.fileName) || !entry.fileName.endsWith(ext)) {
          zipFile.readEntry();
          return;
        }
        found = true;
        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error('Failed to read zip entry'));
            return;
          }
          const out = fs.createWriteStream(destPath);
          stream.on('error', reject);
          out.on('error', reject);
          out.on('finish', () => resolve(destPath));
          stream.pipe(out);
        });
      });
      zipFile.on('end', () => {
        if (!found)
          reject(new Error(`No "*${ext}" entry found in artifact zip`));
      });
      zipFile.on('error', reject);
      zipFile.readEntry();
    });
  });
}

// Split `items` into consecutive batches of at most `size`.
export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    batches.push(items.slice(i, i + size));
  return batches;
}
