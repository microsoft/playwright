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

declare namespace Bun {
  interface OnLoadArgs {
    path: string;
    namespace: string;
    loader: string;
  }

  interface OnLoadResult {
    contents: string | ArrayBuffer | Uint8Array;
    loader?: 'js' | 'jsx' | 'ts' | 'tsx' | 'json' | 'toml' | 'text' | 'object';
  }

  interface OnResolveArgs {
    path: string;
    importer: string;
    namespace: string;
    kind: string;
  }

  interface OnResolveResult {
    path: string;
    namespace?: string;
    external?: boolean;
  }

  interface PluginBuilder {
    onLoad(
      constraints: { filter: RegExp; namespace?: string },
      callback: (args: OnLoadArgs) => OnLoadResult | undefined | Promise<OnLoadResult | undefined>,
    ): this;
    onResolve(
      constraints: { filter: RegExp; namespace?: string },
      callback: (args: OnResolveArgs) => OnResolveResult | undefined | Promise<OnResolveResult | undefined>,
    ): this;
  }

  interface CryptoHasher {
    update(input: string | ArrayBufferView | ArrayBuffer): CryptoHasher;
    digest(encoding: 'hex' | 'base64'): string;
  }
}

declare const Bun: {
  plugin(plugin: { name: string; setup(build: Bun.PluginBuilder): void | Promise<void> }): void;
  file(path: string): { text(): Promise<string>; bytes(): Promise<Uint8Array> };
  CryptoHasher: new (algorithm: 'sha1' | 'sha256' | 'sha512' | 'md5') => Bun.CryptoHasher;
};
