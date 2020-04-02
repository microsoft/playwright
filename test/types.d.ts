type ServerResponse = import('http').ServerResponse;
type IncomingMessage = import('http').IncomingMessage;

interface Expect<T> {
    toBe(other: T, message?: string): void;
    toBeFalsy(message?: string): void;
    toBeTruthy(message?: string): void;
    toContain(other: any, message?: string): void;
    toEqual(other: T, message?: string): void;
    toBeNull(message?: string): void;
    toBeInstanceOf(other: Function, message?: string): void;

    toBeGreaterThan(other: number, message?: string): void;
    toBeGreaterThanOrEqual(other: number, message?: string): void;
    toBeLessThan(other: number, message?: string): void;
    toBeLessThanOrEqual(other: number, message?: string): void;
    toBeCloseTo(other: number, precision: number, message?: string): void;

    toBeGolden(path: string): void;

    not: Expect<T>;
}

type DescribeFunction = ((name: string, inner: () => void) => void) & {
  skip(condition: boolean): DescribeFunction;
  fail(condition: boolean): DescribeFunction;
  repeat(count: number): DescribeFunction;
  slow(): DescribeFunction;
};

type ItFunction<STATE> = ((name: string, inner: (state: STATE) => Promise<void>) => void) & {
  skip(condition: boolean): ItFunction<STATE>;
  fail(condition: boolean): ItFunction<STATE>;
  repeat(count: number): ItFunction<STATE>;
  slow(): ItFunction<STATE>;
};

type ItFunctionDefault = ItFunction<PageState> & {
  pw: ItFunction<TestState>;
  browser: ItFunction<BrowserState>;
  context: ItFunction<ContextState>;
};

type TestRunner = {
    describe: DescribeFunction;
    xdescribe: DescribeFunction;
    fdescribe: DescribeFunction;

    it: ItFunctionDefault;
    xit: ItFunctionDefault;
    fit: ItFunctionDefault;
    dit: ItFunctionDefault;

    beforeAll, beforeEach, afterAll, afterEach;
};

interface TestSetup {
    testRunner: TestRunner;
    product: 'Chromium'|'Firefox'|'WebKit';
    FFOX: boolean;
    WEBKIT: boolean;
    CHROMIUM: boolean;
    MAC: boolean;
    LINUX: boolean;
    WIN: boolean;
    playwright: typeof import('../index');
    browserType: import('../index').BrowserType<import('../index').Browser>;
    selectors: import('../src/selectors').Selectors;
    expect<T>(value: T): Expect<T>;
    defaultBrowserOptions: import('../src/server/browserType').LaunchOptions;
    playwrightPath;
    headless: boolean;
    ASSETS_DIR: string;
}

type TestState = {
    server: TestServer;
    httpsServer: TestServer;
};
type BrowserState = TestState & {
    browser: import('../index').Browser;
    browserServer: import('../index').BrowserServer;
};
type ContextState = BrowserState & {
    context: import('../index').BrowserContext;
};
type PageState = ContextState & {
    page: import('../index').Page;
};
type TestSuite = (setup: TestSetup) => void;

interface TestServer {
    enableHTTPCache(pathPrefix: string);
    setAuth(path: string, username: string, password: string);
    enableGzip(path: string);
    setCSP(path: string, csp: string);
    stop(): Promise<void>;
    setRoute(path: string, handler: (message: IncomingMessage, response: ServerResponse) => void);
    setRedirect(from: string, to: string);
    waitForRequest(path: string): Promise<IncomingMessage>;
    reset();
    serveFile(request: IncomingMessage, response: ServerResponse, pathName: string);

    PORT: number;
    PREFIX: string;
    CROSS_PROCESS_PREFIX: string;
    EMPTY_PAGE: string;
}
