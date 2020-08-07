type ServerResponse = import('http').ServerResponse;
type IncomingMessage = import('http').IncomingMessage;

type DescribeFunction = ((name: string, inner: () => void) => void) & {fail(condition: boolean): DescribeFunction};

type ItFunction<STATE> = ((name: string, inner: (state: STATE) => Promise<void>) => void) & {
    fail(condition: boolean): ItFunction<STATE>;
    skip(condition: boolean): ItFunction<STATE>;
    slow(): ItFunction<STATE>;
    repeat(n: number): ItFunction<STATE>;
};

interface WorkerState {
}

interface FixtureState {
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
declare const it: ItFunction<FixtureState & WorkerState>;
declare const fit: ItFunction<FixtureState & WorkerState>;
declare const dit: ItFunction<FixtureState & WorkerState>;
declare const xit: ItFunction<FixtureState & WorkerState>;

declare const beforeEach: (inner: (state: FixtureState & WorkerState) => Promise<void>) => void;
declare const afterEach: (inner: (state: FixtureState & WorkerState) => Promise<void>) => void;
declare const beforeAll: (inner: (state: WorkerState) => Promise<void>) => void;
declare const afterAll: (inner: (state: WorkerState) => Promise<void>) => void;

declare const registerFixture: <T extends keyof FixtureState>(name: T, inner: (state: FixtureState & WorkerState, test: (arg: FixtureState[T]) => Promise<void>) => Promise<void>) => void;
declare const registerWorkerFixture: <T extends keyof WorkerState>(name: T, inner: (state: WorkerState, test: (arg: WorkerState[T]) => Promise<void>) => Promise<void>) => void;

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
