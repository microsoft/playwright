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
import zlib from 'zlib';
import { Transform } from 'stream';
import path from 'path';
import { execSync } from 'child_process';

class TarHeader {
  static parseHeader(buffer) {
    if (buffer.length < 512)
      return null;

    let name = buffer.toString('utf8', 0, 100).replace(/\0/g, '');
    const prefixField = buffer.toString('utf8', 345, 500).replace(/\0/g, '');
    if (prefixField)
      name = path.join(prefixField, name);


    const size = parseInt(buffer.toString('utf8', 124, 136).trim(), 8);
    const typeFlag = buffer[156];
    const mode = parseInt(buffer.toString('utf8', 100, 108).trim(), 8);
    const linkname = buffer.toString('utf8', 157, 257).replace(/\0/g, '');

    // Parse user and group IDs
    const uid = parseInt(buffer.toString('utf8', 108, 116).trim(), 8);
    const gid = parseInt(buffer.toString('utf8', 116, 124).trim(), 8);

    let type = 'file';
    if (typeFlag === 53) // ASCII '5'
      type = 'directory';
    else if (typeFlag === 50) // ASCII '2'
      type = 'symlink';
    else if (typeFlag === 0 || typeFlag === 48) // ASCII '0'
      type = 'file';

    return {
      name: name.replace(/^\/+/, ''),
      size,
      type,
      mode: mode || 0o644,
      linkname,
      uid,
      gid
    };
  }
}

class TarTransformer extends Transform {
  constructor(outputPath, prefix = 'chrome-mac') {
    super();
    this.outputPath = outputPath;
    this.prefix = prefix;
    this.buffer = Buffer.alloc(0);
    this.currentHeader = null;
    this.remainingBytes = 0;
    this.symlinksToCreate = new Map();
    this.currentFileStream = null;
    this.filesToChmod = new Set();
  }

