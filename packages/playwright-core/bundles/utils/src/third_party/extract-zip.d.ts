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

// Based on the type definitions for extract-zip 1.6
// Definitions by: Mizunashi Mana <https://github.com/mizunashi-mana>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/e69b58e/types/extract-zip/index.d.ts

import { Entry, ZipFile } from 'yauzl';

declare namespace extract {
    interface Options {
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
}

declare function extract(
  zipPath: string,
  opts: extract.Options,
): Promise<void>;

export = extract;
