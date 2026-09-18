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
import path from 'path';
import { Transform } from 'stream';

import type { TransformCallback } from 'stream';
import type { ZipFile } from 'yazl';

export async function inlineViteApp(appFolder: string, htmlName = 'index.html'): Promise<string> {
  let html = await fs.promises.readFile(path.join(appFolder, htmlName), 'utf-8');
  const [js, css] = await Promise.all([
    fs.promises.readFile(path.join(appFolder, 'report.js'), 'utf-8'),
    fs.promises.readFile(path.join(appFolder, 'report.css'), 'utf-8'),
  ]);
  html = html.replace(/<script type="module"[^>]*><\/script>/, () => `<script type="module">${js}</script>`);
  html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style type='text/css'>${css}</style>`);
  return html;
}

export async function appendZipDataTemplate(filePath: string, zipFile: ZipFile, templateId: string) {
  fs.appendFileSync(filePath, `<template id="${templateId}">data:application/zip;base64,`);
  await new Promise<void>((resolve, reject) => {
    zipFile.end(undefined, () => {
      zipFile.outputStream
          .pipe(new Base64Encoder())
          .pipe(fs.createWriteStream(filePath, { flags: 'a' })).on('close', resolve).on('error', reject);
    });
  });
  fs.appendFileSync(filePath, '</template>');
}

class Base64Encoder extends Transform {
  private _remainder: Buffer | undefined;

  override _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    if (this._remainder) {
      chunk = Buffer.concat([this._remainder, chunk]);
      this._remainder = undefined;
    }

    const remaining = chunk.length % 3;
    if (remaining) {
      this._remainder = chunk.slice(chunk.length - remaining);
      chunk = chunk.slice(0, chunk.length - remaining);
    }
    chunk = chunk.toString('base64');
    this.push(Buffer.from(chunk));
    callback();
  }

  override _flush(callback: TransformCallback): void {
    if (this._remainder)
      this.push(Buffer.from(this._remainder.toString('base64')));
    callback();
  }
}
