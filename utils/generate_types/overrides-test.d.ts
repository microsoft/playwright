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

export type ReporterDescription = Readonly<
  ['blob'] | ['blob', { outputDir?: string, fileName?: string }] |
  ['dot'] |
  ['line'] |
  ['list'] | ['list', { printSteps?: boolean }] |
  ['github'] |
  ['junit'] | ['junit', { outputFile?: string, stripANSIControlSequences?: boolean, includeProjectInTestName?: boolean }] |
  ['json'] | ['json', { outputFile?: string }] |
  ['html'] | ['html', { outputFolder?: string, open?: 'always' | 'never' | 'on-failure', host?: string, port?: number, attachmentsBaseURL?: string }] |
  ['null'] |
  [string] | [string, any]
>;

type UseOptions<TestArgs, WorkerArgs> = Partial<WorkerArgs> & Partial<TestArgs>;

interface TestProject<TestArgs = {}, WorkerArgs = {}> {
  use?: UseOptions<TestArgs, WorkerArgs>;
}

export interface Project<TestArgs = {}, WorkerArgs = {}> extends TestProject<TestArgs, WorkerArgs> {
}

export interface FullProject<TestArgs = {}, WorkerArgs = {}> {
  use: UseOptions<PlaywrightTestOptions & TestArgs, PlaywrightWorkerOptions & WorkerArgs>;
}

type LiteralUnion<T extends U, U = string> = T | (U & { zz_IGNORE_ME?: never });

interface TestConfig<TestArgs = {}, WorkerArgs = {}> {
  projects?: Project<TestArgs, WorkerArgs>[];
  reporter?: LiteralUnion<'list'|'dot'|'line'|'github'|'json'|'junit'|'null'|'html', string> | ReporterDescription[];
  use?: UseOptions<TestArgs, WorkerArgs>;
  webServer?: TestConfigWebServer | TestConfigWebServer[];
}

export interface Config<TestArgs = {}, WorkerArgs = {}> extends TestConfig<TestArgs, WorkerArgs> {
}

export type Metadata = { [key: string]: any };

export interface FullConfig<TestArgs = {}, WorkerArgs = {}> {
  projects: FullProject<TestArgs, WorkerArgs>[];
  reporter: ReporterDescription[];
  webServer: TestConfigWebServer | null;
}

export type TestStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

type TestDetailsAnnotation = {
  type: string;
  description?: string;
};

type TestDetailsTag = `@${string}`;

export type TestDetails = {
  tag?: TestDetailsTag | TestDetailsTag[];
  annotation?: TestDetailsAnnotation | TestDetailsAnnotation[];
}

interface SuiteFunction {
  (title: string, callback: () => void): void;
  (callback: () => void): void;
  (title: string, details: TestDetails, callback: () => void): void;
}

