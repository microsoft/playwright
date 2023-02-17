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

import type { APIRequestContext, Browser, BrowserContext, BrowserContextOptions, Page, LaunchOptions, ViewportSize, Geolocation, HTTPCredentials, Locator, APIResponse, PageScreenshotOptions } from 'playwright-core';
export * from 'playwright-core';

export type ReporterDescription =
  ['dot'] |
  ['line'] |
  ['list'] |
  ['github'] |
  ['junit'] | ['junit', { outputFile?: string, stripANSIControlSequences?: boolean }] |
  ['json'] | ['json', { outputFile?: string }] |
  ['html'] | ['html', { outputFolder?: string, open?: 'always' | 'never' | 'on-failure' }] |
  ['null'] |
  [string] | [string, any];

type UseOptions<TestArgs, WorkerArgs> = { [K in keyof WorkerArgs]?: WorkerArgs[K] } & { [K in keyof TestArgs]?: TestArgs[K] };

export interface Project<TestArgs = {}, WorkerArgs = {}> extends TestProject {
  use?: UseOptions<TestArgs, WorkerArgs>;
}

// [internal] !!! DO NOT ADD TO THIS !!!
// [internal] It is part of the public API and is computed from the user's config.
// [internal] If you need new fields internally, add them to FullConfigInternal instead.
export interface FullProject<TestArgs = {}, WorkerArgs = {}> {
  grep: RegExp | RegExp[];
  grepInvert: RegExp | RegExp[] | null;
  metadata: Metadata;
  name: string;
  dependencies: string[];
  snapshotDir: string;
  outputDir: string;
  repeatEach: number;
  retries: number;
  testDir: string;
  testIgnore: string | RegExp | (string | RegExp)[];
  testMatch: string | RegExp | (string | RegExp)[];
  timeout: number;
  use: UseOptions<PlaywrightTestOptions & TestArgs, PlaywrightWorkerOptions & WorkerArgs>;
}
// [internal] !!! DO NOT ADD TO THIS !!! See prior note.

type LiteralUnion<T extends U, U = string> = T | (U & { zz_IGNORE_ME?: never });

interface TestConfig {
  reporter?: LiteralUnion<'list'|'dot'|'line'|'github'|'json'|'junit'|'null'|'html', string> | ReporterDescription[];
  webServer?: TestConfigWebServer | TestConfigWebServer[];
}

export interface Config<TestArgs = {}, WorkerArgs = {}> extends TestConfig {
  projects?: Project<TestArgs, WorkerArgs>[];
  use?: UseOptions<TestArgs, WorkerArgs>;
}

export type Metadata = { [key: string]: any };

// [internal] !!! DO NOT ADD TO THIS !!!
// [internal] It is part of the public API and is computed from the user's config.
// [internal] If you need new fields internally, add them to FullConfigInternal instead.
export interface FullConfig<TestArgs = {}, WorkerArgs = {}> {
  forbidOnly: boolean;
  fullyParallel: boolean;
  globalSetup: string | null;
  globalTeardown: string | null;
  globalTimeout: number;
  grep: RegExp | RegExp[];
  grepInvert: RegExp | RegExp[] | null;
  maxFailures: number;
  metadata: Metadata;
  version: string;
  preserveOutput: 'always' | 'never' | 'failures-only';
  projects: FullProject<TestArgs, WorkerArgs>[];
  reporter: ReporterDescription[];
  reportSlowTests: { max: number, threshold: number } | null;
  rootDir: string;
  quiet: boolean;
  shard: { total: number, current: number } | null;
  updateSnapshots: 'all' | 'none' | 'missing';
  workers: number;
  webServer: TestConfigWebServer | null;
  configFile?: string;
  // [internal] !!! DO NOT ADD TO THIS !!! See prior note.
}

export type TestStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

export interface WorkerInfo {
  config: FullConfig;
  project: FullProject;
}

export interface TestInfo {
  config: FullConfig;
  project: FullProject;
}

interface SuiteFunction {
  (title: string, callback: () => void): void;
  (callback: () => void): void;
}

interface TestFunction<TestArgs> {
  (title: string, testFunction: (args: TestArgs, testInfo: TestInfo) => Promise<void> | void): void;
}

