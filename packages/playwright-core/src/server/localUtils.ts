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

import fs from 'fs';
import os from 'os';
import path from 'path';

import { calculateSha1 } from './utils/crypto';
import { HarBackend } from './harBackend';
import { ManualPromise } from '../utils/isomorphic/manualPromise';
import { ZipFile } from './utils/zipFile';
import { yauzl, yazl } from '../zipBundle';
import { serializeClientSideCallMetadata } from '../utils/isomorphic/traceUtils';
import { assert } from '../utils/isomorphic/assert';
import { removeFolders } from './utils/fileUtils';

import type * as channels from '@protocol/channels';
import type * as har from '@trace/har';
import type EventEmitter from 'events';
import type { Progress } from '@protocol/progress';


export type StackSession = {
  file: string;
  writer: Promise<void>;
  tmpDir: string | undefined;
  callStacks: channels.ClientSideCallMetadata[];
};

export async function zip(progress: Progress, stackSessions: Map<string, StackSession>, params: channels.LocalUtilsZipParams): Promise<void> {
  const promise = new ManualPromise<void>();
  const zipFile = new yazl.ZipFile();
  (zipFile as any as EventEmitter).on('error', error => promise.reject(error));

  const addFile = (file: string, name: string) => {
    try {
      if (fs.statSync(file).isFile())
        zipFile.addFile(file, name);
    } catch (e) {
    }
  };

  for (const entry of params.entries)
    addFile(entry.value, entry.name);

  // Add stacks and the sources.
  const stackSession = params.stacksId ? stackSessions.get(params.stacksId) : undefined;
  if (stackSession?.callStacks.length) {
    await progress.race(stackSession.writer);
    if (process.env.PW_LIVE_TRACE_STACKS) {
      zipFile.addFile(stackSession.file, 'trace.stacks');
    } else {
      const buffer = Buffer.from(JSON.stringify(serializeClientSideCallMetadata(stackSession.callStacks)));
      zipFile.addBuffer(buffer, 'trace.stacks');
    }
  }

  // Collect sources from stacks.
  if (params.includeSources) {
    const sourceFiles = new Set<string>();
    for (const { stack } of stackSession?.callStacks || []) {
      if (!stack)
        continue;
      for (const { file } of stack)
        sourceFiles.add(file);
    }
    for (const sourceFile of sourceFiles)
      addFile(sourceFile, 'resources/src@' + await calculateSha1(sourceFile) + '.txt');
  }

  if (params.mode === 'write') {
    // New file, just compress the entries.
    await progress.race(fs.promises.mkdir(path.dirname(params.zipFile), { recursive: true }));
    zipFile.end(undefined, () => {
      zipFile.outputStream.pipe(fs.createWriteStream(params.zipFile))
          .on('close', () => promise.resolve())
          .on('error', error => promise.reject(error));
    });
    await progress.race(promise);
    await deleteStackSession(progress, stackSessions, params.stacksId);
    return;
  }

  // File already exists. Repack and add new entries.
  const tempFile = params.zipFile + '.tmp';
  await progress.race(fs.promises.rename(params.zipFile, tempFile));

  yauzl.open(tempFile, (err, inZipFile) => {
    if (err) {
      promise.reject(err);
      return;
    }
    assert(inZipFile);
    let pendingEntries = inZipFile.entryCount;
    inZipFile.on('entry', entry => {
      inZipFile.openReadStream(entry, (err, readStream) => {
        if (err) {
          promise.reject(err);
          return;
        }
        zipFile.addReadStream(readStream!, entry.fileName);
        if (--pendingEntries === 0) {
          zipFile.end(undefined, () => {
            zipFile.outputStream.pipe(fs.createWriteStream(params.zipFile)).on('close', () => {
              fs.promises.unlink(tempFile).then(() => {
                promise.resolve();
              }).catch(error => promise.reject(error));
            });
          });
        }
      });
    });
  });
  await progress.race(promise);
  await deleteStackSession(progress, stackSessions, params.stacksId);
}

