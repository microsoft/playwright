type ServerResponse = import('http').ServerResponse;
type IncomingMessage = import('http').IncomingMessage;

type Falsy = false|''|0|null|undefined;

type DescribeFunction = ((name: string, inner: () => void) => void) & {fail(condition: boolean): DescribeFunction};

type ItFunction<STATE> = ((name: string, inner: (state: STATE) => Promise<void>) => void) & {
    fail(condition: boolean): ItFunction<STATE>;
    skip(condition: boolean): ItFunction<STATE>;
    slow(): ItFunction<STATE>;
    repeat(n: number): ItFunction<STATE>;
};

type TestRunner<STATE> = {
    describe: DescribeFunction;
    xdescribe: DescribeFunction;
    fdescribe: DescribeFunction;

    it: ItFunction<STATE>;
    xit: ItFunction<STATE>;
    fit: ItFunction<STATE>;
    dit: ItFunction<STATE>;

    beforeAll, beforeEach, afterAll, afterEach;
};

interface TestSetup<STATE> {
    testRunner: TestRunner<STATE>;
    product: 'Chromium'|'Firefox'|'WebKit';
    selectors: import('../index').Selectors;
    playwrightPath;
}

type TestState = {
    server: TestServer;
    httpsServer: TestServer;
    sourceServer: TestServer;
};

type BrowserState = TestState & {
    playwright: typeof import('../index');
    browserType: import('../index').BrowserType<import('../index').Browser>;
    browser: import('../index').Browser;
    browserServer: import('../index').BrowserServer;
    defaultBrowserOptions: import('../index').LaunchOptions;
};

type PageState = BrowserState & {
    context: import('../index').BrowserContext;
    page: import('../index').Page;
};
type ChromiumPageState = PageState & {
    browser: import('../index').ChromiumBrowser;
};


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

declare const describe: DescribeFunction;
declare const fdescribe: DescribeFunction;
declare const xdescribe: DescribeFunction;
declare const expect: typeof import('expect');
declare const it: ItFunction<PageState>;
declare const fit: ItFunction<PageState>;
declare const dit: ItFunction<PageState>;
declare const xit: ItFunction<PageState>;

declare const browserType: import('../index').BrowserType<import('../index').Browser>;

// global variables in assets
declare const testOptions: {
    FFOX: boolean;
    WEBKIT: boolean;
    CHROMIUM: boolean;
    MAC: boolean;
    LINUX: boolean;
    WIN: boolean;
    HEADLESS: boolean;
    OUTPUT_DIR: string;
    USES_HOOKS: boolean;
    CHANNEL: boolean;
    ASSETS_DIR: string;
};

// keyboard.html
declare function getResult(): string;
