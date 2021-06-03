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

import type { Browser, BrowserContext, BrowserContextOptions, Page, LaunchOptions, ViewportSize, Geolocation, HTTPCredentials } from './types';
import type { Project, Config } from 'folio';

/**
 * The name of the browser supported by Playwright.
 */
type BrowserName = 'chromium' | 'firefox' | 'webkit';

/**
 * Browser channel name. Used to run tests in different browser flavors,
 * for example Google Chrome Beta, or Microsoft Edge Stable.
 * @see BrowserContextOptions
 */
type BrowserChannel = Exclude<LaunchOptions['channel'], undefined>;

/**
 * Emulates `'prefers-colors-scheme'` media feature,
 * supported values are `'light'`, `'dark'`, `'no-preference'`.
 * @see BrowserContextOptions
 */
type ColorScheme = Exclude<BrowserContextOptions['colorScheme'], undefined>;

/**
 * An object containing additional HTTP headers to be sent with every request. All header values must be strings.
 * @see BrowserContextOptions
 */
type ExtraHTTPHeaders = Exclude<BrowserContextOptions['extraHTTPHeaders'], undefined>;

/**
 * Proxy settings available for all tests, or individually per test.
 * @see BrowserContextOptions
 */
type Proxy = Exclude<BrowserContextOptions['proxy'], undefined>;

/**
 * Storage state for the test.
 * @see BrowserContextOptions
 */
type StorageState = Exclude<BrowserContextOptions['storageState'], undefined>;

/**
 * Options available to configure browser launch.
 *   - Set options in config:
 *   ```js
 *     use: { browserName: 'webkit' }
 *   ```
 *   - Set options in test file:
 *   ```js
 *     test.use({ browserName: 'webkit' })
 *   ```
 *
 * Available as arguments to the test function and all hooks (beforeEach, afterEach, beforeAll, afterAll).
 */
export type PlaywrightWorkerOptions = {
  /**
   * Name of the browser (`chromium`, `firefox`, `webkit`) that runs tests.
   */
  browserName: BrowserName;

  /**
   * Whether to run browser in headless mode. Takes priority over `launchOptions`.
   * @see LaunchOptions
   */
  headless: boolean | undefined;

  /**
   * Browser distribution channel. Takes priority over `launchOptions`.
   * @see LaunchOptions
   */
  channel: BrowserChannel | undefined;

  /**
   * Options used to launch the browser. Other options above (e.g. `headless`) take priority.
   * @see LaunchOptions
   */
  launchOptions: LaunchOptions;
};

/**
 * Options available to configure each test.
 *   - Set options in config:
 *   ```js
 *     use: { video: 'on' }
 *   ```
 *   - Set options in test file:
 *   ```js
 *     test.use({ video: 'on' })
 *   ```
 *
 * Available as arguments to the test function and beforeEach/afterEach hooks.
 */
export type PlaywrightTestOptions = {
  /**
   * Whether to capture a screenshot after each test, off by default.
   * - `off`: Do not capture screenshots.
   * - `on`: Capture screenshot after each test.
   * - `only-on-failure`: Capture screenshot after each test failure.
   */
  screenshot: 'off' | 'on' | 'only-on-failure';

  /**
  * Whether to record video for each test, off by default.
  * - `off`: Do not record video.
  * - `on`: Record video for each test.
  * - `retain-on-failure`: Record video for each test, but remove all videos from successful test runs.
  * - `retry-with-video`: Record video only when retrying a test.
  */
  video: 'off' | 'on' | 'retain-on-failure' | 'retry-with-video';

  /**
   * Whether to automatically download all the attachments. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  acceptDownloads: boolean | undefined;

  /**
   * Toggles bypassing page's Content-Security-Policy. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  bypassCSP: boolean | undefined;

  /**
   * Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`.
   * @see BrowserContextOptions
   */
  colorScheme: ColorScheme | undefined;

  /**
   * Specify device scale factor (can be thought of as dpr). Defaults to `1`.
   * @see BrowserContextOptions
   */
  deviceScaleFactor: number | undefined;

  /**
   * An object containing additional HTTP headers to be sent with every request. All header values must be strings.
   * @see BrowserContextOptions
   */
  extraHTTPHeaders: ExtraHTTPHeaders | undefined;

  /**
   * Context geolocation. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  geolocation: Geolocation | undefined;

  /**
   * Specifies if viewport supports touch events. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  hasTouch: boolean | undefined;

  /**
   * Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
   * @see BrowserContextOptions
   */
  httpCredentials: HTTPCredentials | undefined;

  /**
   * Whether to ignore HTTPS errors during navigation. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  ignoreHTTPSErrors: boolean | undefined;

  /**
   * Whether the `meta viewport` tag is taken into account and touch events are enabled. Not supported in Firefox.
   * @see BrowserContextOptions
   */
  isMobile: boolean | undefined;

  /**
   * Whether or not to enable JavaScript in the context. Defaults to `true`.
   * @see BrowserContextOptions
   */
  javaScriptEnabled: boolean | undefined;

  /**
   * User locale, for example `en-GB`, `de-DE`, etc. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  locale: string | undefined;

  /**
   * Whether to emulate network being offline.
   * @see BrowserContextOptions
   */
  offline: boolean | undefined;

  /**
   * A list of permissions to grant to all pages in this context. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  permissions: string[] | undefined;

  /**
   * Proxy setting used for all pages in the test. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  proxy: Proxy | undefined;

  /**
   * Populates context with given storage state. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  storageState: StorageState | undefined;

  /**
   * Changes the timezone of the context. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  timezoneId: string | undefined;

  /**
   * Specific user agent to use in this context.
   * @see BrowserContextOptions
   */
  userAgent: string | undefined;

  /**
   * Viewport used for all pages in the test. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  viewport: ViewportSize | undefined;

  /**
   * Options used to create the context. Other options above (e.g. `viewport`) take priority.
   * @see BrowserContextOptions
   */
  contextOptions: BrowserContextOptions;
};


/**
 * Arguments available to the test function and all hooks (beforeEach, afterEach, beforeAll, afterAll).
 */
export type PlaywrightWorkerArgs = {
  /**
   * The Playwright instance.
   */
  playwright: typeof import('..');

  /**
   * Browser instance, shared between multiple tests.
   */
  browser: Browser;
};

/**
 * Arguments available to the test function and beforeEach/afterEach hooks.
 */
export type PlaywrightTestArgs = {
  /**
   * BrowserContext instance, created fresh for each test.
   */
  context: BrowserContext;

  /**
   * Page instance, created fresh for each test.
   */
  page: Page;
};

export type PlaywrightTestProject<TestArgs = {}, WorkerArgs = {}> = Project<PlaywrightTestOptions & TestArgs, PlaywrightWorkerOptions & WorkerArgs>;
export type PlaywrightTestConfig<TestArgs = {}, WorkerArgs = {}> = Config<PlaywrightTestOptions & TestArgs, PlaywrightWorkerOptions & WorkerArgs>;

export * from 'folio';

import type { TestType } from 'folio';

/**
 * These tests are executed in Playwright environment that launches the browser
 * and provides a fresh page to each test.
 */
export const test: TestType<PlaywrightTestArgs & PlaywrightTestOptions, PlaywrightWorkerArgs & PlaywrightWorkerOptions>;
export default test;
