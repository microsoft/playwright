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

declare module '' {
    module 'expect/build/types' {
        interface Matchers<R> {
            toMatchImage(path: string, options?: { threshold?: number  }): R;
        }
    }
}

declare const expect: typeof import('expect');
declare const browserType: import('../index').BrowserType<import('../index').Browser>;

declare var MAC: boolean;
declare var LINUX: boolean;
declare var WIN: boolean;

// keyboard.html
declare function getResult(): string;

declare const before: (f: () => Promise<any>) => void;
declare const after: (f: () => Promise<any>) => void;
declare const matrix: (m: any) => void;
