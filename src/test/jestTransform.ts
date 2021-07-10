/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// This code was adapted from ScriptTransformer.ts in Jest

import {createHash} from 'crypto';
import * as path from 'path';
import {fromSource as sourcemapFromSource} from 'convert-source-map';
import fs from 'fs';
import type {
  ProjectConfig,
  Options,
  ReducedTransformOptions,
  StringMap,
  TransformOptions,
  TransformResult,
  TransformedSource,
  Transformer,
} from './jestTransformTypes';

async function requireOrImportModule(filePath: string) {
  // TODO make this real?
  return require(filePath);
}

// Use `require` to avoid TS rootDir
const {version: VERSION} = require('../../package.json');

 type ProjectCache = {
   configString: string;
   ignorePatternsRegExp?: RegExp;
   transformRegExp?: Array<[RegExp, string, Record<string, unknown>]>;
   transformedFiles: Map<string, TransformResult>;
 };

// This data structure is used to avoid recalculating some data every time that
// we need to transform a file. Since ScriptTransformer is instantiated for each
// file we need to keep this object in the local scope of this module.
const projectCaches = new Map<string, ProjectCache>();

// To reset the cache for specific changesets (rather than package version).
const CACHE_VERSION = '1';

class ScriptTransformer {
   private readonly _cache: ProjectCache;
   private readonly _transformCache = new Map<
     string,
     {transformer: Transformer; transformerConfig: unknown}
   >();
   private _transformsAreLoaded = false;

   constructor(
     private readonly _config: ProjectConfig,
     private readonly _cacheFS: StringMap,
   ) {
     const configString = JSON.stringify(this._config);
     let projectCache = projectCaches.get(configString);

     if (!projectCache) {
       projectCache = {
         configString,
         ignorePatternsRegExp: calcIgnorePatternRegExp(this._config),
         transformRegExp: calcTransformRegExp(this._config),
         transformedFiles: new Map(),
       };

       projectCaches.set(configString, projectCache);
     }

     this._cache = projectCache;
   }

   private _buildCacheKeyFromFileInfo(
     fileData: string,
     filename: string,
     transformOptions: TransformOptions,
     transformerCacheKey: string | undefined,
   ): string {
     if (transformerCacheKey) {
       return createHash('md5')
           .update(transformerCacheKey)
           .update(CACHE_VERSION)
           .digest('hex');
     }

     return createHash('md5')
         .update(fileData)
         .update(transformOptions.configString)
         .update(filename)
         .update(CACHE_VERSION)
         .digest('hex');
   }

   private _getCacheKey(
     fileData: string,
     filename: string,
     options: ReducedTransformOptions,
   ): string {
     const configString = this._cache.configString;
     const {transformer, transformerConfig = {}} =
       this._getTransformer(filename) || {};
     let transformerCacheKey = undefined;

     const transformOptions: TransformOptions = {
       ...options,
       cacheFS: this._cacheFS,
       config: this._config,
       configString,
       transformerConfig,
     };

     if (typeof transformer?.getCacheKey === 'function') {
       transformerCacheKey = transformer.getCacheKey(
           fileData,
           filename,
           transformOptions,
       );
     }

     return this._buildCacheKeyFromFileInfo(
         fileData,
         filename,
         transformOptions,
         transformerCacheKey,
     );
   }

   private _createFolderFromCacheKey(
     filename: string,
     cacheKey: string,
   ): string {
     const baseCacheDir = path.join(this._config.cacheDirectory, 'playwright-transform-cache-' + this._config.name, VERSION);
     // Create sub folders based on the cacheKey to avoid creating one
     // directory with many files.
     const cacheDir = path.join(baseCacheDir, cacheKey[0] + cacheKey[1]);
     const cacheFilenamePrefix = path
         .basename(filename, path.extname(filename))
         .replace(/\W/g, '');
     const cachePath = path.join(cacheDir, cacheFilenamePrefix + '_' + cacheKey);
     fs.mkdirSync(cacheDir, {recursive: true});

     return cachePath;
   }

   private _getFileCachePath(
     filename: string,
     content: string,
     options: ReducedTransformOptions,
   ): string {
     const cacheKey = this._getCacheKey(content, filename, options);

     return this._createFolderFromCacheKey(filename, cacheKey);
   }

   private _getTransformPath(filename: string) {
     const transformRegExp = this._cache.transformRegExp;
     if (!transformRegExp)
       return undefined;


     for (let i = 0; i < transformRegExp.length; i++) {
       if (transformRegExp[i][0].test(filename))
         return transformRegExp[i][1];

     }

     return undefined;
   }

   async loadTransformers(): Promise<void> {
     await Promise.all(
         this._config.transform.map(
             async ([, transformPath, transformerConfig]) => {
               let transformer: Transformer = await requireOrImportModule(
                   transformPath,
               );

               if (!transformer)
                 throw new TypeError('Jest: a transform must export something.');

               if (typeof transformer.createTransformer === 'function')
                 transformer = transformer.createTransformer(transformerConfig);

               if (
                 typeof transformer.process !== 'function'
               ) {
                 throw new TypeError(
                     'Jest: a transform must export a `process` function.',
                 );
               }
               const res = {transformer, transformerConfig};
               this._transformCache.set(transformPath, res);
             },
         ),
     );

     this._transformsAreLoaded = true;
   }