  async mkdir(dir) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      // Set proper permissions for directories
      await fs.promises.chmod(dir, 0o755);
    } catch (err) {
      if (err.code !== 'EEXIST')
        throw err;
    }
  }

  normalizePath(headerName) {
    if (!headerName.startsWith(this.prefix))
      return path.join(this.prefix, headerName);

    return headerName;
  }

  async processHeader(header) {
    const normalizedPath = this.normalizePath(header.name);
    const fullPath = path.join(this.outputPath, normalizedPath);
    await this.mkdir(path.dirname(fullPath));

    if (header.type === 'directory') {
      await this.mkdir(fullPath);
      return null;
    }

    if (header.type === 'symlink') {
      this.symlinksToCreate.set(fullPath, header.linkname);
      return null;
    }

    // Track files that need chmod
    this.filesToChmod.add({ path: fullPath, mode: header.mode });

    return fs.createWriteStream(fullPath, { mode: header.mode });
  }

  async createSymlinks() {
    for (const [symlinkPath, targetPath] of this.symlinksToCreate) {
      try {
        const linkDir = path.dirname(symlinkPath);

        try {
          await fs.promises.unlink(symlinkPath);
        } catch (err) {
          if (err.code !== 'ENOENT')
            throw err;
        }

        await fs.promises.symlink(targetPath, symlinkPath);
      } catch (err) {
        console.error(`Failed to create symlink ${symlinkPath} -> ${targetPath}:`, err);
      }
    }
  }

  async fixMacOSApp() {
    try {
      const appPath = path.join(this.outputPath, this.prefix, 'Chromium.app');

      // Remove quarantine attribute
      execSync(`xattr -r -d com.apple.quarantine "${appPath}"`, { stdio: 'ignore' });

      // Set proper permissions recursively
      execSync(`chmod -R u+x "${appPath}"`, { stdio: 'ignore' });

      // Mark as executable
      execSync(`chmod +x "${appPath}/Contents/MacOS/Chromium"`, { stdio: 'ignore' });

      // Fix permissions for all binary files
      for (const file of this.filesToChmod) {
        if ((file.mode & 0o111) !== 0) { // If file has any execute bits
          await fs.promises.chmod(file.path, file.mode);
        }
      }
    } catch (err) {
      console.error('Error fixing macOS app:', err);
    }
  }

  async processHeader(header) {
    const normalizedPath = this.normalizePath(header.name);
    const fullPath = path.join(this.outputPath, normalizedPath);
    await this.mkdir(path.dirname(fullPath));

    if (header.type === 'directory') {
      await this.mkdir(fullPath);
      return null;
    }

    if (header.type === 'symlink') {
      this.symlinksToCreate.set(fullPath, header.linkname);
      return null;
    }

    return fs.createWriteStream(fullPath, { mode: header.mode });
  }

  async createSymlinks() {
    for (const [symlinkPath, targetPath] of this.symlinksToCreate) {
      try {
        const linkDir = path.dirname(symlinkPath);
        const resolvedTarget = path.resolve(linkDir, targetPath);

        try {
          await fs.promises.unlink(symlinkPath);
        } catch (err) {
          if (err.code !== 'ENOENT')
            throw err;
        }

        await fs.promises.symlink(targetPath, symlinkPath);
      } catch (err) {
        console.error(`Failed to create symlink ${symlinkPath} -> ${targetPath}:`, err);
      }
    }
  }

  // ... rest of the implementation (same _transform and other methods) ...

  async _transform(chunk, encoding, callback) {
    try {
      this.buffer = Buffer.concat([this.buffer, chunk]);

      while (this.buffer.length >= 512) {
        if (!this.currentHeader) {
          // Check for end of archive (two consecutive zero blocks)
          if (this.buffer.slice(0, 512).every(byte => byte === 0)) {
            this.buffer = this.buffer.slice(512);
            continue;
          }

          const header = TarHeader.parseHeader(this.buffer);
          if (!header)
            break;

          this.currentHeader = header;
          this.remainingBytes = header.size;
          this.buffer = this.buffer.slice(512);

          if (header.size > 0)
            this.currentFileStream = await this.processHeader(header);
          else
            await this.processHeader(header); // For symlinks and directories

          continue;
        }

        const blockSize = Math.min(this.remainingBytes, this.buffer.length);
        if (blockSize === 0) {
          this.currentHeader = null;
          this.currentFileStream = null;
          continue;
        }

        const dataChunk = this.buffer.slice(0, blockSize);
        this.buffer = this.buffer.slice(blockSize);
        this.remainingBytes -= blockSize;

        if (this.currentFileStream) {
          await new Promise((resolve, reject) => {
            this.currentFileStream.write(dataChunk, err => {
              if (err)
                reject(err);
              else
                resolve();
            });
          });
        }

        // Handle padding
        if (this.remainingBytes === 0) {
          const padding = 512 - (this.currentHeader.size % 512);
          if (padding < 512)
            this.buffer = this.buffer.slice(padding);

          this.currentHeader = null;
          if (this.currentFileStream) {
            await new Promise(resolve => this.currentFileStream.end(resolve));
            this.currentFileStream = null;
          }
        }
      }
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async _flush(callback) {
    try {
      if (this.currentFileStream)
        await new Promise(resolve => this.currentFileStream.end(resolve));

      await this.createSymlinks();
      await this.fixMacOSApp();
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

const inputPath = '/Users/maxschmitt/Downloads/chromium-mac.tar.br';
const outputPath = '/Users/maxschmitt/Downloads';

// Clean up previous extraction
fs.rmSync(path.join(outputPath, 'chrome-mac'), { recursive: true, force: true });

const input = fs.createReadStream(inputPath);
const brotli = zlib.createBrotliDecompress();
const tarTransformer = new TarTransformer(outputPath);

// Add error handlers
input.on('error', err => console.error('Input stream error:', err));
brotli.on('error', err => console.error('Brotli decompression error:', err));
tarTransformer.on('error', err => console.error('Tar extraction error:', err));

// Pipe everything together
input
    .pipe(brotli)
    .pipe(tarTransformer)
    .on('finish', () => console.log('Extraction complete!'));