type ServerResponse = import('http').ServerResponse;
type IncomingMessage = import('http').IncomingMessage;

type DescribeFunction = ((name: string, inner: () => void) => void) & {fail(condition: boolean): DescribeFunction};

type ItFunction<STATE> = ((name: string, inner: (state: STATE) => Promise<void>) => void) & {
    fail(condition: boolean): ItFunction<STATE>;
    skip(condition: boolean): ItFunction<STATE>;
    slow(): ItFunction<STATE>;
    repeat(n: number): ItFunction<STATE>;
};

interface FixtureState {
    parallelIndex: number;
    http_server: {server: TestServer, httpsServer: TestServer};
    defaultBrowserOptions: import('../index').LaunchOptions;
    playwright: typeof import('../index');
    browserType: import('../index').BrowserType<import('../index').Browser>;
    browser: import('../index').Browser;
    toImpl: (rpcObject: any) => any;
    context: import('../index').BrowserContext;
    server: TestServer;
    page: import('../index').Page;
    httpsServer: TestServer;
    browserServer: import('../index').BrowserServer;
}

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
declare module '' {
    module 'expect/build/types' {
        interface Matchers<R> {
            toBeGolden(name: string): R;
        }
    }
}


declare const expect: typeof import('expect');


declare const describe: DescribeFunction;
declare const fdescribe: DescribeFunction;
declare const xdescribe: DescribeFunction;
declare const it: ItFunction<FixtureState>;
declare const fit: ItFunction<FixtureState>;
declare const dit: ItFunction<FixtureState>;
declare const xit: ItFunction<FixtureState>;

declare const beforeEach: (inner: (state: FixtureState) => Promise<void>) => void;
declare const afterEach: (inner: (state: FixtureState) => Promise<void>) => void;
declare const beforeAll: (inner: (state: FixtureState) => Promise<void>) => void;
declare const afterAll: (inner: (state: FixtureState) => Promise<void>) => void;

declare const registerFixture: <T extends keyof FixtureState>(name: T, inner: (state: FixtureState, test: (arg: FixtureState[T]) => Promise<void>) => Promise<void>) => void;
  
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
