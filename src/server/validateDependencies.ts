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
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { getUbuntuVersion } from '../utils/ubuntuVersion';
import { linuxLddDirectories, windowsExeAndDllDirectories, BrowserDescriptor } from '../utils/browserPaths.js';

const accessAsync = util.promisify(fs.access.bind(fs));
const checkExecutable = (filePath: string) => accessAsync(filePath, fs.constants.X_OK).then(() => true).catch(e => false);
const statAsync = util.promisify(fs.stat.bind(fs));
const readdirAsync = util.promisify(fs.readdir.bind(fs));

export async function validateHostRequirements(browserPath: string, browser: BrowserDescriptor) {
  const ubuntuVersion = await getUbuntuVersion();
  if (browser.name === 'firefox' && ubuntuVersion === '16.04')
    throw new Error(`Cannot launch firefox on Ubuntu 16.04! Minimum required Ubuntu version for Firefox browser is 18.04`);
  await validateDependencies(browserPath, browser);
}

const DL_OPEN_LIBRARIES = {
  chromium: [],
  webkit: ['libGLESv2.so.2', 'libx264.so'],
  firefox: [],
};

async function validateDependencies(browserPath: string, browser: BrowserDescriptor) {
  // We currently only support Linux.
  if (os.platform() === 'linux')
    return await validateDependenciesLinux(browserPath, browser);
  if (os.platform() === 'win32' && os.arch() === 'x64')
    return await validateDependenciesWindows(browserPath, browser);
}

async function validateDependenciesWindows(browserPath: string, browser: BrowserDescriptor) {
  const directoryPaths = windowsExeAndDllDirectories(browserPath, browser);
  const lddPaths: string[] = [];
  for (const directoryPath of directoryPaths)
    lddPaths.push(...(await executablesOrSharedLibraries(directoryPath)));
  const allMissingDeps = await Promise.all(lddPaths.map(lddPath => missingFileDependenciesWindows(lddPath)));
  const missingDeps: Set<string> = new Set();
  for (const deps of allMissingDeps) {
    for (const dep of deps)
      missingDeps.add(dep);
  }

  if (!missingDeps.size)
    return;

  let isCrtMissing = false;
  let isMediaFoundationMissing = false;
  for (const dep of missingDeps) {
    if (dep.startsWith('api-ms-win-crt') || dep === 'vcruntime140.dll' || dep === 'msvcp140.dll')
      isCrtMissing = true;
    else if (dep === 'mf.dll' || dep === 'mfplat.dll' ||  dep === 'msmpeg2vdec.dll' || dep === 'evr.dll' || dep === 'avrt.dll')
      isMediaFoundationMissing = true;
  }

  const details = [];

  if (isCrtMissing) {
    details.push(
        `Some of the Universal C Runtime files cannot be found on the system. You can fix`,
        `that by installing Microsoft Visual C++ Redistributable for Visual Studio from:`,
        `https://support.microsoft.com/en-us/help/2977003/the-latest-supported-visual-c-downloads`,
        ``);
  }

  if (isMediaFoundationMissing) {
    details.push(
        `Some of the Media Foundation files cannot be found on the system. If you are`,
        `on Windows Server try fixing this by running the following command in PowerShell`,
        `as Administrator:`,
        ``,
        `    Install-WindowsFeature Server-Media-Foundation`,
        ``,
        `For Windows N editions visit:`,
        `https://support.microsoft.com/en-us/help/3145500/media-feature-pack-list-for-windows-n-editions`,
        ``);
  }

  details.push(
      `Full list of missing libraries:`,
      `    ${[...missingDeps].join('\n    ')}`,
      ``);

  throw new Error(`Host system is missing dependencies!\n\n${details.join('\n')}`);
}

