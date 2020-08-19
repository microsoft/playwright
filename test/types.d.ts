/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

type ServerResponse = import('http').ServerResponse;
type IncomingMessage = import('http').IncomingMessage;

type DescribeFunction = ((name: string, inner: () => void) => void) & {
    fail(condition: boolean): DescribeFunction;
    skip(condition: boolean): DescribeFunction;
    slow(): DescribeFunction;
    repeat(n: number): DescribeFunction;
};

type ItFunction<STATE> = ((name: string, inner: (state: STATE) => Promise<void>) => void) & {
    fail(condition: boolean): ItFunction<STATE>;
    skip(condition: boolean): ItFunction<STATE>;
    slow(): ItFunction<STATE>;
    repeat(n: number): ItFunction<STATE>;
};

interface WorkerState {
    parallelIndex: number;
    tmpDir: string;
}

interface FixtureState {
}

interface Options {
}

declare module '' {
    module 'expect/build/types' {
        interface Matchers<R> {
            toMatchImage(path: string, options?: { threshold?: number  }): R;
        }
    }
}

declare const expect: typeof import('expect');

declare const options: Options;
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

declare const browserType: import('../index').BrowserType<import('../index').Browser>;

// global variables in assets
declare const testOptions: {
    HEADLESS: boolean;
    WIRE: boolean;
};

declare var MAC: boolean;
declare var LINUX: boolean;
declare var WIN: boolean;

// keyboard.html
declare function getResult(): string;
