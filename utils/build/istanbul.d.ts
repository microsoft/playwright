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

declare module 'istanbul-lib-instrument' {
  export type InstrumenterOptions = {
    esModules?: boolean;
    produceSourceMap?: boolean;
    parserPlugins?: string[];
  };
  export type Instrumenter = {
    instrumentSync(code: string, filename: string): string;
    lastSourceMap(): any;
  };
  export function createInstrumenter(options?: InstrumenterOptions): Instrumenter;
}

declare module '@istanbuljs/schema' {
  export const defaults: {
    instrumenter: { parserPlugins: string[] };
  };
}
