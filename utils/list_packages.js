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
//@ts-check
const fs = require('fs');
const path = require('path');
const packageDir = path.join(__dirname, '..', 'packages');
const packages = fs.readdirSync(packageDir).map(name => {
  return path.join(packageDir, name);
}).filter(package => {
  return fs.existsSync(path.join(package, 'package.json'));
});

/** @type {Map<string, any>} */
const packagePathToJSON = new Map();
/** @type {Map<string, string>} */
const packageNameToPath = new Map();
/** @type {Map<string, Set<string>>} */
const packagePathToDependencies = new Map();
for (const packagePath of packages) {
  const packageJSON = require(path.join(packagePath, 'package.json'));
  packageNameToPath.set(packageJSON.name, packagePath);
  packagePathToJSON.set(packagePath, packageJSON);
}

for (const packagePath of packages)
  packagePathToDependencies.set(packagePath, new Set(internalDependencies(packagePath)));

// Sort packages by their interdependence.
packages.sort((a, b) => {
  if (packagePathToDependencies.get(a).has(b))
    return 1;
  if (packagePathToDependencies.get(b).has(a))
    return -1;
  return 0;
});

module.exports = {packages, packageNameToPath};

/**
 * @param {string} packagePath
 */
function* internalDependencies(packagePath) {
  yield packagePath;
  for (const dependency of Object.keys(packagePathToJSON.get(packagePath).dependencies || [])) {
    const dependencyPath = packageNameToPath.get(dependency);
    if (dependencyPath)
      yield * internalDependencies(dependencyPath);
  }
}