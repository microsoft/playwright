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
import { getUbuntuVersion } from '../helper';
import { linuxLddDirectories, BrowserDescriptor } from '../install/browserPaths.js';

const accessAsync = util.promisify(fs.access.bind(fs));
const checkExecutable = (filePath: string) => accessAsync(filePath, fs.constants.X_OK).then(() => true).catch(e => false);
const statAsync = util.promisify(fs.stat.bind(fs));
const readdirAsync = util.promisify(fs.readdir.bind(fs));

export async function validateDependencies(browserPath: string, browser: BrowserDescriptor) {
  // We currently only support Linux.
  if (os.platform() !== 'linux')
    return;
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
  if (!missingDeps.size)
    return;
  // Check Ubuntu version.
  const missingPackages = new Set();

  const ubuntuVersion = await getUbuntuVersion();
  if (ubuntuVersion === '18.04') {
    // Translate missing dependencies to package names to install with apt.
    for (const missingDep of missingDeps) {
      const packageName = LIBRARY_TO_PACKAGE_NAME_UBUNTU_18_04[missingDep];
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
      `      apt-get install ${[...missingPackages].join('\\\n          ')}`,
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

async function executablesOrSharedLibraries(directoryPath: string): Promise<string[]> {
  const allPaths = (await readdirAsync(directoryPath)).map(file => path.resolve(directoryPath, file));
  const allStats = await Promise.all(allPaths.map(aPath => statAsync(aPath)));
  const filePaths = allPaths.filter((aPath, index) => allStats[index].isFile());

  const executablersOrLibraries = (await Promise.all(filePaths.map(async filePath => {
    const basename = path.basename(filePath).toLowerCase();
    if (basename.endsWith('.so') || basename.includes('.so.'))
      return filePath;
    if (await checkExecutable(filePath))
      return filePath;
    return false;
  }))).filter(Boolean);

  return executablersOrLibraries as string[];
}

async function missingFileDependencies(filePath: string): Promise<Array<string>> {
  const {stdout} = await lddAsync(filePath);
  const missingDeps = stdout.split('\n').map(line => line.trim()).filter(line => line.endsWith('not found') && line.includes('=>')).map(line => line.split('=>')[0].trim());
  return missingDeps;
}

function lddAsync(filePath: string): Promise<{stdout: string, stderr: string, code: number}> {
  const dirname = path.dirname(filePath);
  const ldd = spawn('ldd', [filePath], {
    cwd: dirname,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: dirname,
    },
  });

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    ldd.stdout.on('data', data => stdout += data);
    ldd.stderr.on('data', data => stderr += data);
    ldd.on('close', code => resolve({stdout, stderr, code}));
  });
}

// This list is generated with https://gist.github.com/aslushnikov/2766200430228c3700537292fccad064
const LIBRARY_TO_PACKAGE_NAME_UBUNTU_18_04: { [s: string]: string} = {
  'libEGL.so.1': 'libegl1',
  'libGL.so.1': 'libgl1',
  'libX11-xcb.so.1': 'libx11-xcb1',
  'libX11.so.6': 'libx11-6',
  'libXcomposite.so.1': 'libxcomposite1',
  'libXcursor.so.1': 'libxcursor1',
  'libXdamage.so.1': 'libxdamage1',
  'libXext.so.6': 'libxext6',
  'libXfixes.so.3': 'libxfixes3',
  'libXi.so.6': 'libxi6',
  'libXrandr.so.2': 'libxrandr2',
  'libXrender.so.1': 'libxrender1',
  'libXt.so.6': 'libxt6',
  'libXtst.so.6': 'libxtst6',
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
  'libenchant.so.1': 'libenchant1c2a',
  'libepoxy.so.0': 'libepoxy0',
  'libfontconfig.so.1': 'libfontconfig1',
  'libfreetype.so.6': 'libfreetype6',
  'libgbm.so.1': 'libgbm1',
  'libgdk-3.so.0': 'libgtk-3-0',
  'libgdk-x11-2.0.so.0': 'libgtk2.0-0',
  'libgdk_pixbuf-2.0.so.0': 'libgdk-pixbuf2.0-0',
  'libgio-2.0.so.0': 'libglib2.0-0',
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
  'libssl3.so': 'libnss3',
  'libwayland-client.so.0': 'libwayland-client0',
  'libwayland-egl.so.1': 'libwayland-egl1',
  'libwayland-server.so.0': 'libwayland-server0',
  'libwebp.so.6': 'libwebp6',
  'libwebpdemux.so.2': 'libwebpdemux2',
  'libwoff2dec.so.1.0.2': 'libwoff1',
  'libxcb-dri3.so.0': 'libxcb-dri3-0',
  'libxcb-shm.so.0': 'libxcb-shm0',
  'libxcb.so.1': 'libxcb1',
  'libxkbcommon.so.0': 'libxkbcommon0',
  'libxml2.so.2': 'libxml2',
  'libxslt.so.1': 'libxslt1.1',
};