async function validateDependenciesLinux(browserPath: string, browser: BrowserDescriptor) {
  const directoryPaths = linuxLddDirectories(browserPath, browser);
  const lddPaths: string[] = [];
  for (const directoryPath of directoryPaths)
    lddPaths.push(...(await executablesOrSharedLibraries(directoryPath)));
  const allMissingDeps = await Promise.all(lddPaths.map(lddPath => missingFileDependencies(lddPath)));
  const missingDeps: Set<string> = new Set();
  for (const deps of allMissingDeps) {
    for (const dep of deps)
      missingDeps.add(dep);
  }
  for (const dep of (await missingDLOPENLibraries(browser)))
    missingDeps.add(dep);
  if (!missingDeps.size)
    return;
  // Check Ubuntu version.
  const missingPackages = new Set();

  const ubuntuVersion = await getUbuntuVersion();
  let libraryToPackageNameMapping = null;
  if (ubuntuVersion === '18.04')
    libraryToPackageNameMapping = LIBRARY_TO_PACKAGE_NAME_UBUNTU_18_04;
  else if (ubuntuVersion === '20.04')
    libraryToPackageNameMapping = LIBRARY_TO_PACKAGE_NAME_UBUNTU_20_04;
  libraryToPackageNameMapping = Object.assign({}, libraryToPackageNameMapping, MANUAL_LIBRARY_TO_PACKAGE_NAME_UBUNTU);
  if (libraryToPackageNameMapping) {
    // Translate missing dependencies to package names to install with apt.
    for (const missingDep of missingDeps) {
      const packageName = libraryToPackageNameMapping[missingDep];
      if (packageName) {
        missingPackages.add(packageName);
        missingDeps.delete(missingDep);
      }
    }
  }

  let missingPackagesMessage = '';
  if (missingPackages.size) {
    missingPackagesMessage = [
      `  Install missing packages with:`,
      `      sudo apt-get install ${[...missingPackages].join('\\\n          ')}`,
      ``,
      ``,
    ].join('\n');
  }

  let missingDependenciesMessage = '';
  if (missingDeps.size) {
    const header = missingPackages.size ? `Missing libraries we didn't find packages for:` : `Missing libraries are:`;
    missingDependenciesMessage = [
      `  ${header}`,
      `      ${[...missingDeps].join('\n      ')}`,
      ``,
    ].join('\n');
  }

  throw new Error('Host system is missing dependencies!\n\n' + missingPackagesMessage + missingDependenciesMessage);
}

function isSharedLib(basename: string) {
  switch (os.platform()) {
    case 'linux':
      return basename.endsWith('.so') || basename.includes('.so.');
    case 'win32':
      return basename.endsWith('.dll');
    default:
      return false;
  }
}

async function executablesOrSharedLibraries(directoryPath: string): Promise<string[]> {
  const allPaths = (await readdirAsync(directoryPath)).map(file => path.resolve(directoryPath, file));
  const allStats = await Promise.all(allPaths.map(aPath => statAsync(aPath)));
  const filePaths = allPaths.filter((aPath, index) => allStats[index].isFile());

  const executablersOrLibraries = (await Promise.all(filePaths.map(async filePath => {
    const basename = path.basename(filePath).toLowerCase();
    if (isSharedLib(basename))
      return filePath;
    if (await checkExecutable(filePath))
      return filePath;
    return false;
  }))).filter(Boolean);

  return executablersOrLibraries as string[];
}

async function missingFileDependenciesWindows(filePath: string): Promise<Array<string>> {
  const dirname = path.dirname(filePath);
  const printDepsWindowsExecutable = process.env.PW_PRINT_DEPS_WINDOWS_EXECUTABLE || path.join(__dirname, '../../bin/PrintDeps.exe');
  const {stdout, code} = await spawnAsync(printDepsWindowsExecutable, [filePath], {
    cwd: dirname,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ? `${process.env.LD_LIBRARY_PATH}:${dirname}` : dirname,
    },
  });
  if (code !== 0)
    return [];
  const missingDeps = stdout.split('\n').map(line => line.trim()).filter(line => line.endsWith('not found') && line.includes('=>')).map(line => line.split('=>')[0].trim().toLowerCase());
  return missingDeps;
}

