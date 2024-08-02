"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addSuffixToFilePath = addSuffixToFilePath;
exports.callLogText = void 0;
exports.createFileFiltersFromArguments = createFileFiltersFromArguments;
exports.createFileMatcher = createFileMatcher;
exports.createFileMatcherFromArguments = createFileMatcherFromArguments;
exports.createTitleMatcher = createTitleMatcher;
exports.debugTest = void 0;
exports.errorWithFile = errorWithFile;
exports.expectTypes = expectTypes;
exports.fileIsModule = fileIsModule;
exports.filterStackFile = filterStackFile;
exports.filterStackTrace = filterStackTrace;
exports.filteredStackTrace = filteredStackTrace;
exports.forceRegExp = forceRegExp;
exports.formatLocation = formatLocation;
exports.getContainedPath = getContainedPath;
exports.getPackageJsonPath = getPackageJsonPath;
exports.mergeObjects = mergeObjects;
exports.normalizeAndSaveAttachment = normalizeAndSaveAttachment;
exports.relativeFilePath = relativeFilePath;
exports.resolveImportSpecifierExtension = resolveImportSpecifierExtension;
exports.resolveReporterOutputPath = resolveReporterOutputPath;
exports.sanitizeFilePathBeforeExtension = sanitizeFilePathBeforeExtension;
exports.serializeError = serializeError;
exports.trimLongString = trimLongString;
exports.windowsFilesystemFriendlyLength = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _util = _interopRequireDefault(require("util"));
var _path = _interopRequireDefault(require("path"));
var _url = _interopRequireDefault(require("url"));
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _utils = require("playwright-core/lib/utils");
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