interface TestFunction<TestArgs> {
  (title: string, body: (args: TestArgs, testInfo: TestInfo) => Promise<void> | void): void;
  (title: string, details: TestDetails, body: (args: TestArgs, testInfo: TestInfo) => Promise<void> | void): void;
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
    configure: (options: { mode?: 'default' | 'parallel' | 'serial', retries?: number, timeout?: number }) => void;
  };
  skip(title: string, body: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<void> | void): void;
  skip(title: string, details: TestDetails, body: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<void> | void): void;
  skip(): void;
  skip(condition: boolean, description?: string): void;
  skip(callback: (args: TestArgs & WorkerArgs) => boolean, description?: string): void;
  fixme(title: string, body: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<void> | void): void;
  fixme(title: string, details: TestDetails, body: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<void> | void): void;
  fixme(): void;
  fixme(condition: boolean, description?: string): void;
  fixme(callback: (args: TestArgs & WorkerArgs) => boolean, description?: string): void;
  fail(title: string, body: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<void> | void): void;
  fail(title: string, details: TestDetails, body: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<void> | void): void;
  fail(condition: boolean, description?: string): void;
  fail(callback: (args: TestArgs & WorkerArgs) => boolean, description?: string): void;
  fail(): void;
  slow(): void;
  slow(condition: boolean, description?: string): void;
  slow(callback: (args: TestArgs & WorkerArgs) => boolean, description?: string): void;
  setTimeout(timeout: number): void;
  beforeEach(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  beforeEach(title: string, inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  afterEach(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  afterEach(title: string, inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  beforeAll(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  beforeAll(title: string, inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  afterAll(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  afterAll(title: string, inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;
  use(fixtures: Fixtures<{}, {}, TestArgs, WorkerArgs>): void;
  step<T>(title: string, body: () => T | Promise<T>, options?: { box?: boolean }): Promise<T>;
  expect: Expect<{}>;
  extend<T extends KeyValue, W extends KeyValue = {}>(fixtures: Fixtures<T, W, TestArgs, WorkerArgs>): TestType<TestArgs & T, WorkerArgs & W>;
  info(): TestInfo;
}

type KeyValue = { [key: string]: any };
export type TestFixture<R, Args extends KeyValue> = (args: Args, use: (r: R) => Promise<void>, testInfo: TestInfo) => any;
export type WorkerFixture<R, Args extends KeyValue> = (args: Args, use: (r: R) => Promise<void>, workerInfo: WorkerInfo) => any;
type TestFixtureValue<R, Args extends KeyValue> = Exclude<R, Function> | TestFixture<R, Args>;
type WorkerFixtureValue<R, Args extends KeyValue> = Exclude<R, Function> | WorkerFixture<R, Args>;
export type Fixtures<T extends KeyValue = {}, W extends KeyValue = {}, PT extends KeyValue = {}, PW extends KeyValue = {}> = {
  [K in keyof PW]?: WorkerFixtureValue<PW[K], W & PW> | [WorkerFixtureValue<PW[K], W & PW>, { scope: 'worker', timeout?: number | undefined, title?: string, box?: boolean }];
} & {
  [K in keyof PT]?: TestFixtureValue<PT[K], T & W & PT & PW> | [TestFixtureValue<PT[K], T & W & PT & PW>, { scope: 'test', timeout?: number | undefined, title?: string, box?: boolean }];
} & {
  [K in keyof W]?: [WorkerFixtureValue<W[K], W & PW>, { scope: 'worker', auto?: boolean, option?: boolean, timeout?: number | undefined, title?: string, box?: boolean }];
} & {
  [K in keyof T]?: TestFixtureValue<T[K], T & W & PT & PW> | [TestFixtureValue<T[K], T & W & PT & PW>, { scope?: 'test', auto?: boolean, option?: boolean, timeout?: number | undefined, title?: string, box?: boolean }];
};

type BrowserName = 'chromium' | 'firefox' | 'webkit';
type BrowserChannel = Exclude<LaunchOptions['channel'], undefined>;
type ColorScheme = Exclude<BrowserContextOptions['colorScheme'], undefined>;
type ClientCertificate = Exclude<BrowserContextOptions['clientCertificates'], undefined>[0];
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
   * This option exposes network available on the connecting client to the browser being connected to.
   * Consists of a list of rules separated by comma.
   *
   * Available rules:
   * - Hostname pattern, for example: `example.com`, `*.org:99`, `x.*.y.com`, `*foo.org`.
   * - IP literal, for example: `127.0.0.1`, `0.0.0.0:99`, `[::1]`, `[0:0::1]:99`.
   * - `<loopback>` that matches local loopback interfaces: `localhost`, `*.localhost`, `127.0.0.1`, `[::1]`.

   * Some common examples:
   * - `"*"` to expose all network.
   * - `"<loopback>"` to expose localhost network.
   * - `"*.test.internal-domain,*.staging.internal-domain,<loopback>"` to expose test/staging deployments and localhost.
   */
  exposeNetwork?: string;

  /**
   * Timeout in milliseconds for the connection to be established. Optional, defaults to no timeout.
   */
  timeout?: number;
};

export interface PlaywrightWorkerOptions {
  browserName: BrowserName;
  defaultBrowserType: BrowserName;
  headless: boolean;
  channel: BrowserChannel | undefined;
  launchOptions: Omit<LaunchOptions, 'tracesDir'>;
  connectOptions: ConnectOptions | undefined;
  screenshot: ScreenshotMode | { mode: ScreenshotMode } & Pick<PageScreenshotOptions, 'fullPage' | 'omitBackground'>;
  trace: TraceMode | /** deprecated */ 'retry-with-trace' | { mode: TraceMode, snapshots?: boolean, screenshots?: boolean, sources?: boolean, attachments?: boolean };
  video: VideoMode | /** deprecated */ 'retry-with-video' | { mode: VideoMode, size?: ViewportSize };
}

export type ScreenshotMode = 'off' | 'on' | 'only-on-failure';
export type TraceMode = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry' | 'on-all-retries' | 'retain-on-first-failure';
export type VideoMode = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';

export interface PlaywrightTestOptions {
  acceptDownloads: boolean;
  bypassCSP: boolean;
  colorScheme: ColorScheme;
  clientCertificates: ClientCertificate[] | undefined;
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

interface AsymmetricMatchers {
  any(sample: unknown): AsymmetricMatcher;
  anything(): AsymmetricMatcher;
  arrayContaining(sample: Array<unknown>): AsymmetricMatcher;
  closeTo(sample: number, precision?: number): AsymmetricMatcher;
  objectContaining(sample: Record<string, unknown>): AsymmetricMatcher;
  stringContaining(sample: string): AsymmetricMatcher;
  stringMatching(sample: string | RegExp): AsymmetricMatcher;
}

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
  toMatch(expected: RegExp | string): R;
  toMatchObject(expected: Record<string, unknown> | Array<unknown>): R;
  toStrictEqual(expected: unknown): R;
  toThrow(error?: unknown): R;
  toThrowError(error?: unknown): R;
}

type FunctionAssertions = {
  /**
   * Retries the callback until all assertions within it pass or the `timeout` value is reached.
   * The `intervals` parameter can be used to establish the probing frequency or pattern.
   *
   * **Usage**
   * ```js
   * await expect(async () => {
   *   const response = await page.request.get('https://api.example.com');
   *   expect(response.status()).toBe(200);
   * }).toPass({
   *   // Probe, wait 1s, probe, wait 2s, probe, wait 10s, probe, wait 10s, probe
   *   intervals: [1_000, 2_000, 10_000], // Defaults to [100, 250, 500, 1000].
   *   timeout: 60_000 // Defaults to 0
   * });
   * ```
   *
   * Note that by default `toPass` does not respect custom expect timeout.
   *
   * @param options
   */
  toPass(options?: { timeout?: number, intervals?: number[] }): Promise<void>;
};

type BaseMatchers<R, T> = GenericAssertions<R> & PlaywrightTest.Matchers<R, T> & SnapshotAssertions;
type AllowedGenericMatchers<R, T> = PlaywrightTest.Matchers<R, T> & Pick<GenericAssertions<R>, 'toBe' | 'toBeDefined' | 'toBeFalsy' | 'toBeNull' | 'toBeTruthy' | 'toBeUndefined'>;

type SpecificMatchers<R, T> =
  T extends Page ? PageAssertions & AllowedGenericMatchers<R, T> :
  T extends Locator ? LocatorAssertions & AllowedGenericMatchers<R, T> :
  T extends APIResponse ? APIResponseAssertions & AllowedGenericMatchers<R, T> :
  BaseMatchers<R, T> & (T extends Function ? FunctionAssertions : {});
type AllMatchers<R, T> = PageAssertions & LocatorAssertions & APIResponseAssertions & FunctionAssertions & BaseMatchers<R, T>;

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
type ToUserMatcher<F> = F extends (first: any, ...args: infer Rest) => infer R ? (...args: Rest) => (R extends PromiseLike<infer U> ? Promise<void> : void) : never;
type ToUserMatcherObject<T, ArgType> = {
  [K in keyof T as T[K] extends (arg: ArgType, ...rest: any[]) => any ? K : never]: ToUserMatcher<T[K]>;
};

type MatcherHintColor = (arg: string) => string;

export type MatcherHintOptions = {
  comment?: string;
  expectedColor?: MatcherHintColor;
  isDirectExpectCall?: boolean;
  isNot?: boolean;
  promise?: string;
  receivedColor?: MatcherHintColor;
  secondArgument?: string;
  secondArgumentColor?: MatcherHintColor;
};

export interface ExpectMatcherUtils {
  matcherHint(matcherName: string, received: unknown, expected: unknown, options?: MatcherHintOptions): string;
  printDiffOrStringify(expected: unknown, received: unknown, expectedLabel: string, receivedLabel: string, expand: boolean): string;
  printExpected(value: unknown): string;
  printReceived(object: unknown): string;
  printWithType<T>(name: string, value: T, print: (value: T) => string): string;
  diff(a: unknown, b: unknown): string | null;
  stringify(object: unknown, maxDepth?: number, maxWidth?: number): string;
}

export type ExpectMatcherState = {
  /**
   * Whether this matcher was called with the negated .not modifier.
   */
  isNot: boolean;
  /**
   * - 'rejects' if matcher was called with the promise .rejects modifier
   * - 'resolves' if matcher was called with the promise .resolves modifier
   * - '' if matcher was not called with a promise modifier
   */
  promise: 'rejects' | 'resolves' | '';
  utils: ExpectMatcherUtils;
  /**
   * Timeout in milliseconds for the assertion to be fulfilled.
   */
  timeout: number;
};

export type MatcherReturnType = {
  message: () => string;
  pass: boolean;
  name?: string;
  expected?: unknown;
  actual?: any;
  log?: string[];
};

type MakeMatchers<R, T, ExtendedMatchers> = {
  /**
   * If you know how to test something, `.not` lets you test its opposite.
   */
  not: MakeMatchers<R, T, ExtendedMatchers>;
  /**
   * Use resolves to unwrap the value of a fulfilled promise so any other
   * matcher can be chained. If the promise is rejected the assertion fails.
   */
  resolves: MakeMatchers<Promise<R>, Awaited<T>, ExtendedMatchers>;
  /**
   * Unwraps the reason of a rejected promise so any other matcher can be chained.
   * If the promise is fulfilled the assertion fails.
   */
  rejects: MakeMatchers<Promise<R>, any, ExtendedMatchers>;
} & IfAny<T, AllMatchers<R, T>, SpecificMatchers<R, T> & ToUserMatcherObject<ExtendedMatchers, T>>;

export type Expect<ExtendedMatchers = {}> = {
  <T = unknown>(actual: T, messageOrOptions?: string | { message?: string }): MakeMatchers<void, T, ExtendedMatchers>;
  soft: <T = unknown>(actual: T, messageOrOptions?: string | { message?: string }) => MakeMatchers<void, T, ExtendedMatchers>;
  poll: <T = unknown>(actual: () => T | Promise<T>, messageOrOptions?: string | { message?: string, timeout?: number, intervals?: number[] }) => BaseMatchers<Promise<void>, T> & {
    /**
     * If you know how to test something, `.not` lets you test its opposite.
     */
     not: BaseMatchers<Promise<void>, T>;
  };
  extend<MoreMatchers extends Record<string, (this: ExpectMatcherState, receiver: any, ...args: any[]) => MatcherReturnType | Promise<MatcherReturnType>>>(matchers: MoreMatchers): Expect<ExtendedMatchers & MoreMatchers>;
  configure: (configuration: {
    message?: string,
    timeout?: number,
    soft?: boolean,
  }) => Expect<ExtendedMatchers>;
  getState(): unknown;
  not: Omit<AsymmetricMatchers, 'any' | 'anything'>;
} & AsymmetricMatchers;

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
export const expect: Expect<{}>;

/**
 * Defines Playwright config
 */
export function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig;
export function defineConfig<T>(config: PlaywrightTestConfig<T>): PlaywrightTestConfig<T>;
export function defineConfig<T, W>(config: PlaywrightTestConfig<T, W>): PlaywrightTestConfig<T, W>;
export function defineConfig(config: PlaywrightTestConfig, ...configs: PlaywrightTestConfig[]): PlaywrightTestConfig;
export function defineConfig<T>(config: PlaywrightTestConfig<T>, ...configs: PlaywrightTestConfig[]): PlaywrightTestConfig<T>;
export function defineConfig<T, W>(config: PlaywrightTestConfig<T, W>, ...configs: PlaywrightTestConfig[]): PlaywrightTestConfig<T, W>;

type MergedT<List> = List extends [TestType<infer T, any>, ...(infer Rest)] ? T & MergedT<Rest> : {};
type MergedW<List> = List extends [TestType<any, infer W>, ...(infer Rest)] ? W & MergedW<Rest> : {};
type MergedTestType<List> = TestType<MergedT<List>, MergedW<List>>;

/**
 * Merges fixtures
 */
export function mergeTests<List extends any[]>(...tests: List): MergedTestType<List>;

type MergedExpectMatchers<List> = List extends [Expect<infer M>, ...(infer Rest)] ? M & MergedExpectMatchers<Rest> : {};
type MergedExpect<List> = Expect<MergedExpectMatchers<List>>;

/**
 * Merges expects
 */
export function mergeExpects<List extends any[]>(...expects: List): MergedExpect<List>;

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export { };

