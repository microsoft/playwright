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

type ListOptions = {
  ingested: Set<string>;
  lookbackDays: number;
  stopAfterSeen: number;
};

type RawArtifact = {
  id: number;
  name: string;
  expired: boolean;
  created_at: string;
};

// Thin GitHub REST client over global fetch. Only the three endpoints this CLI
// needs: list artifacts, list by name, and download an artifact zip.
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

  // Return the not-yet-ingested artifacts matching `prefix`, walking the list
  // from the top and stopping early once we're safely into the already-ingested
  // region.
  //
  // The list is ordered by descending artifact id, and GitHub assigns ids as a
  // monotonic creation-order sequence (verified: no inversions across a 1000-
  // artifact sample). So the newest artifacts are always at the head. An artifact
  // gets its id when its upload *starts* but only appears in the list once the
  // upload *finalizes*, so the single way one can surface below where a prior
  // scan stopped is a still-in-flight upload finalizing late -- a window bounded
  // by one artifact's upload+list latency (seconds, for these KB parquet files).
  // We therefore keep scanning `stopAfterSeen` artifacts past the newest
  // already-ingested one as a cushion; any new (un-ingested) artifact resets the
  // counter. To bury a late finalizer we'd need `stopAfterSeen` newer artifacts
  // ingested above it while it uploads, i.e. an upload outlasting a whole cron
  // interval -- impossible here, so this misses nothing in practice.
  //
  // `lookbackDays` is the absolute backstop for the first run, when nothing is
  // ingested yet and the cushion never triggers.
  async listArtifacts(prefix: string, options: ListOptions): Promise<Artifact[]> {
    const { ingested, lookbackDays, stopAfterSeen } = options;
    const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const out: Artifact[] = [];
    const queued = new Set<string>();
    let seen = 0;
    for await (const artifact of this._paginateArtifacts('/actions/artifacts?per_page=100')) {
      const createdAt = artifact.created_at ? Date.parse(artifact.created_at) : 0;
      if (createdAt && createdAt < cutoff)
        return out;
      if (artifact.expired || !artifact.name.startsWith(prefix))
        continue;
      const id = String(artifact.id);
      if (queued.has(id))
        continue;
      if (ingested.has(id)) {
        if (++seen >= stopAfterSeen)
          return out;
        continue;
      }
      seen = 0;
      queued.add(id);
      out.push({ id, name: artifact.name });
    }
    return out;
  }

  // The newest non-expired artifact with the exact name, or null if none.
  async findLatestArtifact(name: string): Promise<string | null> {
    const query = `/actions/artifacts?name=${encodeURIComponent(name)}&per_page=100`;
    for await (const artifact of this._paginateArtifacts(query)) {
      if (!artifact.expired)
        return String(artifact.id);
    }
    return null;
  }

  async downloadArtifactZip(id: string): Promise<Buffer> {
    // 302 -> blob storage; fetch follows it and strips the Authorization header
    // on the cross-origin redirect, as required by the signed URL.
    const response = await fetch(`${this._base}/actions/artifacts/${id}/zip`, { headers: this._headers });
    if (!response.ok)
      throw new Error(`Failed to download artifact ${id}: ${response.status} ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  }

  private async * _paginateArtifacts(path: string): AsyncGenerator<RawArtifact> {
    let url: string | null = `${this._base}${path}`;
    while (url) {
      const response = await fetch(url, { headers: this._headers });
      if (!response.ok)
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} for ${url}`);
      const body = await response.json() as { artifacts?: RawArtifact[] };
      for (const artifact of body.artifacts ?? [])
        yield artifact;
      url = nextPageUrl(response.headers.get('link'));
    }
  }
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