export interface TestType<TestArgs extends KeyValue, WorkerArgs extends KeyValue> extends TestFunction<TestArgs & WorkerArgs> {
  only: TestFunction<TestArgs & WorkerArgs>;
  describe: SuiteFunction & {
    only: SuiteFunction;
    skip: SuiteFunction;
    fixme: SuiteFunction;
    serial: SuiteFunction & {
      only: SuiteFunction;
    };
    parallel: SuiteFunction & {
      only: SuiteFunction;
    };
    configure: (options: { mode?: 'parallel' | 'serial', retries?: number, timeout?: number }) => void;
  };
  skip(title: string, testFunction: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<void> | void): void;
  skip(): void;
  skip(condition: boolean, description?: string): void;
  skip(callback: (args: TestArgs & WorkerArgs) => boolean, description?: string): void;
  fixme(title: string, testFunction: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<void> | void): void;
  fixme(): void;
  fixme(condition: boolean, description?: string): void;
  fixme(callback: (args: TestArgs & WorkerArgs) => boolean, description?: string): void;
  fail(): void;
  fail(condition: boolean, description?: string): void;
  fail(callback: (args: TestArgs & WorkerArgs) => boolean, description?: string): void;
  slow(): void;
  slow(condition: boolean, description?: string): void;
  slow(callback: (args: TestArgs & WorkerArgs) => boolean, description?: string): void;
  setTimeout(timeout: number): void;
  beforeEach(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  afterEach(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  beforeAll(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  afterAll(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  use(fixtures: Fixtures<{}, {}, TestArgs, WorkerArgs>): void;
  step<T>(title: string, body: () => T | Promise<T>): Promise<T>;
  expect: Expect;
  extend<T extends KeyValue, W extends KeyValue = {}>(fixtures: Fixtures<T, W, TestArgs, WorkerArgs>): TestType<TestArgs & T, WorkerArgs & W>;
  info(): TestInfo;
}

type KeyValue = { [key: string]: any };
export type TestFixture<R, Args extends KeyValue> = (args: Args, use: (r: R) => Promise<void>, testInfo: TestInfo) => any;
export type WorkerFixture<R, Args extends KeyValue> = (args: Args, use: (r: R) => Promise<void>, workerInfo: WorkerInfo) => any;
type TestFixtureValue<R, Args extends KeyValue> = Exclude<R, Function> | TestFixture<R, Args>;
type WorkerFixtureValue<R, Args extends KeyValue> = Exclude<R, Function> | WorkerFixture<R, Args>;
export type Fixtures<T extends KeyValue = {}, W extends KeyValue = {}, PT extends KeyValue = {}, PW extends KeyValue = {}> = {
  [K in keyof PW]?: WorkerFixtureValue<PW[K], W & PW> | [WorkerFixtureValue<PW[K], W & PW>, { scope: 'worker', timeout?: number | undefined }];
} & {
  [K in keyof PT]?: TestFixtureValue<PT[K], T & W & PT & PW> | [TestFixtureValue<PT[K], T & W & PT & PW>, { scope: 'test', timeout?: number | undefined }];
} & {
  [K in keyof W]?: [WorkerFixtureValue<W[K], W & PW>, { scope: 'worker', auto?: boolean, option?: boolean, timeout?: number | undefined }];
} & {
  [K in keyof T]?: TestFixtureValue<T[K], T & W & PT & PW> | [TestFixtureValue<T[K], T & W & PT & PW>, { scope?: 'test', auto?: boolean, option?: boolean, timeout?: number | undefined }];
};

type BrowserName = 'chromium' | 'firefox' | 'webkit';
type BrowserChannel = Exclude<LaunchOptions['channel'], undefined>;
type ColorScheme = Exclude<BrowserContextOptions['colorScheme'], undefined>;
type ExtraHTTPHeaders = Exclude<BrowserContextOptions['extraHTTPHeaders'], undefined>;
type Proxy = Exclude<BrowserContextOptions['proxy'], undefined>;
type StorageState = Exclude<BrowserContextOptions['storageState'], undefined>;
type ServiceWorkerPolicy = Exclude<BrowserContextOptions['serviceWorkers'], undefined>;
type ConnectOptions = {
  /**
   * A browser websocket endpoint to connect to.
   */
  wsEndpoint: string;

  /**
   * Additional HTTP headers to be sent with web socket connect request.
   */
  headers?: { [key: string]: string; };

  /**
   * Timeout in milliseconds for the connection to be established. Optional, defaults to no timeout.
   */
  timeout?: number;
};

export interface TestStore {
  get<T>(path: string): Promise<T | undefined>;
  set<T>(path: string, value: T | undefined): Promise<void>;
}

export interface PlaywrightWorkerOptions {
  browserName: BrowserName;
  defaultBrowserType: BrowserName;
  headless: boolean;
  channel: BrowserChannel | undefined;
  launchOptions: LaunchOptions;
  connectOptions: ConnectOptions | undefined;
  screenshot: ScreenshotMode | { mode: ScreenshotMode } & Pick<PageScreenshotOptions, 'fullPage' | 'omitBackground'>;
  trace: TraceMode | /** deprecated */ 'retry-with-trace' | { mode: TraceMode, snapshots?: boolean, screenshots?: boolean, sources?: boolean };
  video: VideoMode | /** deprecated */ 'retry-with-video' | { mode: VideoMode, size?: ViewportSize };
}

export type ScreenshotMode = 'off' | 'on' | 'only-on-failure';
export type TraceMode = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
export type VideoMode = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';

export interface PlaywrightTestOptions {
  acceptDownloads: boolean;
  bypassCSP: boolean;
  colorScheme: ColorScheme;
  deviceScaleFactor: number | undefined;
  extraHTTPHeaders: ExtraHTTPHeaders | undefined;
  geolocation: Geolocation | undefined;
  hasTouch: boolean;
  httpCredentials: HTTPCredentials | undefined;
  ignoreHTTPSErrors: boolean;
  isMobile: boolean;
  javaScriptEnabled: boolean;
  locale: string | undefined;
  offline: boolean;
  permissions: string[] | undefined;
  proxy: Proxy | undefined;
  storageState: StorageState | undefined;
  timezoneId: string | undefined;
  userAgent: string | undefined;
  viewport: ViewportSize | null;
  baseURL: string | undefined;
  contextOptions: BrowserContextOptions;
  actionTimeout: number;
  navigationTimeout: number;
  serviceWorkers: ServiceWorkerPolicy;
  testIdAttribute: string;
}


export interface PlaywrightWorkerArgs {
  playwright: typeof import('playwright-core');
  browser: Browser;
}

export interface PlaywrightTestArgs {
  context: BrowserContext;
  page: Page;
  request: APIRequestContext;
}

type ExcludeProps<A, B> = {
  [K in Exclude<keyof A, keyof B>]: A[K];
};
type CustomProperties<T> = ExcludeProps<T, PlaywrightTestOptions & PlaywrightWorkerOptions & PlaywrightTestArgs & PlaywrightWorkerArgs>;

export type PlaywrightTestProject<TestArgs = {}, WorkerArgs = {}> = Project<PlaywrightTestOptions & CustomProperties<TestArgs>, PlaywrightWorkerOptions & CustomProperties<WorkerArgs>>;
export type PlaywrightTestConfig<TestArgs = {}, WorkerArgs = {}> = Config<PlaywrightTestOptions & CustomProperties<TestArgs>, PlaywrightWorkerOptions & CustomProperties<WorkerArgs>>;

type AsymmetricMatcher = Record<string, any>;

type AsymmetricMatchers = {
  any(sample: unknown): AsymmetricMatcher;
  anything(): AsymmetricMatcher;
  arrayContaining(sample: Array<unknown>): AsymmetricMatcher;
  closeTo(sample: number, precision?: number): AsymmetricMatcher;
  objectContaining(sample: Record<string, unknown>): AsymmetricMatcher;
  stringContaining(sample: string): AsymmetricMatcher;
  stringMatching(sample: string | RegExp): AsymmetricMatcher;
}

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
type ExtraMatchers<T, Type, Matchers> = T extends Type ? Matchers : IfAny<T, Matchers, {}>;

interface GenericAssertions<R> {
  not: GenericAssertions<R>;
  toBe(expected: unknown): R;
  toBeCloseTo(expected: number, numDigits?: number): R;
  toBeDefined(): R;
  toBeFalsy(): R;
  toBeGreaterThan(expected: number | bigint): R;
  toBeGreaterThanOrEqual(expected: number | bigint): R;
  toBeInstanceOf(expected: Function): R;
  toBeLessThan(expected: number | bigint): R;
  toBeLessThanOrEqual(expected: number | bigint): R;
  toBeNaN(): R;
  toBeNull(): R;
  toBeTruthy(): R;
  toBeUndefined(): R;
  toContain(expected: string): R;
  toContain(expected: unknown): R;
  toContainEqual(expected: unknown): R;
  toEqual(expected: unknown): R;
  toHaveLength(expected: number): R;
  toHaveProperty(keyPath: string | Array<string>, value?: unknown): R;
  toMatch(expected: RegExp): R;
  toMatchObject(expected: Record<string, unknown> | Array<unknown>): R;
  toStrictEqual(expected: unknown): R;
  toThrow(error?: unknown): R;
  toThrowError(error?: unknown): R;
}

type BaseMatchers<R, T> = GenericAssertions<R> & PlaywrightTest.Matchers<R, T>;

type MakeMatchers<R, T> = BaseMatchers<R, T> & {
    /**
     * If you know how to test something, `.not` lets you test its opposite.
     */
    not: MakeMatchers<R, T>;
    /**
     * Use resolves to unwrap the value of a fulfilled promise so any other
     * matcher can be chained. If the promise is rejected the assertion fails.
     */
    resolves: MakeMatchers<Promise<R>, Awaited<T>>;
    /**
     * Unwraps the reason of a rejected promise so any other matcher can be chained.
     * If the promise is fulfilled the assertion fails.
     */
    rejects: MakeMatchers<Promise<R>, Awaited<T>>;
  } & SnapshotAssertions &
  ExtraMatchers<T, Page, PageAssertions> &
  ExtraMatchers<T, Locator, LocatorAssertions> &
  ExtraMatchers<T, APIResponse, APIResponseAssertions> &
  ExtraMatchers<T, Function, {
    /**
     * Retries the callback until it passes.
     */
    toPass(options?: { timeout?: number, intervals?: number[] }): Promise<void>;
  }>;

export type Expect = {
  <T = unknown>(actual: T, messageOrOptions?: string | { message?: string }): MakeMatchers<void, T>;
  soft: <T = unknown>(actual: T, messageOrOptions?: string | { message?: string }) => MakeMatchers<void, T>;
  poll: <T = unknown>(actual: () => T | Promise<T>, messageOrOptions?: string | { message?: string, timeout?: number, intervals?: number[] }) => BaseMatchers<Promise<void>, T> & {
    /**
     * If you know how to test something, `.not` lets you test its opposite.
     */
     not: BaseMatchers<Promise<void>, T>;
  };
  extend(matchers: any): void;
  getState(): {
    expand?: boolean;
    isNot: boolean;
    promise: string;
    utils: any;
  };
  not: Omit<AsymmetricMatchers, 'any' | 'anything'>;
} & AsymmetricMatchers;

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

// --- BEGINGLOBAL ---
declare global {
  export namespace PlaywrightTest {
    export interface Matchers<R, T = unknown> {
    }
  }
}
// --- ENDGLOBAL ---

/**
 * These tests are executed in Playwright environment that launches the browser
 * and provides a fresh page to each test.
 */
export const test: TestType<PlaywrightTestArgs & PlaywrightTestOptions, PlaywrightWorkerArgs & PlaywrightWorkerOptions>;
export default test;

export const _baseTest: TestType<{}, {}>;
export const expect: Expect;
export const store: TestStore;

/**
 * Defines Playwright config
 */
export function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig;
export function defineConfig<T>(config: PlaywrightTestConfig<T>): PlaywrightTestConfig<T>;
export function defineConfig<T, W>(config: PlaywrightTestConfig<T, W>): PlaywrightTestConfig<T, W>;

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};