async function missingFileDependencies(filePath: string): Promise<Array<string>> {
  const dirname = path.dirname(filePath);
  const {stdout, code} = await spawnAsync('ldd', [filePath], {
    cwd: dirname,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ? `${process.env.LD_LIBRARY_PATH}:${dirname}` : dirname,
    },
  });
  if (code !== 0)
    return [];
  const missingDeps = stdout.split('\n').map(line => line.trim()).filter(line => line.endsWith('not found') && line.includes('=>')).map(line => line.split('=>')[0].trim().toLowerCase());
  return missingDeps;
}

async function missingDLOPENLibraries(browser: BrowserDescriptor): Promise<string[]> {
  const libraries = DL_OPEN_LIBRARIES[browser.name];
  if (!libraries.length)
    return [];
  // NOTE: Using full-qualified path to `ldconfig` since `/sbin` is not part of the
  // default PATH in CRON.
  // @see https://github.com/microsoft/playwright/issues/3397
  const {stdout, code, error} = await spawnAsync('/sbin/ldconfig', ['-p'], {});
  if (code !== 0 || error)
    return [];
  const isLibraryAvailable = (library: string) => stdout.toLowerCase().includes(library.toLowerCase());
  return libraries.filter(library => !isLibraryAvailable(library));
}

export function spawnAsync(cmd: string, args: string[], options: any): Promise<{stdout: string, stderr: string, code: number, error?: Error}> {
  const process = spawn(cmd, args, options);

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    process.stdout.on('data', data => stdout += data);
    process.stderr.on('data', data => stderr += data);
    process.on('close', code => resolve({stdout, stderr, code}));
    process.on('error', error => resolve({stdout, stderr, code: 0, error}));
  });
}

