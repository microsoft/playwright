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

type Options = {
  args?: string[],
  headless?: boolean,
  devtools?: boolean,
  proxy?: {
    server: string,
    bypass?: string,
    username?: string,
    password?: string
  },
  chromiumSandbox?: boolean,
  socksProxyPort?: number,
};

export function prepareChromiumArgs(options: Options): string[] {
  const { args = [], proxy } = options;
  const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
  if (userDataDirArg)
    throw new Error('Pass userDataDir parameter to `browserType.launchPersistentContext(userDataDir, ...)` instead of specifying --user-data-dir argument');
  if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
    throw new Error('Playwright manages remote debugging connection itself.');
  if (args.find(arg => !arg.startsWith('-')))
    throw new Error('Arguments can not specify page to be opened');
  const chromeArguments = [...DEFAULT_ARGS];
  if (options.devtools)
    chromeArguments.push('--auto-open-devtools-for-tabs');
  if (options.headless) {
    chromeArguments.push(
        '--headless',
        '--hide-scrollbars',
        '--mute-audio',
        '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
    );
  }
  if (options.chromiumSandbox !== true)
    chromeArguments.push('--no-sandbox');
  if (proxy) {
    const proxyURL = new URL(proxy.server);
    const isSocks = proxyURL.protocol === 'socks5:';
    // https://www.chromium.org/developers/design-documents/network-settings
    if (isSocks && !options.socksProxyPort) {
      // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
      chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
    }
    chromeArguments.push(`--proxy-server=${proxy.server}`);
    const proxyBypassRules = [];
    // https://source.chromium.org/chromium/chromium/src/+/master:net/docs/proxy.md;l=548;drc=71698e610121078e0d1a811054dcf9fd89b49578
    if (options.socksProxyPort)
      proxyBypassRules.push('<-loopback>');
    if (proxy.bypass)
      proxyBypassRules.push(...proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t));
    if (proxyBypassRules.length > 0)
      chromeArguments.push(`--proxy-bypass-list=${proxyBypassRules.join(';')}`);
  }
  chromeArguments.push(...args);
  return chromeArguments;
}

const DEFAULT_ARGS = [
  '--disable-background-networking',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter',
  '--allow-pre-commit-input',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--enable-automation',
  '--password-store=basic',
  '--use-mock-keychain',
  // See https://chromium-review.googlesource.com/c/chromium/src/+/2436773
  '--no-service-autorun',
];
