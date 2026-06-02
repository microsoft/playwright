/**
 * Copyright (c) 2014 Max Ogden and other contributors
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import stream from 'stream';
import { promisify } from 'util';

import debugPkg from 'debug';
import getStream from 'get-stream';
import yauzl from 'yauzl';
import type { Entry, ZipFile } from 'yauzl';

const debug = debugPkg('extract-zip');

const openZip = promisify<string, yauzl.Options, ZipFile>(yauzl.open);
const pipeline = promisify(stream.pipeline);

export interface Options {
  /** The path to the directory where the extracted files are written */
  dir: string;
  /** Directory Mode (permissions), defaults to `0o755` */
  defaultDirMode?: number;
  /** File Mode (permissions), defaults to `0o644` */
  defaultFileMode?: number;
  /**
   * If present, will be called with (entry, zipfile),
   * entry is every entry from the zip file forwarded
   * from the entry event from yauzl. zipfile is the
   * yauzl instance
   */
  onEntry?: (entry: Entry, zipfile: ZipFile) => void;
}

class Extractor {
  private zipPath: string;
  private opts: Options;
  private zipfile!: ZipFile;
  private canceled = false;

  constructor(zipPath: string, opts: Options) {
    this.zipPath = zipPath;
    this.opts = opts;
  }

  async extract(): Promise<void> {
    debug('opening', this.zipPath, 'with opts', this.opts);

    this.zipfile = await openZip(this.zipPath, { lazyEntries: true });
    this.canceled = false;

    return new Promise<void>((resolve, reject) => {
      this.zipfile.on('error', err => {
        this.canceled = true;
        reject(err);
      });
      this.zipfile.readEntry();

      this.zipfile.on('close', () => {
        if (!this.canceled) {
          debug('zip extraction complete');
          resolve();
        }
      });

      this.zipfile.on('entry', async (entry: Entry) => {
        /* istanbul ignore if */
        if (this.canceled) {
          debug('skipping entry', entry.fileName, { cancelled: this.canceled });
          return;
        }

        debug('zipfile entry', entry.fileName);

        if (entry.fileName.startsWith('__MACOSX/')) {
          this.zipfile.readEntry();
          return;
        }

        const destDir = path.dirname(path.join(this.opts.dir, entry.fileName));

        try {
          await fs.mkdir(destDir, { recursive: true });

          const canonicalDestDir = await fs.realpath(destDir);
          const relativeDestDir = path.relative(this.opts.dir, canonicalDestDir);

          if (relativeDestDir.split(path.sep).includes('..'))
            throw new Error(`Out of bound path "${canonicalDestDir}" found while processing file ${entry.fileName}`);

          await this.extractEntry(entry);
          debug('finished processing', entry.fileName);
          this.zipfile.readEntry();
        } catch (err) {
          this.canceled = true;
          this.zipfile.close();
          reject(err);
        }
      });
    });
  }

  private async extractEntry(entry: Entry): Promise<void> {
    /* istanbul ignore if */
    if (this.canceled) {
      debug('skipping entry extraction', entry.fileName, { cancelled: this.canceled });
      return;
    }

    if (this.opts.onEntry)
      this.opts.onEntry(entry, this.zipfile);

    const dest = path.join(this.opts.dir, entry.fileName);

    // convert external file attr int into a fs stat mode int
    const mode = (entry.externalFileAttributes >> 16) & 0xFFFF;
    // check if it's a symlink or dir (using stat mode constants)
    const IFMT = 61440;
    const IFDIR = 16384;
    const IFLNK = 40960;
    const symlink = (mode & IFMT) === IFLNK;
    let isDir = (mode & IFMT) === IFDIR;

    // Failsafe, borrowed from jsZip
    if (!isDir && entry.fileName.endsWith('/'))
      isDir = true;

    // check for windows weird way of specifying a directory
    // https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
    const madeBy = entry.versionMadeBy >> 8;
    if (!isDir)
      isDir = (madeBy === 0 && entry.externalFileAttributes === 16);

    debug('extracting entry', { filename: entry.fileName, isDir, isSymlink: symlink });

    const procMode = this.getExtractedMode(mode, isDir) & 0o777;

    // always ensure folders are created
    const destDir = isDir ? dest : path.dirname(dest);

    const mkdirOptions: { recursive: true, mode?: number } = { recursive: true };
    if (isDir)
      mkdirOptions.mode = procMode;
    debug('mkdir', { dir: destDir, ...mkdirOptions });
    await fs.mkdir(destDir, mkdirOptions);
    if (isDir)
      return;

    debug('opening read stream', dest);
    const readStream = await promisify<Entry, stream.Readable>(this.zipfile.openReadStream.bind(this.zipfile))(entry);

    if (symlink) {
      const link = await getStream(readStream);
      debug('creating symlink', link, dest);
      await fs.symlink(link, dest);
    } else {
      await pipeline(readStream, createWriteStream(dest, { mode: procMode }));
    }
  }

  private getExtractedMode(entryMode: number, isDir: boolean): number {
    let mode = entryMode;
    // Set defaults, if necessary
    if (mode === 0) {
      if (isDir) {
        if (this.opts.defaultDirMode)
          mode = Number(this.opts.defaultDirMode);

        if (!mode)
          mode = 0o755;
      } else {
        if (this.opts.defaultFileMode)
          mode = Number(this.opts.defaultFileMode);

        if (!mode)
          mode = 0o644;
      }
    }

    return mode;
  }
}

export async function extractZip(zipPath: string, opts: Options): Promise<void> {
  debug('creating target directory', opts.dir);

  if (!path.isAbsolute(opts.dir))
    throw new Error('Target directory is expected to be absolute');

  await fs.mkdir(opts.dir, { recursive: true });
  opts.dir = await fs.realpath(opts.dir);
  return new Extractor(zipPath, opts).extract();
}

export default extractZip;