   private _getTransformer(filename: string) {
     if (!this._transformsAreLoaded) {
       throw new Error(
           'Jest: Transformers have not been loaded yet - make sure to run `loadTransformers` and wait for it to complete before starting to transform files',
       );
     }

     if (this._config.transform.length === 0)
       return null;


     const transformPath = this._getTransformPath(filename);

     if (!transformPath)
       return null;


     const cached = this._transformCache.get(transformPath);
     if (cached)
       return cached;


     throw new Error(
         `Jest was unable to load the transformer defined for ${filename}. This is a bug in Jest, please open up an issue`,
     );
   }

   private _buildTransformResult(
     filename: string,
     cacheFilePath: string,
     content: string,
     transformer: Transformer | undefined,
     shouldCallTransform: boolean,
     options: ReducedTransformOptions,
     processed: TransformedSource | null,
     sourceMapPath: string | null,
   ): TransformResult {
     let transformed: TransformedSource = {
       code: content,
       map: null,
     };

     if (transformer && shouldCallTransform) {
       if (typeof processed === 'string') {
         transformed.code = processed;
       } else if (processed !== null && typeof processed.code === 'string') {
         transformed = processed;
       } else {
         throw new TypeError(
             "Jest: a transform's `process` function must return a string, " +
             'or an object with `code` key containing this string.'
         );
       }
     }

     if (!transformed.map) {
       try {
         // Could be a potential freeze here.
         // See: https://github.com/facebook/jest/pull/5177#discussion_r158883570
         const inlineSourceMap = sourcemapFromSource(transformed.code);
         if (inlineSourceMap)
           transformed.map = inlineSourceMap.toObject();

       } catch {
         const transformPath = this._getTransformPath(filename);
         console.warn(
             `jest-transform: The source map produced for the file ${filename} ` +
             `by ${transformPath} was invalid. Proceeding without source ` +
             'mapping for that file.',
         );
       }
     }

     const map = transformed.map;
     const code = transformed.code;

     if (map) {
       const sourceMapContent =
         typeof map === 'string' ? map : JSON.stringify(map);

       invariant(sourceMapPath, 'We should always have default sourceMapPath');

       writeCacheFile(sourceMapPath, sourceMapContent);
     } else {
       sourceMapPath = null;
     }

     writeCodeCacheFile(cacheFilePath, code);

     return {
       code,
       originalCode: content,
       sourceMapPath,
     };
   }

   transformSource(
     filepath: string,
     content: string,
     options: ReducedTransformOptions,
   ): TransformResult {
     const filename = fs.realpathSync(filepath);
     const {transformer, transformerConfig = {}} =
       this._getTransformer(filename) || {};
     const cacheFilePath = this._getFileCachePath(filename, content, options);
     const sourceMapPath: string = cacheFilePath + '.map';
     // Ignore cache if `config.cache` is set (--no-cache)
     const code = this._config.cache ? readCodeCacheFile(cacheFilePath) : null;

     if (code) {
       // This is broken: we return the code, and a path for the source map
       // directly from the cache. But, nothing ensures the source map actually
       // matches that source code. They could have gotten out-of-sync in case
       // two separate processes write concurrently to the same cache files.
       return {
         code,
         originalCode: content,
         sourceMapPath,
       };
     }

     let processed = null;

     let shouldCallTransform = false;

     if (transformer && this.shouldTransform(filename)) {
       shouldCallTransform = true;

       assertSyncTransformer(transformer, this._getTransformPath(filename));

       processed = transformer.process(content, filename, {
         ...options,
         cacheFS: this._cacheFS,
         config: this._config,
         configString: this._cache.configString,
         transformerConfig,
       });
     }

     return this._buildTransformResult(
         filename,
         cacheFilePath,
         content,
         transformer,
         shouldCallTransform,
         options,
         processed,
         sourceMapPath,
     );
   }

   private _transformAndBuildScript(
     filename: string,
     options: Options,
     transformOptions: ReducedTransformOptions,
     fileSource?: string,
   ): TransformResult {
     const {isInternalModule} = options;
     let fileContent = fileSource ?? this._cacheFS.get(filename);
     if (!fileContent) {
       fileContent = fs.readFileSync(filename, 'utf8');
       this._cacheFS.set(filename, fileContent);
     }
     const content = stripShebang(fileContent);

     let code = content;
     let sourceMapPath: string | null = null;

     const willTransform =
       !isInternalModule &&
       this.shouldTransform(filename);

     if (willTransform) {
       const transformedSource = this.transformSource(
           filename,
           content,
           transformOptions,
       );

       code = transformedSource.code;
       sourceMapPath = transformedSource.sourceMapPath;
     }

     return {
       code,
       originalCode: content,
       sourceMapPath,
     };
   }

