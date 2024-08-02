"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.requireOrImport = requireOrImport;
exports.resolveHook = resolveHook;
exports.setTransformConfig = setTransformConfig;
exports.setTransformData = setTransformData;
exports.shouldTransform = shouldTransform;
exports.transformConfig = transformConfig;
exports.transformHook = transformHook;
exports.wrapFunctionWithLocation = wrapFunctionWithLocation;
var _crypto = _interopRequireDefault(require("crypto"));
var _path = _interopRequireDefault(require("path"));
var _url = _interopRequireDefault(require("url"));
var _utilsBundle = require("../utilsBundle");
var _tsconfigLoader = require("../third_party/tsconfig-loader");
var _module = _interopRequireDefault(require("module"));
var _util = require("../util");
var _compilationCache = require("./compilationCache");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

const version = require('../../package.json').version;
const cachedTSConfigs = new Map();
let _transformConfig = {
  babelPlugins: [],
  external: []
};
let _externalMatcher = () => false;
function setTransformConfig(config) {
  _transformConfig = config;
  _externalMatcher = (0, _util.createFileMatcher)(_transformConfig.external);
}
function transformConfig() {
  return _transformConfig;
}
function validateTsConfig(tsconfig) {
  var _tsconfig$absoluteBas, _tsconfig$paths, _tsconfig$paths2;
  // When no explicit baseUrl is set, resolve paths relative to the tsconfig file.
  // See https://www.typescriptlang.org/tsconfig#paths
  const pathsBase = (_tsconfig$absoluteBas = tsconfig.absoluteBaseUrl) !== null && _tsconfig$absoluteBas !== void 0 ? _tsconfig$absoluteBas : (_tsconfig$paths = tsconfig.paths) === null || _tsconfig$paths === void 0 ? void 0 : _tsconfig$paths.pathsBasePath;
  // Only add the catch-all mapping when baseUrl is specified
  const pathsFallback = tsconfig.absoluteBaseUrl ? [{
    key: '*',
    values: ['*']
  }] : [];
  return {
    allowJs: !!tsconfig.allowJs,
    pathsBase,
    paths: Object.entries(((_tsconfig$paths2 = tsconfig.paths) === null || _tsconfig$paths2 === void 0 ? void 0 : _tsconfig$paths2.mapping) || {}).map(([key, values]) => ({
      key,
      values
    })).concat(pathsFallback)
  };
}
function loadAndValidateTsconfigsForFile(file) {
  const cwd = _path.default.dirname(file);
  if (!cachedTSConfigs.has(cwd)) {
    const loaded = (0, _tsconfigLoader.tsConfigLoader)({
      cwd
    });
    cachedTSConfigs.set(cwd, loaded.map(validateTsConfig));
  }
  return cachedTSConfigs.get(cwd);
}
const pathSeparator = process.platform === 'win32' ? ';' : ':';
const builtins = new Set(_module.default.builtinModules);
function resolveHook(filename, specifier) {
  if (specifier.startsWith('node:') || builtins.has(specifier)) return;
  if (!shouldTransform(filename)) return;
  if (isRelativeSpecifier(specifier)) return (0, _util.resolveImportSpecifierExtension)(_path.default.resolve(_path.default.dirname(filename), specifier));
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const tsconfigs = loadAndValidateTsconfigsForFile(filename);
  for (const tsconfig of tsconfigs) {
    if (!isTypeScript && !tsconfig.allowJs) continue;
    let longestPrefixLength = -1;
    let pathMatchedByLongestPrefix;
    for (const {
      key,
      values
    } of tsconfig.paths) {
      let matchedPartOfSpecifier = specifier;
      const [keyPrefix, keySuffix] = key.split('*');
      if (key.includes('*')) {
        // * If pattern contains '*' then to match pattern "<prefix>*<suffix>" module name must start with the <prefix> and end with <suffix>.
        // * <MatchedStar> denotes part of the module name between <prefix> and <suffix>.
        // * If module name can be matches with multiple patterns then pattern with the longest prefix will be picked.
        // https://github.com/microsoft/TypeScript/blob/f82d0cb3299c04093e3835bc7e29f5b40475f586/src/compiler/moduleNameResolver.ts#L1049
        if (keyPrefix) {
          if (!specifier.startsWith(keyPrefix)) continue;
          matchedPartOfSpecifier = matchedPartOfSpecifier.substring(keyPrefix.length, matchedPartOfSpecifier.length);
        }
        if (keySuffix) {
          if (!specifier.endsWith(keySuffix)) continue;
          matchedPartOfSpecifier = matchedPartOfSpecifier.substring(0, matchedPartOfSpecifier.length - keySuffix.length);
        }
      } else {
        if (specifier !== key) continue;
        matchedPartOfSpecifier = specifier;
      }
      if (keyPrefix.length <= longestPrefixLength) continue;
      for (const value of values) {
        let candidate = value;
        if (value.includes('*')) candidate = candidate.replace('*', matchedPartOfSpecifier);
        candidate = _path.default.resolve(tsconfig.pathsBase, candidate);
        const existing = (0, _util.resolveImportSpecifierExtension)(candidate);
        if (existing) {
          longestPrefixLength = keyPrefix.length;
          pathMatchedByLongestPrefix = existing;
        }
      }
    }
    if (pathMatchedByLongestPrefix) return pathMatchedByLongestPrefix;
  }
  if (_path.default.isAbsolute(specifier)) {
    // Handle absolute file paths like `import '/path/to/file'`
    // Do not handle module imports like `import 'fs'`
    return (0, _util.resolveImportSpecifierExtension)(specifier);
  }
}
function shouldTransform(filename) {
  if (_externalMatcher(filename)) return false;
  return !(0, _compilationCache.belongsToNodeModules)(filename);
}
let transformData;
function setTransformData(pluginName, value) {
  transformData.set(pluginName, value);
}
function transformHook(originalCode, filename, moduleUrl) {
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.mts') || filename.endsWith('.cts');
  const hasPreprocessor = process.env.PW_TEST_SOURCE_TRANSFORM && process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE && process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE.split(pathSeparator).some(f => filename.startsWith(f));
  const pluginsPrologue = _transformConfig.babelPlugins;
  const pluginsEpilogue = hasPreprocessor ? [[process.env.PW_TEST_SOURCE_TRANSFORM]] : [];
  const hash = calculateHash(originalCode, filename, !!moduleUrl, pluginsPrologue, pluginsEpilogue);
  const {
    cachedCode,
    addToCache,
    serializedCache
  } = (0, _compilationCache.getFromCompilationCache)(filename, hash, moduleUrl);
  if (cachedCode !== undefined) return {
    code: cachedCode,
    serializedCache
  };

  // We don't use any browserslist data, but babel checks it anyway.
  // Silence the annoying warning.
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';
  const {
    babelTransform
  } = require('./babelBundle');
  transformData = new Map();
  const {
    code,
    map
  } = babelTransform(originalCode, filename, isTypeScript, !!moduleUrl, pluginsPrologue, pluginsEpilogue);
  if (!code) return {
    code: '',
    serializedCache
  };
  const added = addToCache(code, map, transformData);
  return {
    code,
    serializedCache: added.serializedCache
  };
}
function calculateHash(content, filePath, isModule, pluginsPrologue, pluginsEpilogue) {
  const hash = _crypto.default.createHash('sha1').update(isModule ? 'esm' : 'no_esm').update(content).update(filePath).update(version).update(pluginsPrologue.map(p => p[0]).join(',')).update(pluginsEpilogue.map(p => p[0]).join(',')).digest('hex');
  return hash;
}
async function requireOrImport(file) {
  const revertBabelRequire = installTransform();
  const isModule = (0, _util.fileIsModule)(file);
  try {
    const esmImport = () => eval(`import(${JSON.stringify(_url.default.pathToFileURL(file))})`);
    if (isModule) return await esmImport();
    const result = require(file);
    const depsCollector = (0, _compilationCache.currentFileDepsCollector)();
    if (depsCollector) {
      const module = require.cache[file];
      if (module) collectCJSDependencies(module, depsCollector);
    }
    return result;
  } finally {
    revertBabelRequire();
  }
}
function installTransform() {
  (0, _compilationCache.installSourceMapSupportIfNeeded)();
  let reverted = false;
  const originalResolveFilename = _module.default._resolveFilename;
  function resolveFilename(specifier, parent, ...rest) {
    if (!reverted && parent) {
      const resolved = resolveHook(parent.filename, specifier);
      if (resolved !== undefined) specifier = resolved;
    }
    return originalResolveFilename.call(this, specifier, parent, ...rest);
  }
  _module.default._resolveFilename = resolveFilename;
  const revertPirates = _utilsBundle.pirates.addHook((code, filename) => {
    if (!shouldTransform(filename)) return code;
    return transformHook(code, filename).code;
  }, {
    exts: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cjs', '.cts']
  });
  return () => {
    reverted = true;
    _module.default._resolveFilename = originalResolveFilename;
    revertPirates();
  };
}
const collectCJSDependencies = (module, dependencies) => {
  module.children.forEach(child => {
    if (!(0, _compilationCache.belongsToNodeModules)(child.filename) && !dependencies.has(child.filename)) {
      dependencies.add(child.filename);
      collectCJSDependencies(child, dependencies);
    }
  });
};
function wrapFunctionWithLocation(func) {
  return (...args) => {
    const oldPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, stackFrames) => {
      const frame = _utilsBundle.sourceMapSupport.wrapCallSite(stackFrames[1]);
      const fileName = frame.getFileName();
      // Node error stacks for modules use file:// urls instead of paths.
      const file = fileName && fileName.startsWith('file://') ? _url.default.fileURLToPath(fileName) : fileName;
      return {
        file,
        line: frame.getLineNumber(),
        column: frame.getColumnNumber()
      };
    };
    const oldStackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 2;
    const obj = {};
    Error.captureStackTrace(obj);
    const location = obj.stack;
    Error.stackTraceLimit = oldStackTraceLimit;
    Error.prepareStackTrace = oldPrepareStackTrace;
    return func(location, ...args);
  };
}
function isRelativeSpecifier(specifier) {
  return specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../');
}