const PLAYWRIGHT_TEST_PATH = _path.default.join(__dirname, '..');
const PLAYWRIGHT_CORE_PATH = _path.default.dirname(require.resolve('playwright-core/package.json'));
function filterStackTrace(e) {
  var _e$stack;
  const name = e.name ? e.name + ': ' : '';
  if (process.env.PWDEBUGIMPL) return {
    message: name + e.message,
    stack: e.stack || ''
  };
  const stackLines = (0, _utils.stringifyStackFrames)(filteredStackTrace(((_e$stack = e.stack) === null || _e$stack === void 0 ? void 0 : _e$stack.split('\n')) || []));
  return {
    message: name + e.message,
    stack: `${name}${e.message}${stackLines.map(line => '\n' + line).join('')}`
  };
}
function filterStackFile(file) {
  if (!process.env.PWDEBUGIMPL && file.startsWith(PLAYWRIGHT_TEST_PATH)) return false;
  if (!process.env.PWDEBUGIMPL && file.startsWith(PLAYWRIGHT_CORE_PATH)) return false;
  return true;
}
function filteredStackTrace(rawStack) {
  const frames = [];
  for (const line of rawStack) {
    const frame = (0, _utilsBundle.parseStackTraceLine)(line);
    if (!frame || !frame.file) continue;
    if (!filterStackFile(frame.file)) continue;
    frames.push(frame);
  }
  return frames;
}
function serializeError(error) {
  if (error instanceof Error) return filterStackTrace(error);
  return {
    value: _util.default.inspect(error)
  };
}
function createFileFiltersFromArguments(args) {
  return args.map(arg => {
    const match = /^(.*?):(\d+):?(\d+)?$/.exec(arg);
    return {
      re: forceRegExp(match ? match[1] : arg),
      line: match ? parseInt(match[2], 10) : null,
      column: match !== null && match !== void 0 && match[3] ? parseInt(match[3], 10) : null
    };
  });
}
function createFileMatcherFromArguments(args) {
  const filters = createFileFiltersFromArguments(args);
  return createFileMatcher(filters.map(filter => filter.re || filter.exact || ''));
}
function createFileMatcher(patterns) {
  const reList = [];
  const filePatterns = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    if ((0, _utils.isRegExp)(pattern)) {
      reList.push(pattern);
    } else {
      if (!pattern.startsWith('**/')) filePatterns.push('**/' + pattern);else filePatterns.push(pattern);
    }
  }
  return filePath => {
    for (const re of reList) {
      re.lastIndex = 0;
      if (re.test(filePath)) return true;
    }
    // Windows might still receive unix style paths from Cygwin or Git Bash.
    // Check against the file url as well.
    if (_path.default.sep === '\\') {
      const fileURL = _url.default.pathToFileURL(filePath).href;
      for (const re of reList) {
        re.lastIndex = 0;
        if (re.test(fileURL)) return true;
      }
    }
    for (const pattern of filePatterns) {
      if ((0, _utilsBundle.minimatch)(filePath, pattern, {
        nocase: true,
        dot: true
      })) return true;
    }
    return false;
  };
}
function createTitleMatcher(patterns) {
  const reList = Array.isArray(patterns) ? patterns : [patterns];
  return value => {
    for (const re of reList) {
      re.lastIndex = 0;
      if (re.test(value)) return true;
    }
    return false;
  };
}
function mergeObjects(a, b, c) {
  const result = {
    ...a
  };
  for (const x of [b, c].filter(Boolean)) {
    for (const [name, value] of Object.entries(x)) {
      if (!Object.is(value, undefined)) result[name] = value;
    }
  }
  return result;
}
function forceRegExp(pattern) {
  const match = pattern.match(/^\/(.*)\/([gi]*)$/);
  if (match) return new RegExp(match[1], match[2]);
  return new RegExp(pattern, 'gi');
}
function relativeFilePath(file) {
  if (!_path.default.isAbsolute(file)) return file;
  return _path.default.relative(process.cwd(), file);
}
function formatLocation(location) {
  return relativeFilePath(location.file) + ':' + location.line + ':' + location.column;
}
function errorWithFile(file, message) {
  return new Error(`${relativeFilePath(file)}: ${message}`);
}
function expectTypes(receiver, types, matcherName) {
  if (typeof receiver !== 'object' || !types.includes(receiver.constructor.name)) {
    const commaSeparated = types.slice();
    const lastType = commaSeparated.pop();
    const typesString = commaSeparated.length ? commaSeparated.join(', ') + ' or ' + lastType : lastType;
    throw new Error(`${matcherName} can be only used with ${typesString} object${types.length > 1 ? 's' : ''}`);
  }
}
const windowsFilesystemFriendlyLength = exports.windowsFilesystemFriendlyLength = 60;
function trimLongString(s, length = 100) {
  if (s.length <= length) return s;
  const hash = (0, _utils.calculateSha1)(s);
  const middle = `-${hash.substring(0, 5)}-`;
  const start = Math.floor((length - middle.length) / 2);
  const end = length - middle.length - start;
  return s.substring(0, start) + middle + s.slice(-end);
}
function addSuffixToFilePath(filePath, suffix) {
  const ext = _path.default.extname(filePath);
  const base = filePath.substring(0, filePath.length - ext.length);
  return base + suffix + ext;
}
function sanitizeFilePathBeforeExtension(filePath) {
  const ext = _path.default.extname(filePath);
  const base = filePath.substring(0, filePath.length - ext.length);
  return (0, _utils.sanitizeForFilePath)(base) + ext;
}

/**
 * Returns absolute path contained within parent directory.
 */