   transform(
     filename: string,
     options: Options,
     fileSource?: string,
   ): TransformResult {
     const scriptCacheKey = getScriptCacheKey(filename);

     let result = this._cache.transformedFiles.get(scriptCacheKey);
     if (result)
       return result;


     result = this._transformAndBuildScript(
         filename,
         options,
         {...options},
         fileSource,
     );

     if (scriptCacheKey)
       this._cache.transformedFiles.set(scriptCacheKey, result);


     return result;
   }

   transformJson(
     filename: string,
     options: Options,
     fileSource: string,
   ): string {
     const {isInternalModule} = options;
     const willTransform = !isInternalModule && this.shouldTransform(filename);

     if (willTransform) {
       const {code: transformedJsonSource} = this.transformSource(
           filename,
           fileSource,
           {...options},
       );
       return transformedJsonSource;
     }

     return fileSource;
   }

   shouldTransform(filename: string): boolean {
     const ignoreRegexp = this._cache.ignorePatternsRegExp;
     const isIgnored = ignoreRegexp ? ignoreRegexp.test(filename) : false;

     return this._config.transform.length !== 0 && !isIgnored;
   }
}

const removeFile = (path: string) => {
  try {
    fs.unlinkSync(path);
  } catch {}
};

const stripShebang = (content: string) => {
  // If the file data starts with a shebang remove it. Leaves the empty line
  // to keep stack trace line numbers correct.
  if (content.startsWith('#!'))
    return content.replace(/^#!.*/, '');
  else
    return content;

};

/**
  * This is like `writeCacheFile` but with an additional sanity checksum. We
  * cannot use the same technique for source maps because we expose source map
  * cache file paths directly to callsites, with the expectation they can read
  * it right away. This is not a great system, because source map cache file
  * could get corrupted, out-of-sync, etc.
  */
function writeCodeCacheFile(cachePath: string, code: string) {
  const checksum = createHash('md5').update(code).digest('hex');
  writeCacheFile(cachePath, checksum + '\n' + code);
}

/**
  * Read counterpart of `writeCodeCacheFile`. We verify that the content of the
  * file matches the checksum, in case some kind of corruption happened. This
  * could happen if an older version of `jest-runtime` writes non-atomically to
  * the same cache, for example.
  */
function readCodeCacheFile(cachePath: string): string | null {
  const content = readCacheFile(cachePath);
  if (content === null)
    return null;

  const code = content.substr(33);
  const checksum = createHash('md5').update(code).digest('hex');
  if (checksum === content.substr(0, 32))
    return code;

  return null;
}

/**
  * Writing to the cache atomically relies on 'rename' being atomic on most
  * file systems. Doing atomic write reduces the risk of corruption by avoiding
  * two processes to write to the same file at the same time. It also reduces
  * the risk of reading a file that's being overwritten at the same time.
  */
const writeCacheFile = (cachePath: string, fileData: string) => {
  try {
    fs.writeFileSync(cachePath, fileData, {encoding: 'utf8'});
  } catch (e) {
    e.message =
       'failed to cache transform results in: ' +
       cachePath +
       '\nFailure message: ' +
       e.message;
    removeFile(cachePath);
    throw e;
  }
};

const readCacheFile = (cachePath: string): string | null => {
  if (!fs.existsSync(cachePath))
    return null;


  let fileData;
  try {
    fileData = fs.readFileSync(cachePath, 'utf8');
  } catch (e) {
    e.message =
       'jest: failed to read cache file: ' +
       cachePath +
       '\nFailure message: ' +
       e.message;
    removeFile(cachePath);
    throw e;
  }

  if (fileData === null) {
    // We must have somehow created the file but failed to write to it,
    // let's delete it and retry.
    removeFile(cachePath);
  }
  return fileData;
};

const getScriptCacheKey = (filename: string) => {
  const mtime = fs.statSync(filename).mtime;
  return filename + '_' + mtime.getTime();
};

const calcIgnorePatternRegExp = (config: ProjectConfig) => {
  if (
    !config.transformIgnorePatterns ||
     config.transformIgnorePatterns.length === 0
  )
    return undefined;


  return new RegExp(config.transformIgnorePatterns.join('|'));
};

const calcTransformRegExp = (config: ProjectConfig) => {
  if (!config.transform.length)
    return undefined;


  const transformRegexp: Array<[RegExp, string, Record<string, unknown>]> = [];
  for (let i = 0; i < config.transform.length; i++) {
    transformRegexp.push([
      new RegExp(config.transform[i][0]),
      config.transform[i][1],
      config.transform[i][2],
    ]);
  }

  return transformRegexp;
};

function invariant(condition: unknown, message?: string): asserts condition {
  if (!condition)
    throw new Error(message);

}

function assertSyncTransformer(
  transformer: Transformer,
  name: string | undefined,
): asserts transformer is Transformer {
  invariant(name);
  invariant(
      typeof transformer.process === 'function',
      `Jest: synchronous transformer ${name} must export a "process" function.`,
  );
}

export type TransformerType = ScriptTransformer;

export async function createScriptTransformer(
  config: ProjectConfig,
  cacheFS: StringMap = new Map(),
): Promise<TransformerType> {
  const transformer = new ScriptTransformer(config, cacheFS);

  await transformer.loadTransformers();

  return transformer;
}
