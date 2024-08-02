"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tsConfigLoader = tsConfigLoader;
exports.walkForTsConfig = walkForTsConfig;
var path = _interopRequireWildcard(require("path"));
var fs = _interopRequireWildcard(require("fs"));
var _utilsBundle = require("../utilsBundle");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Jonas Kello
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/* eslint-disable */

/**
 * Typing for the parts of tsconfig that we care about
 */

function tsConfigLoader({
  cwd
}) {
  const configPath = resolveConfigPath(cwd);
  if (!configPath) return [];
  const references = [];
  const config = loadTsConfig(configPath, references);
  return [config, ...references];
}
function resolveConfigPath(cwd) {
  if (fs.statSync(cwd).isFile()) {
    return path.resolve(cwd);
  }
  const configAbsolutePath = walkForTsConfig(cwd);
  return configAbsolutePath ? path.resolve(configAbsolutePath) : undefined;
}
function walkForTsConfig(directory, existsSync = fs.existsSync) {
  const tsconfigPath = path.join(directory, "./tsconfig.json");
  if (existsSync(tsconfigPath)) {
    return tsconfigPath;
  }
  const jsconfigPath = path.join(directory, "./jsconfig.json");
  if (existsSync(jsconfigPath)) {
    return jsconfigPath;
  }
  const parentDirectory = path.join(directory, "../");

  // If we reached the top
  if (directory === parentDirectory) {
    return undefined;
  }
  return walkForTsConfig(parentDirectory, existsSync);
}
function resolveConfigFile(baseConfigFile, referencedConfigFile) {
  if (!referencedConfigFile.endsWith('.json')) referencedConfigFile += '.json';
  const currentDir = path.dirname(baseConfigFile);
  let resolvedConfigFile = path.resolve(currentDir, referencedConfigFile);
  // TODO: I don't see how this makes sense, delete in the next minor release.
  if (referencedConfigFile.includes('/') && referencedConfigFile.includes('.') && !fs.existsSync(resolvedConfigFile)) resolvedConfigFile = path.join(currentDir, 'node_modules', referencedConfigFile);
  return resolvedConfigFile;
}
function loadTsConfig(configFilePath, references, visited = new Map()) {
  var _parsedConfig$compile, _parsedConfig$compile2, _parsedConfig$compile3;
  if (visited.has(configFilePath)) return visited.get(configFilePath);
  let result = {
    tsConfigPath: configFilePath
  };
  // Retain result instance below, so that caching works.
  visited.set(configFilePath, result);
  if (!fs.existsSync(configFilePath)) return result;
  const configString = fs.readFileSync(configFilePath, 'utf-8');
  const cleanedJson = StripBom(configString);
  const parsedConfig = _utilsBundle.json5.parse(cleanedJson);
  const extendsArray = Array.isArray(parsedConfig.extends) ? parsedConfig.extends : parsedConfig.extends ? [parsedConfig.extends] : [];
  for (const extendedConfig of extendsArray) {
    const extendedConfigPath = resolveConfigFile(configFilePath, extendedConfig);
    const base = loadTsConfig(extendedConfigPath, references, visited);
    // Retain result instance, so that caching works.
    Object.assign(result, base, {
      tsConfigPath: configFilePath
    });
  }
  if (((_parsedConfig$compile = parsedConfig.compilerOptions) === null || _parsedConfig$compile === void 0 ? void 0 : _parsedConfig$compile.allowJs) !== undefined) result.allowJs = parsedConfig.compilerOptions.allowJs;
  if (((_parsedConfig$compile2 = parsedConfig.compilerOptions) === null || _parsedConfig$compile2 === void 0 ? void 0 : _parsedConfig$compile2.paths) !== undefined) {
    // We must store pathsBasePath from the config that defines "paths" and later resolve
    // based on this absolute path, when no "baseUrl" is specified. See tsc for reference:
    // https://github.com/microsoft/TypeScript/blob/353ccb7688351ae33ccf6e0acb913aa30621eaf4/src/compiler/commandLineParser.ts#L3129
    // https://github.com/microsoft/TypeScript/blob/353ccb7688351ae33ccf6e0acb913aa30621eaf4/src/compiler/moduleSpecifiers.ts#L510
    result.paths = {
      mapping: parsedConfig.compilerOptions.paths,
      pathsBasePath: path.dirname(configFilePath)
    };
  }
  if (((_parsedConfig$compile3 = parsedConfig.compilerOptions) === null || _parsedConfig$compile3 === void 0 ? void 0 : _parsedConfig$compile3.baseUrl) !== undefined) {
    // Follow tsc and resolve all relative file paths in the config right away.
    // This way it is safe to inherit paths between the configs.
    result.absoluteBaseUrl = path.resolve(path.dirname(configFilePath), parsedConfig.compilerOptions.baseUrl);
  }
  for (const ref of parsedConfig.references || []) references.push(loadTsConfig(resolveConfigFile(configFilePath, ref.path), references, visited));
  if (path.basename(configFilePath) === 'jsconfig.json' && result.allowJs === undefined) result.allowJs = true;
  return result;
}
function StripBom(string) {
  if (typeof string !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof string}`);
  }

  // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
  // conversion translates it to FEFF (UTF-16 BOM).
  if (string.charCodeAt(0) === 0xFEFF) {
    return string.slice(1);
  }
  return string;
}