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

// Fedora WebKit compatibility layer.
//
// Playwright's WebKit is built on Ubuntu 24.04. On Fedora, several libraries
// have ABI-incompatible versions:
//   - libjpeg-turbo: Fedora exports LIBJPEG_6.2, WebKit expects LIBJPEG_8.0
//   - ICU: Fedora ships ICU 75-77+, WebKit built against ICU 74
//   - libjxl: soversion mismatch (Fedora 0.11 vs expected 0.8)
//
// This module downloads compat libraries from Ubuntu 24.04 packages into
// ~/.local/lib/playwright-compat/ and patches WebKit MiniBrowser wrappers
// to use them via LD_LIBRARY_PATH.

import fs from 'fs';
import os from 'os';
import path from 'path';

import { spawnAsync } from '../utils/spawnAsync';

const COMPAT_DIR = process.env.PLAYWRIGHT_COMPAT_DIR || path.join(os.homedir(), '.local', 'lib', 'playwright-compat');

function debArch(): { arch: string, libDir: string } {
  if (os.arch() === 'arm64')
    return { arch: 'arm64', libDir: 'usr/lib/aarch64-linux-gnu' };
  return { arch: 'amd64', libDir: 'usr/lib/x86_64-linux-gnu' };
}

export async function installFedoraWebKitCompat(): Promise<void> {
  await fs.promises.mkdir(path.join(COMPAT_DIR, 'lib64'), { recursive: true });
  await fs.promises.mkdir(path.join(COMPAT_DIR, 'icu'), { recursive: true });

  await installLibjpeg8Compat();
  await installICU74Compat();
  await createLibjxlSymlink();
}

