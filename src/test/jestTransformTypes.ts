/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RawSourceMap } from 'source-map';
import type { Config, TransformTypes } from '@jest/types';

interface ShouldInstrumentOptions
  extends Pick<
  Config.GlobalConfig,
  | 'collectCoverage'
  | 'collectCoverageFrom'
  | 'collectCoverageOnlyFrom'
  | 'coverageProvider'
  > {
  changedFiles?: Set<string>;
  sourcesRelatedToTestsInChangedFiles?: Set<string>;
}

export interface Options
  extends ShouldInstrumentOptions,
  CallerTransformOptions {
  isInternalModule?: boolean;
}

// This is fixed in source-map@0.7.x, but we can't upgrade yet since it's async
interface FixedRawSourceMap extends Omit<RawSourceMap, 'version'> {
  version: number;
}

// TODO: For Jest 26 normalize this (always structured data, never a string)
export type TransformedSource =
  | { code: string; map?: FixedRawSourceMap | string | null }
  | string;

export type TransformResult = TransformTypes.TransformResult;

interface CallerTransformOptions {
  // names are copied from babel: https://babeljs.io/docs/en/options#caller
  supportsDynamicImport: boolean;
  supportsExportNamespaceFrom: boolean;
  supportsStaticESM: boolean;
  supportsTopLevelAwait: boolean;
}

export interface ReducedTransformOptions extends CallerTransformOptions {
}

export type StringMap = Map<string, string>;

export interface TransformOptions<OptionType = unknown>
  extends ReducedTransformOptions {
  /** a cached file system which is used in jest-runtime - useful to improve performance */
  cacheFS: StringMap;
  config: ProjectConfig;
  /** A stringified version of the configuration - useful in cache busting */
  configString: string;
  /** the options passed through Jest's config by the user */
  transformerConfig: OptionType;
}
export type ProjectConfig = {
  cacheDirectory: string;
  transform: [string, string, Record<string, unknown>][];
  cache: boolean;
  name: string;
  transformIgnorePatterns?: string[];
};

export interface Transformer<OptionType = unknown> {
  createTransformer?: (options?: OptionType) => Transformer<OptionType>;

  getCacheKey?: (
    sourceText: string,
    sourcePath: string,
    options: TransformOptions<OptionType>,
  ) => string;

  process: (
    sourceText: string,
    sourcePath: string,
    options: TransformOptions<OptionType>,
  ) => TransformedSource;
}