function getContainedPath(parentPath, subPath = '') {
  const resolvedPath = _path.default.resolve(parentPath, subPath);
  if (resolvedPath === parentPath || resolvedPath.startsWith(parentPath + _path.default.sep)) return resolvedPath;
  return null;
}
const debugTest = exports.debugTest = (0, _utilsBundle.debug)('pw:test');
const callLogText = exports.callLogText = _utils.formatCallLog;
const folderToPackageJsonPath = new Map();
function getPackageJsonPath(folderPath) {
  const cached = folderToPackageJsonPath.get(folderPath);
  if (cached !== undefined) return cached;
  const packageJsonPath = _path.default.join(folderPath, 'package.json');
  if (_fs.default.existsSync(packageJsonPath)) {
    folderToPackageJsonPath.set(folderPath, packageJsonPath);
    return packageJsonPath;
  }
  const parentFolder = _path.default.dirname(folderPath);
  if (folderPath === parentFolder) {
    folderToPackageJsonPath.set(folderPath, '');
    return '';
  }
  const result = getPackageJsonPath(parentFolder);
  folderToPackageJsonPath.set(folderPath, result);
  return result;
}
function resolveReporterOutputPath(defaultValue, configDir, configValue) {
  if (configValue) return _path.default.resolve(configDir, configValue);
  let basePath = getPackageJsonPath(configDir);
  basePath = basePath ? _path.default.dirname(basePath) : process.cwd();
  return _path.default.resolve(basePath, defaultValue);
}
async function normalizeAndSaveAttachment(outputPath, name, options = {}) {
  if ((options.path !== undefined ? 1 : 0) + (options.body !== undefined ? 1 : 0) !== 1) throw new Error(`Exactly one of "path" and "body" must be specified`);
  if (options.path !== undefined) {
    var _options$contentType;
    const hash = (0, _utils.calculateSha1)(options.path);
    if (!(0, _utils.isString)(name)) throw new Error('"name" should be string.');
    const sanitizedNamePrefix = (0, _utils.sanitizeForFilePath)(name) + '-';
    const dest = _path.default.join(outputPath, 'attachments', sanitizedNamePrefix + hash + _path.default.extname(options.path));
    await _fs.default.promises.mkdir(_path.default.dirname(dest), {
      recursive: true
    });
    await _fs.default.promises.copyFile(options.path, dest);
    const contentType = (_options$contentType = options.contentType) !== null && _options$contentType !== void 0 ? _options$contentType : _utilsBundle.mime.getType(_path.default.basename(options.path)) || 'application/octet-stream';
    return {
      name,
      contentType,
      path: dest
    };
  } else {
    var _options$contentType2;
    const contentType = (_options$contentType2 = options.contentType) !== null && _options$contentType2 !== void 0 ? _options$contentType2 : typeof options.body === 'string' ? 'text/plain' : 'application/octet-stream';
    return {
      name,
      contentType,
      body: typeof options.body === 'string' ? Buffer.from(options.body) : options.body
    };
  }
}
function fileIsModule(file) {
  if (file.endsWith('.mjs') || file.endsWith('.mts')) return true;
  if (file.endsWith('.cjs') || file.endsWith('.cts')) return false;
  const folder = _path.default.dirname(file);
  return folderIsModule(folder);
}
function folderIsModule(folder) {
  const packageJsonPath = getPackageJsonPath(folder);
  if (!packageJsonPath) return false;
  // Rely on `require` internal caching logic.
  return require(packageJsonPath).type === 'module';
}

// This follows the --moduleResolution=bundler strategy from tsc.
// https://devblogs.microsoft.com/typescript/announcing-typescript-5-0-beta/#moduleresolution-bundler
const kExtLookups = new Map([['.js', ['.jsx', '.ts', '.tsx']], ['.jsx', ['.tsx']], ['.cjs', ['.cts']], ['.mjs', ['.mts']], ['', ['.js', '.ts', '.jsx', '.tsx', '.cjs', '.mjs', '.cts', '.mts']]]);
function resolveImportSpecifierExtension(resolved) {
  if (fileExists(resolved)) return resolved;
  for (const [ext, others] of kExtLookups) {
    if (!resolved.endsWith(ext)) continue;
    for (const other of others) {
      const modified = resolved.substring(0, resolved.length - ext.length) + other;
      if (fileExists(modified)) return modified;
    }
    break; // Do not try '' when a more specific extension like '.jsx' matched.
  }
  if (dirExists(resolved)) {
    // If we import a package, let Node.js figure out the correct import based on package.json.
    if (fileExists(_path.default.join(resolved, 'package.json'))) return resolved;

    // Otherwise, try to find a corresponding index file.
    const dirImport = _path.default.join(resolved, 'index');
    return resolveImportSpecifierExtension(dirImport);
  }
}
function fileExists(resolved) {
  var _fs$statSync;
  return (_fs$statSync = _fs.default.statSync(resolved, {
    throwIfNoEntry: false
  })) === null || _fs$statSync === void 0 ? void 0 : _fs$statSync.isFile();
}
function dirExists(resolved) {
  var _fs$statSync2;
  return (_fs$statSync2 = _fs.default.statSync(resolved, {
    throwIfNoEntry: false
  })) === null || _fs$statSync2 === void 0 ? void 0 : _fs$statSync2.isDirectory();
}