// Downloads Ubuntu 24.04's libjpeg-turbo8 package which provides libjpeg.so.8
// with LIBJPEG_8.0 symbols (Fedora's libjpeg-turbo only exports LIBJPEG_6.2).
async function installLibjpeg8Compat(): Promise<void> {
  const targetLib = path.join(COMPAT_DIR, 'lib64', 'libjpeg.so.8');
  if (fs.existsSync(targetLib)) {
    const result = await spawnAsync('objdump', ['-p', targetLib]);
    if (!result.error && result.stdout.includes('LIBJPEG_8.0')) {
      console.log('Compat libjpeg (LIBJPEG_8.0) already installed.');  // eslint-disable-line no-console
      return;
    }
  }

  console.log('Installing libjpeg with JPEG8 ABI (LIBJPEG_8.0 symbols)...');  // eslint-disable-line no-console

  const { arch, libDir } = debArch();
  const tmpDir = path.join(os.tmpdir(), `playwright-libjpeg-compat-${process.pid}`);
  try {
    await fs.promises.mkdir(tmpDir, { recursive: true });

    const debVersions = ['2.1.5-2ubuntu2', '2.1.5-2ubuntu1', '2.1.5-2build1'];
    const downloaded = await downloadDebPackage(
        debVersions.map(ver => `https://archive.ubuntu.com/ubuntu/pool/main/libj/libjpeg-turbo/libjpeg-turbo8_${ver}_${arch}.deb`),
        path.join(tmpDir, 'libjpeg8.deb'),
    );
    if (!downloaded) {
      console.warn('Could not download libjpeg-turbo8 package. WebKit may not work.');  // eslint-disable-line no-console
      return;
    }

    const extractedDir = await extractDebPackage(tmpDir, 'libjpeg8.deb', libDir);
    if (!extractedDir)
      return;

    const files = await fs.promises.readdir(extractedDir);
    for (const file of files) {
      if (file.startsWith('libjpeg.so.8')) {
        await fs.promises.copyFile(
            path.join(extractedDir, file),
            path.join(COMPAT_DIR, 'lib64', file),
        );
      }
    }
    // Create libjpeg.so.8 symlink if only the versioned file was copied.
    const versionedLib = files.find(f => f.startsWith('libjpeg.so.8.') && !f.endsWith('.so.8'));
    if (versionedLib && !fs.existsSync(targetLib))
      await fs.promises.symlink(versionedLib, targetLib);

    console.log(`Installed compat libjpeg -> ${COMPAT_DIR}/lib64/`);  // eslint-disable-line no-console
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function installICU74Compat(): Promise<void> {
  const icuDir = path.join(COMPAT_DIR, 'icu');
  const marker = path.join(icuDir, 'libicudata.so.74');

  if (fs.existsSync(marker)) {
    console.log('ICU 74 compat libs already installed.');  // eslint-disable-line no-console
    return;
  }

  // Check if system already has ICU 74 (no compat needed).
  if (fs.existsSync('/usr/lib64/libicudata.so.74')) {
    console.log('System ICU is version 74 (no compat needed).');  // eslint-disable-line no-console
    return;
  }

  console.log('Installing ICU 74 compat libraries for WebKit...');  // eslint-disable-line no-console

  const { arch, libDir } = debArch();
  const tmpDir = path.join(os.tmpdir(), `playwright-icu-compat-${process.pid}`);
  try {
    await fs.promises.mkdir(tmpDir, { recursive: true });

    const debVersions = ['74.2-1ubuntu3', '74.2-1ubuntu4', '74.2-1ubuntu3.1'];
    const downloaded = await downloadDebPackage(
        [
          ...debVersions.map(ver => `https://archive.ubuntu.com/ubuntu/pool/main/i/icu/libicu74_${ver}_${arch}.deb`),
        ],
        path.join(tmpDir, 'libicu74.deb'),
    );
    if (!downloaded) {
      console.warn('Could not download ICU 74 package. WebKit may not work.');  // eslint-disable-line no-console
      return;
    }

    const extractedDir = await extractDebPackage(tmpDir, 'libicu74.deb', libDir);
    if (!extractedDir)
      return;

    const files = await fs.promises.readdir(extractedDir);
    let count = 0;
    for (const file of files) {
      if (file.startsWith('libicu') && file.includes('.so.74')) {
        const src = path.join(extractedDir, file);
        const dest = path.join(icuDir, file);
        const stat = await fs.promises.lstat(src);
        if (stat.isSymbolicLink()) {
          const target = await fs.promises.readlink(src);
          await fs.promises.rm(dest, { force: true });
          await fs.promises.symlink(target, dest);
        } else {
          await fs.promises.copyFile(src, dest);
        }
        count++;
      }
    }
    console.log(`Installed ${count} ICU 74 compat libraries -> ${icuDir}/`);  // eslint-disable-line no-console
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function createLibjxlSymlink(): Promise<void> {
  const symlinkPath = path.join(COMPAT_DIR, 'libjxl.so.0.8');
  if (fs.existsSync(symlinkPath))
    return;

  // Find system libjxl. Fedora uses /usr/lib64 for both x86_64 and aarch64.
  const result = await spawnAsync('find', ['/usr/lib64', '-name', 'libjxl.so.0.*', '-not', '-type', 'l'], {});
  if (result.error || result.code !== 0) {
    console.warn('Could not search for system libjxl. WebKit may not work.');  // eslint-disable-line no-console
    return;
  }
  const systemLib = result.stdout.trim().split('\n')[0];
  if (systemLib && fs.existsSync(systemLib)) {
    await fs.promises.symlink(systemLib, symlinkPath);
    console.log(`Created compat symlink: libjxl.so.0.8 -> ${path.basename(systemLib)}`);  // eslint-disable-line no-console
  }
}

// Dedicated marker to ensure patching is idempotent regardless of COMPAT_DIR value.
const COMPAT_PATCH_MARKER = '# playwright-fedora-compat-patched';

export async function patchWebKitWrappers(browserDir: string): Promise<void> {
  const compatLibDir = path.join(COMPAT_DIR, 'lib64');
  const compatIcuDir = path.join(COMPAT_DIR, 'icu');
  let patched = 0;

  // Scan for WebKit installations.
  if (!fs.existsSync(browserDir))
    return;

  const entries = await fs.promises.readdir(browserDir);
  for (const entry of entries) {
    if (!entry.startsWith('webkit-'))
      continue;
    const webkitDir = path.join(browserDir, entry);
    for (const subdir of ['minibrowser-gtk', 'minibrowser-wpe']) {
      const wrapperPath = path.join(webkitDir, subdir, 'MiniBrowser');
      if (!fs.existsSync(wrapperPath))
        continue;
      const content = await fs.promises.readFile(wrapperPath, 'utf8');
      if (content.includes(COMPAT_PATCH_MARKER))
        continue;

      const patchedContent = content.replace(
          'export LD_LIBRARY_PATH="',
          `${COMPAT_PATCH_MARKER}\nexport LD_LIBRARY_PATH="${compatLibDir}:${compatIcuDir}:${COMPAT_DIR}:`
      );
      if (patchedContent === content)
        continue;
      await fs.promises.writeFile(wrapperPath, patchedContent, 'utf8');
      patched++;
    }
  }

  if (patched > 0)
    console.log(`Patched ${patched} WebKit MiniBrowser wrapper(s) for Fedora compatibility.`);  // eslint-disable-line no-console
}

// Tries each URL in order, returns true on first successful download.
async function downloadDebPackage(urls: string[], outputPath: string): Promise<boolean> {
  for (const url of urls) {
    const result = await spawnAsync('curl', ['-fsSL', '-o', outputPath, url]);
    if (result.error)
      continue;
    if (result.code === 0 && fs.existsSync(outputPath))
      return true;
  }
  return false;
}

// Extracts a .deb package and returns the path to the extracted library directory.
async function extractDebPackage(workDir: string, debFilename: string, libDir: string): Promise<string | null> {
  const ar = await spawnAsync('ar', ['x', debFilename], { cwd: workDir });
  if (ar.error || ar.code !== 0) {
    console.warn('Failed to extract .deb package: ' + (ar.error?.message || ar.stderr));  // eslint-disable-line no-console
    return null;
  }

  const dataFiles = await fs.promises.readdir(workDir);
  const dataTar = dataFiles.find(f => f.startsWith('data.tar'));
  if (!dataTar) {
    console.warn('Could not find data.tar in .deb package.');  // eslint-disable-line no-console
    return null;
  }

  const tarArgs: string[] = [];
  if (dataTar.endsWith('.zst'))
    tarArgs.push('--zstd');
  else if (dataTar.endsWith('.xz'))
    tarArgs.push('-J');
  else if (dataTar.endsWith('.gz'))
    tarArgs.push('-z');
  tarArgs.push('-xf', dataTar, `./${libDir}/`);

  const tar = await spawnAsync('tar', tarArgs, { cwd: workDir });
  if (tar.error || tar.code !== 0) {
    console.warn('Failed to extract data archive: ' + (tar.error?.message || tar.stderr));  // eslint-disable-line no-console
    return null;
  }

  const extractedDir = path.join(workDir, libDir);
  if (!fs.existsSync(extractedDir)) {
    console.warn('Could not extract libraries from .deb package.');  // eslint-disable-line no-console
    return null;
  }
  return extractedDir;
}