// This list is generted with the following program:
// ./utils/linux-browser-dependencies/run.sh ubuntu:18.04
const LIBRARY_TO_PACKAGE_NAME_UBUNTU_18_04: { [s: string]: string} = {
  'libasound.so.2': 'libasound2',
  'libatk-1.0.so.0': 'libatk1.0-0',
  'libatk-bridge-2.0.so.0': 'libatk-bridge2.0-0',
  'libatspi.so.0': 'libatspi2.0-0',
  'libbrotlidec.so.1': 'libbrotli1',
  'libcairo-gobject.so.2': 'libcairo-gobject2',
  'libcairo.so.2': 'libcairo2',
  'libcups.so.2': 'libcups2',
  'libdbus-1.so.3': 'libdbus-1-3',
  'libdbus-glib-1.so.2': 'libdbus-glib-1-2',
  'libdrm.so.2': 'libdrm2',
  'libEGL.so.1': 'libegl1',
  'libenchant.so.1': 'libenchant1c2a',
  'libepoxy.so.0': 'libepoxy0',
  'libfontconfig.so.1': 'libfontconfig1',
  'libfreetype.so.6': 'libfreetype6',
  'libgbm.so.1': 'libgbm1',
  'libgdk_pixbuf-2.0.so.0': 'libgdk-pixbuf2.0-0',
  'libgdk-3.so.0': 'libgtk-3-0',
  'libgdk-x11-2.0.so.0': 'libgtk2.0-0',
  'libgio-2.0.so.0': 'libglib2.0-0',
  'libGL.so.1': 'libgl1',
  'libGLESv2.so.2': 'libgles2',
  'libglib-2.0.so.0': 'libglib2.0-0',
  'libgmodule-2.0.so.0': 'libglib2.0-0',
  'libgobject-2.0.so.0': 'libglib2.0-0',
  'libgstapp-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstaudio-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstbase-1.0.so.0': 'libgstreamer1.0-0',
  'libgstcodecparsers-1.0.so.0': 'libgstreamer-plugins-bad1.0-0',
  'libgstfft-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstgl-1.0.so.0': 'libgstreamer-gl1.0-0',
  'libgstpbutils-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstreamer-1.0.so.0': 'libgstreamer1.0-0',
  'libgsttag-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstvideo-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgthread-2.0.so.0': 'libglib2.0-0',
  'libgtk-3.so.0': 'libgtk-3-0',
  'libgtk-x11-2.0.so.0': 'libgtk2.0-0',
  'libharfbuzz-icu.so.0': 'libharfbuzz-icu0',
  'libharfbuzz.so.0': 'libharfbuzz0b',
  'libhyphen.so.0': 'libhyphen0',
  'libicui18n.so.60': 'libicu60',
  'libicuuc.so.60': 'libicu60',
  'libjpeg.so.8': 'libjpeg-turbo8',
  'libnotify.so.4': 'libnotify4',
  'libnspr4.so': 'libnspr4',
  'libnss3.so': 'libnss3',
  'libnssutil3.so': 'libnss3',
  'libopenjp2.so.7': 'libopenjp2-7',
  'libopus.so.0': 'libopus0',
  'libpango-1.0.so.0': 'libpango-1.0-0',
  'libpangocairo-1.0.so.0': 'libpangocairo-1.0-0',
  'libpangoft2-1.0.so.0': 'libpangoft2-1.0-0',
  'libpng16.so.16': 'libpng16-16',
  'libsecret-1.so.0': 'libsecret-1-0',
  'libsmime3.so': 'libnss3',
  'libvpx.so.5': 'libvpx5',
  'libwayland-client.so.0': 'libwayland-client0',
  'libwayland-egl.so.1': 'libwayland-egl1',
  'libwayland-server.so.0': 'libwayland-server0',
  'libwebp.so.6': 'libwebp6',
  'libwebpdemux.so.2': 'libwebpdemux2',
  'libwoff2dec.so.1.0.2': 'libwoff1',
  'libX11-xcb.so.1': 'libx11-xcb1',
  'libX11.so.6': 'libx11-6',
  'libxcb-dri3.so.0': 'libxcb-dri3-0',
  'libxcb-shm.so.0': 'libxcb-shm0',
  'libxcb.so.1': 'libxcb1',
  'libXcomposite.so.1': 'libxcomposite1',
  'libXcursor.so.1': 'libxcursor1',
  'libXdamage.so.1': 'libxdamage1',
  'libXext.so.6': 'libxext6',
  'libXfixes.so.3': 'libxfixes3',
  'libXi.so.6': 'libxi6',
  'libxkbcommon.so.0': 'libxkbcommon0',
  'libxml2.so.2': 'libxml2',
  'libXrandr.so.2': 'libxrandr2',
  'libXrender.so.1': 'libxrender1',
  'libxslt.so.1': 'libxslt1.1',
  'libXt.so.6': 'libxt6',
  'libXtst.so.6': 'libxtst6',
};