async function deleteStackSession(progress: Progress, stackSessions: Map<string, StackSession>, stacksId?: string) {
  const session = stacksId ? stackSessions.get(stacksId) : undefined;
  if (!session)
    return;
  stackSessions.delete(stacksId!);
  if (session.tmpDir)
    await progress.race(removeFolders([session.tmpDir]));
}

export async function harOpen(progress: Progress, harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarOpenParams): Promise<channels.LocalUtilsHarOpenResult> {
  let harBackend: HarBackend;
  if (params.file.endsWith('.zip')) {
    const zipFile = new ZipFile(params.file);
    const entryNames = await zipFile.entries();
    const harEntryName = entryNames.find(e => e.endsWith('.har'));
    if (!harEntryName)
      return { error: 'Specified archive does not have a .har file' };
    const har = await progress.raceWithCleanup(zipFile.read(harEntryName), () => zipFile.close());
    const harFile = JSON.parse(har.toString()) as har.HARFile;
    harBackend = new HarBackend(harFile, null, zipFile);
  } else {
    const harFile = JSON.parse(await progress.race(fs.promises.readFile(params.file, 'utf-8'))) as har.HARFile;
    harBackend = new HarBackend(harFile, path.dirname(params.file), null);
  }
  harBackends.set(harBackend.id, harBackend);
  return { harId: harBackend.id };
}

export async function harLookup(progress: Progress, harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarLookupParams): Promise<channels.LocalUtilsHarLookupResult> {
  const harBackend = harBackends.get(params.harId);
  if (!harBackend)
    return { action: 'error', message: `Internal error: har was not opened` };
  return await progress.race(harBackend.lookup(params.url, params.method, params.headers, params.postData, params.isNavigationRequest));
}

export function harClose(harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarCloseParams) {
  const harBackend = harBackends.get(params.harId);
  if (harBackend) {
    harBackends.delete(harBackend.id);
    harBackend.dispose();
  }
}

export async function harUnzip(progress: Progress, params: channels.LocalUtilsHarUnzipParams): Promise<void> {
  const dir = path.dirname(params.zipFile);
  const zipFile = new ZipFile(params.zipFile);
  progress.cleanupWhenAborted(() => zipFile.close());
  for (const entry of await progress.race(zipFile.entries())) {
    const buffer = await progress.race(zipFile.read(entry));
    if (entry === 'har.har')
      await progress.race(fs.promises.writeFile(params.harFile, buffer));
    else
      await progress.race(fs.promises.writeFile(path.join(dir, entry), buffer));
  }
  await progress.race(fs.promises.unlink(params.zipFile));
  zipFile.close();
}

export async function tracingStarted(progress: Progress, stackSessions: Map<string, StackSession>, params: channels.LocalUtilsTracingStartedParams): Promise<channels.LocalUtilsTracingStartedResult> {
  let tmpDir = undefined;
  if (!params.tracesDir)
    tmpDir = await progress.race(fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-tracing-')));
  const traceStacksFile = path.join(params.tracesDir || tmpDir!, params.traceName + '.stacks');
  stackSessions.set(traceStacksFile, { callStacks: [], file: traceStacksFile, writer: Promise.resolve(), tmpDir });
  return { stacksId: traceStacksFile };
}

export async function traceDiscarded(progress: Progress, stackSessions: Map<string, StackSession>, params: channels.LocalUtilsTraceDiscardedParams): Promise<void> {
  await deleteStackSession(progress, stackSessions, params.stacksId);
}

export function addStackToTracingNoReply(stackSessions: Map<string, StackSession>, params: channels.LocalUtilsAddStackToTracingNoReplyParams) {
  for (const session of stackSessions.values()) {
    session.callStacks.push(params.callData);
    if (process.env.PW_LIVE_TRACE_STACKS) {
      session.writer = session.writer.then(() => {
        const buffer = Buffer.from(JSON.stringify(serializeClientSideCallMetadata(session.callStacks)));
        return fs.promises.writeFile(session.file, buffer);
      });
    }
  }
}
