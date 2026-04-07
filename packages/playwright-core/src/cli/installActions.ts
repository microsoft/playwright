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

/* eslint-disable no-console */

import path from 'path';

import { wrapInASCIIBox } from '@utils/ascii';
import { isLikelyNpxGlobal } from '@utils/env';
import { assert } from '@isomorphic/assert';
import { registry, writeDockerVersion } from '../server/registry';

import type { BrowserInfo } from '../server/registry';

function printInstalledBrowsers(browsers: BrowserInfo[]) {
  const browserPaths = new Set<string>();
  for (const browser of browsers)
    browserPaths.add(browser.browserPath);
  console.log(`  Browsers:`);
  for (const browserPath of [...browserPaths].sort())
    console.log(`    ${browserPath}`);
  console.log(`  References:`);

  const references = new Set<string>();
  for (const browser of browsers)
    references.add(browser.referenceDir);
  for (const reference of [...references].sort())
    console.log(`    ${reference}`);
}

function printGroupedByPlaywrightVersion(browsers: BrowserInfo[]) {
  const dirToVersion = new Map<string, string>();
  for (const browser of browsers) {
    if (dirToVersion.has(browser.referenceDir))
      continue;
    const packageJSON = require(path.join(browser.referenceDir, 'package.json'));
    const version = packageJSON.version;
    dirToVersion.set(browser.referenceDir, version);
  }

  const groupedByPlaywrightMinorVersion = new Map<string, BrowserInfo[]>();
  for (const browser of browsers) {
    const version = dirToVersion.get(browser.referenceDir)!;
    let entries = groupedByPlaywrightMinorVersion.get(version);
    if (!entries) {
      entries = [];
      groupedByPlaywrightMinorVersion.set(version, entries);
    }
    entries.push(browser);
  }

  const sortedVersions = [...groupedByPlaywrightMinorVersion.keys()].sort((a, b) => {
    const aComponents = a.split('.');
    const bComponents = b.split('.');
    const aMajor = parseInt(aComponents[0], 10);
    const bMajor = parseInt(bComponents[0], 10);
    if (aMajor !== bMajor)
      return aMajor - bMajor;
    const aMinor = parseInt(aComponents[1], 10);
    const bMinor = parseInt(bComponents[1], 10);
    if (aMinor !== bMinor)
      return aMinor - bMinor;
    return aComponents.slice(2).join('.').localeCompare(bComponents.slice(2).join('.'));
  });

  for (const version of sortedVersions) {
    console.log(`\nPlaywright version: ${version}`);
    printInstalledBrowsers(groupedByPlaywrightMinorVersion.get(version)!);
  }
}

export async function markDockerImage(dockerImageNameTemplate: string) {
  assert(dockerImageNameTemplate, 'dockerImageNameTemplate is required');
  await writeDockerVersion(dockerImageNameTemplate);
}

export async function installBrowsers(args: string[], options: { withDeps?: boolean, force?: boolean, dryRun?: boolean, list?: boolean, shell?: boolean, noShell?: boolean, onlyShell?: boolean }) {
  if (isLikelyNpxGlobal()) {
    console.error(wrapInASCIIBox([
      `WARNING: It looks like you are running 'npx playwright install' without first`,
      `installing your project's dependencies.`,
      ``,
      `To avoid unexpected behavior, please install your dependencies first, and`,
      `then run Playwright's install command:`,
      ``,
      `    npm install`,
      `    npx playwright install`,
      ``,
      `If your project does not yet depend on Playwright, first install the`,
      `applicable npm package (most commonly @playwright/test), and`,
      `then run Playwright's install command to download the browsers:`,
      ``,
      `    npm install @playwright/test`,
      `    npx playwright install`,
      ``,
    ].join('\n'), 1));
  }
  if (options.shell === false && options.onlyShell)
    throw new Error(`Only one of --no-shell and --only-shell can be specified`);
  const shell = options.shell === false ? 'no' : options.onlyShell ? 'only' : undefined;
  const executables = registry.resolveBrowsers(args, { shell });
  if (options.withDeps)
    await registry.installDeps(executables, !!options.dryRun);
  if (options.dryRun && options.list)
    throw new Error(`Only one of --dry-run and --list can be specified`);
  if (options.dryRun) {
    for (const executable of executables) {
      console.log(registry.calculateDownloadTitle(executable));
      console.log(`  Install location:    ${executable.directory ?? '<system>'}`);
      if (executable.downloadURLs?.length) {
        const [url, ...fallbacks] = executable.downloadURLs;
        console.log(`  Download url:        ${url}`);
        for (let i = 0; i < fallbacks.length; ++i)
          console.log(`  Download fallback ${i + 1}: ${fallbacks[i]}`);
      }
      console.log(``);
    }
  } else if (options.list) {
    const browsers = await registry.listInstalledBrowsers();
    printGroupedByPlaywrightVersion(browsers);
  } else {
    await registry.install(executables, { force: options.force });
    await registry.validateHostRequirementsForExecutablesIfNeeded(executables, process.env.PW_LANG_NAME || 'javascript').catch((e: Error) => {
      e.name = 'Playwright Host validation warning';
      console.error(e);
    });
  }
}

export async function uninstallBrowsers(options: { all?: boolean }) {
  delete process.env.PLAYWRIGHT_SKIP_BROWSER_GC;
  await registry.uninstall(!!options.all).then(({ numberOfBrowsersLeft }) => {
    if (!options.all && numberOfBrowsersLeft > 0) {
      console.log('Successfully uninstalled Playwright browsers for the current Playwright installation.');
      console.log(`There are still ${numberOfBrowsersLeft} browsers left, used by other Playwright installations.\nTo uninstall Playwright browsers for all installations, re-run with --all flag.`);
    }
  });
}

export async function installDeps(args: string[], options: { dryRun?: boolean }) {
  await registry.installDeps(registry.resolveBrowsers(args, {}), !!options.dryRun);
}

export { registry };
