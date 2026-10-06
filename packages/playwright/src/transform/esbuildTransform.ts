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

import path from 'path';

import { libPath } from '../package';

import type * as esbuild from 'esbuild';
import type { JsxOptions } from './babelBundle';

export type Esbuild = typeof esbuild;

export function loadEsbuild(): Esbuild {
  try {
    return require('esbuild');
  } catch (error) {
    throw new Error(`PLAYWRIGHT_EXPERIMENTAL_ESBUILD requires the "esbuild" package, install it with "npm install --save-dev esbuild"`, { cause: error });
  }
}

export function esbuildTransform(esbuild: Esbuild, code: string, filename: string, isModule: boolean, jsx: JsxOptions | undefined): { code: string, map: any } {
  const options = transformOptions(filename, isModule, jsx);
  let result: esbuild.TransformResult;
  try {
    result = transformSync(esbuild, code, options);
  } catch (error) {
    throw toSyntaxError(error, code, filename);
  }
  return { code: result.code, map: JSON.parse(result.map) };
}

function transformOptions(filename: string, isModule: boolean, jsx: JsxOptions | undefined): esbuild.TransformOptions {
  const ext = path.extname(filename);
  const jsxMode = jsx?.jsx ?? 'react-jsx';
  return {
    sourcefile: filename,
    loader: ext === '.tsx' ? 'tsx' : ['.ts', '.mts', '.cts'].includes(ext) ? 'ts' : 'jsx',
    format: isModule ? 'esm' : 'cjs',
    platform: 'node',
    target: 'node' + process.versions.node.split('-')[0],
    sourcemap: 'both',
    jsx: jsxMode === 'react' ? 'transform' : 'automatic',
    jsxDev: jsxMode === 'react-jsxdev',
    jsxFactory: jsx?.jsxFactory,
    jsxFragment: jsx?.jsxFragmentFactory,
    jsxImportSource: jsx?.jsxImportSource,
    tsconfigRaw: {
      compilerOptions: {
        useDefineForClassFields: false,
        alwaysStrict: true,
      },
    },
    logLevel: 'silent',
  };
}

function transformSync(esbuild: Esbuild, code: string, options: esbuild.TransformOptions): esbuild.TransformResult {
  try {
    return esbuild.transformSync(code, options);
  } catch (error) {
    // Ctrl+C terminates esbuild's service process along with the whole process group.
    if (!(error instanceof Error) || !/^The service (is no longer running|was stopped)/.test(error.message))
      throw error;
    void esbuild.stop();
    return esbuild.transformSync(code, options);
  }
}

function toSyntaxError(error: any, code: string, filename: string): Error {
  const message: esbuild.Message | undefined = error?.errors?.[0];
  if (!message?.location)
    return error;
  const { line, column } = message.location;
  const { codeFrameColumns } = require(libPath('transform', 'babelBundle'));
  const codeFrame = codeFrameColumns(code, { start: { line, column: column + 1 } });
  const syntaxError = new SyntaxError(`${filename}: ${message.text} (${line}:${column})\n\n${codeFrame}`);
  (syntaxError as any).loc = { line, column };
  return syntaxError;
}