// This list is generted with the following program:
// ./utils/linux-browser-dependencies/run.sh ubuntu:20.04
const LIBRARY_TO_PACKAGE_NAME_UBUNTU_20_04: { [s: string]: string} = {
  'libasound.so.2': 'libasound2',
  'libatk-1.0.so.0': 'libatk1.0-0',
  'libatk-bridge-2.0.so.0': 'libatk-bridge2.0-0',
  'libatspi.so.0': 'libatspi2.0-0',
  'libcairo-gobject.so.2': 'libcairo-gobject2',
  'libcairo.so.2': 'libcairo2',
  'libcups.so.2': 'libcups2',
  'libdbus-1.so.3': 'libdbus-1-3',
  'libdbus-glib-1.so.2': 'libdbus-glib-1-2',
  'libdrm.so.2': 'libdrm2',
  'libEGL.so.1': 'libegl1',
  'libenchant.so.1': 'libenchant1c2a',
  'libepoxy.so.0': 'libepoxy0',
  'libfontconfig.so.1': 'libfontconfig1',
  'libfreetype.so.6': 'libfreetype6',
  'libgbm.so.1': 'libgbm1',
  'libgdk_pixbuf-2.0.so.0': 'libgdk-pixbuf2.0-0',
  'libgdk-3.so.0': 'libgtk-3-0',
  'libgdk-x11-2.0.so.0': 'libgtk2.0-0',
  'libgio-2.0.so.0': 'libglib2.0-0',
  'libGL.so.1': 'libgl1',
  'libGLESv2.so.2': 'libgles2',
  'libglib-2.0.so.0': 'libglib2.0-0',
  'libgmodule-2.0.so.0': 'libglib2.0-0',
  'libgobject-2.0.so.0': 'libglib2.0-0',
  'libgstapp-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstaudio-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstbase-1.0.so.0': 'libgstreamer1.0-0',
  'libgstcodecparsers-1.0.so.0': 'libgstreamer-plugins-bad1.0-0',
  'libgstfft-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstgl-1.0.so.0': 'libgstreamer-gl1.0-0',
  'libgstpbutils-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstreamer-1.0.so.0': 'libgstreamer1.0-0',
  'libgsttag-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgstvideo-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
  'libgthread-2.0.so.0': 'libglib2.0-0',
  'libgtk-3.so.0': 'libgtk-3-0',
  'libgtk-x11-2.0.so.0': 'libgtk2.0-0',
  'libharfbuzz-icu.so.0': 'libharfbuzz-icu0',
  'libharfbuzz.so.0': 'libharfbuzz0b',
  'libhyphen.so.0': 'libhyphen0',
  'libicui18n.so.66': 'libicu66',
  'libicuuc.so.66': 'libicu66',
  'libjpeg.so.8': 'libjpeg-turbo8',
  'libnotify.so.4': 'libnotify4',
  'libnspr4.so': 'libnspr4',
  'libnss3.so': 'libnss3',
  'libnssutil3.so': 'libnss3',
  'libopenjp2.so.7': 'libopenjp2-7',
  'libopus.so.0': 'libopus0',
  'libpango-1.0.so.0': 'libpango-1.0-0',
  'libpangocairo-1.0.so.0': 'libpangocairo-1.0-0',
  'libpangoft2-1.0.so.0': 'libpangoft2-1.0-0',
  'libpng16.so.16': 'libpng16-16',
  'libsecret-1.so.0': 'libsecret-1-0',
  'libsmime3.so': 'libnss3',
  'libsoup-2.4.so.1': 'libsoup2.4-1',
  'libvpx.so.6': 'libvpx6',
  'libwayland-client.so.0': 'libwayland-client0',
  'libwayland-egl.so.1': 'libwayland-egl1',
  'libwayland-server.so.0': 'libwayland-server0',
  'libwebp.so.6': 'libwebp6',
  'libwebpdemux.so.2': 'libwebpdemux2',
  'libwoff2dec.so.1.0.2': 'libwoff1',
  'libX11-xcb.so.1': 'libx11-xcb1',
  'libX11.so.6': 'libx11-6',
  'libxcb-dri3.so.0': 'libxcb-dri3-0',
  'libxcb-shm.so.0': 'libxcb-shm0',
  'libxcb.so.1': 'libxcb1',
  'libXcomposite.so.1': 'libxcomposite1',
  'libXcursor.so.1': 'libxcursor1',
  'libXdamage.so.1': 'libxdamage1',
  'libXext.so.6': 'libxext6',
  'libXfixes.so.3': 'libxfixes3',
  'libXi.so.6': 'libxi6',
  'libxkbcommon.so.0': 'libxkbcommon0',
  'libxml2.so.2': 'libxml2',
  'libXrandr.so.2': 'libxrandr2',
  'libXrender.so.1': 'libxrender1',
  'libxslt.so.1': 'libxslt1.1',
  'libXt.so.6': 'libxt6',
  'libXtst.so.6': 'libxtst6',
};

const MANUAL_LIBRARY_TO_PACKAGE_NAME_UBUNTU: { [s: string]: string} = {
  // libgstlibav.so (the only actual library provided by gstreamer1.0-libav) is not
  // in the ldconfig cache, so we detect the actual library required for playing h.264
  // and if it's missing recommend installing missing gstreamer lib.
  // gstreamer1.0-libav -> libavcodec57 -> libx264-152
  'libx264.so': 'gstreamer1.0-libav',
};
