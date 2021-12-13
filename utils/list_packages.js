const fs = require('fs');
const path = require('path');
const packageDir = path.join(__dirname, '..', 'packages');
const packages = fs.readdirSync(packageDir)
  .filter(packageDir => !packageDir.startsWith('.'))
  .map(name => path.join(packageDir, name));

const packagePathToJSON = new Map();
const packageNameToPath = new Map();
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

function* internalDependencies(packagePath) {
  yield packagePath;
  for (const dependency of Object.keys(packagePathToJSON.get(packagePath).dependencies || {})) {
    const dependencyPath = packageNameToPath.get(dependency);
    if (dependencyPath)
      yield* internalDependencies(dependencyPath);
  }
}

const packagesToPublish = packages.filter(packagePath => !packagePathToJSON.get(packagePath).private);

module.exports = {
  packages,
  packageNameToPath,
  packagesToPublish,
};
