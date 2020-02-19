type ServerResponse = import('http').ServerResponse;
type IncomingMessage = import('http').IncomingMessage;

type Falsy = false|""|0|null|undefined;
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

type DescribeFunction = ((name: string, inner: () => void) => void) & {skip(condition: boolean): DescribeFunction};

type ItFunction<STATE> = ((name: string, inner: (state: STATE) => Promise<void>) => void) & {skip(condition: boolean): ItFunction<STATE>; repeat(n: number): ItFunction<STATE>};

type TestRunner<STATE> = {
    describe: DescribeFunction;
    xdescribe: DescribeFunction;
    fdescribe: DescribeFunction;

    it: ItFunction<STATE>;
    xit: ItFunction<STATE>;
    fit: ItFunction<STATE>;
    dit: ItFunction<STATE>;

    beforeAll, beforeEach, afterAll, afterEach, loadTests;
};

interface TestSetup<STATE> {
    testRunner: TestRunner<STATE>;
    product: 'Chromium'|'Firefox'|'WebKit';
    FFOX: boolean;
    WEBKIT: boolean;
    CHROMIUM: boolean;
    MAC: boolean;
    LINUX: boolean;
    WIN: boolean;
    playwright: import('../src/server/browserType').BrowserType;
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
    sourceServer: TestServer;
};

type BrowserState = TestState & {
    browser: import('../src/browser').Browser;
    browserServer: import('../src/server/browserServer').BrowserServer;
};

type PageState = BrowserState & {
    context: import('../src/browserContext').BrowserContext;
    page: import('../src/page').Page;
};
type ChromiumPageState = PageState & {
    browser: import('../src/chromium/crBrowser').CRBrowser;
};
type TestSuite = (setup: TestSetup<TestState>) => void;
type BrowserTestSuite = (setup: TestSetup<BrowserState>) => void;
type PageTestSuite = (setup: TestSetup<PageState>) => void;
type ChromiumTestSuite = (setup: TestSetup<ChromiumPageState>) => void;


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
