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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { removeFolders } from './fileUtils';
import { HarBackend } from './harBackend';
import { ManualPromise } from '../utils/isomorphic/manualPromise';
import { ZipFile } from '../utils/zipFile';
import { yauzl, yazl } from '../zipBundle';
import { serializeClientSideCallMetadata } from '../utils/isomorphic/traceUtils';
import { assert } from '../utils/isomorphic/debug';

import type { Platform } from './platform';
import type * as channels from '@protocol/channels';
import type * as har from '@trace/har';
import type EventEmitter from 'events';


export type StackSession = {
  file: string;
  writer: Promise<void>;
  tmpDir: string | undefined;
  callStacks: channels.ClientSideCallMetadata[];
};

export async function zip(platform: Platform, stackSessions: Map<string, StackSession>, params: channels.LocalUtilsZipParams): Promise<void> {
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
    await stackSession.writer;
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
      addFile(sourceFile, 'resources/src@' + await platform.calculateSha1(sourceFile) + '.txt');
  }

  if (params.mode === 'write') {
    // New file, just compress the entries.
    await fs.promises.mkdir(path.dirname(params.zipFile), { recursive: true });
    zipFile.end(undefined, () => {
      zipFile.outputStream.pipe(fs.createWriteStream(params.zipFile))
          .on('close', () => promise.resolve())
          .on('error', error => promise.reject(error));
    });
    await promise;
    await deleteStackSession(platform, stackSessions, params.stacksId);
    return;
  }

  // File already exists. Repack and add new entries.
  const tempFile = params.zipFile + '.tmp';
  await fs.promises.rename(params.zipFile, tempFile);

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
  await promise;
  await deleteStackSession(platform, stackSessions, params.stacksId);
}

async function deleteStackSession(platform: Platform, stackSessions: Map<string, StackSession>, stacksId?: string) {
  const session = stacksId ? stackSessions.get(stacksId) : undefined;
  if (!session)
    return;
  await session.writer;
  if (session.tmpDir)
    await removeFolders(platform, [session.tmpDir]);
  stackSessions.delete(stacksId!);
}

export async function harOpen(platform: Platform, harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarOpenParams): Promise<channels.LocalUtilsHarOpenResult> {
  let harBackend: HarBackend;
  if (params.file.endsWith('.zip')) {
    const zipFile = new ZipFile(params.file);
    const entryNames = await zipFile.entries();
    const harEntryName = entryNames.find(e => e.endsWith('.har'));
    if (!harEntryName)
      return { error: 'Specified archive does not have a .har file' };
    const har = await zipFile.read(harEntryName);
    const harFile = JSON.parse(har.toString()) as har.HARFile;
    harBackend = new HarBackend(platform, harFile, null, zipFile);
  } else {
    const harFile = JSON.parse(await fs.promises.readFile(params.file, 'utf-8')) as har.HARFile;
    harBackend = new HarBackend(platform, harFile, path.dirname(params.file), null);
  }
  harBackends.set(harBackend.id, harBackend);
  return { harId: harBackend.id };
}

export async function harLookup(harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarLookupParams): Promise<channels.LocalUtilsHarLookupResult> {
  const harBackend = harBackends.get(params.harId);
  if (!harBackend)
    return { action: 'error', message: `Internal error: har was not opened` };
  return await harBackend.lookup(params.url, params.method, params.headers, params.postData, params.isNavigationRequest);
}

export async function harClose(harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarCloseParams): Promise<void> {
  const harBackend = harBackends.get(params.harId);
  if (harBackend) {
    harBackends.delete(harBackend.id);
    harBackend.dispose();
  }
}

export async function harUnzip(params: channels.LocalUtilsHarUnzipParams): Promise<void> {
  const dir = path.dirname(params.zipFile);
  const zipFile = new ZipFile(params.zipFile);
  for (const entry of await zipFile.entries()) {
    const buffer = await zipFile.read(entry);
    if (entry === 'har.har')
      await fs.promises.writeFile(params.harFile, buffer);
    else
      await fs.promises.writeFile(path.join(dir, entry), buffer);
  }
  zipFile.close();
  await fs.promises.unlink(params.zipFile);
}

export async function tracingStarted(stackSessions: Map<string, StackSession>, params: channels.LocalUtilsTracingStartedParams): Promise<channels.LocalUtilsTracingStartedResult> {
  let tmpDir = undefined;
  if (!params.tracesDir)
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-tracing-'));
  const traceStacksFile = path.join(params.tracesDir || tmpDir!, params.traceName + '.stacks');
  stackSessions.set(traceStacksFile, { callStacks: [], file: traceStacksFile, writer: Promise.resolve(), tmpDir });
  return { stacksId: traceStacksFile };
}

export async function traceDiscarded(platform: Platform, stackSessions: Map<string, StackSession>, params: channels.LocalUtilsTraceDiscardedParams): Promise<void> {
  await deleteStackSession(platform, stackSessions, params.stacksId);
}

export async function addStackToTracingNoReply(stackSessions: Map<string, StackSession>, params: channels.LocalUtilsAddStackToTracingNoReplyParams): Promise<void> {
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
