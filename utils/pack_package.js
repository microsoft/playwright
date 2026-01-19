/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_NAME = path.basename(__filename);

function usage() {
  return `
Usage: node ${SCRIPT_NAME} <package-name> <output-path>

Arguments:
  package-name   Name of the package to pack (e.g., 'playwright', 'playwright-chromium')
  output-path    Destination path for the packed .tgz file

Example:
  node ${SCRIPT_NAME} playwright ./dist/playwright.tgz
`;
}

// 1. Parse CLI arguments
const args = process.argv.slice(2);
if (args.some(arg => arg === '--help' || arg === '-h')) {
  console.log(usage());
  process.exit(0);
} else if (args.length < 1) {
  console.error(`Error: Please specify package name, e.g. 'playwright' or 'playwright-chromium'.`);
  console.log(`Try running: node ${SCRIPT_NAME} --help`);
  process.exit(1);
} else if (args.length < 2) {
  console.error(`Error: Please specify output path`);
  console.log(`Try running: node ${SCRIPT_NAME} --help`);
  process.exit(1);
}

const packageName = args[0];
const outputPath = path.resolve(args[1]);
const packagePath = path.join(__dirname, '..', 'packages', packageName);

// Validate package path exists
if (!fs.existsSync(packagePath)) {
  console.error(`Error: Package path does not exist: ${packagePath}`);
  console.error(`Available packages should be in: ${path.join(__dirname, '..', 'packages')}`);
  process.exit(1);
}

// Validate package.json exists
const packageJsonPath = path.join(packagePath, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error(`Error: package.json not found at: ${packageJsonPath}`);
  process.exit(1);
}

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (error) {
    console.error(`Error: Failed to create output directory: ${outputDir}`);
    console.error(error.message);
    process.exit(1);
  }
}

const shell = os.platform() === 'win32';
const { stdout, stderr, status } = spawnSync('npm', ['pack'], { 
  cwd: packagePath, 
  encoding: 'utf8', 
  shell 
});

if (status !== 0) {
  console.error(`Error: "npm pack" failed with exit code ${status}`);
  if (stderr) console.error(stderr);
  if (stdout) console.error(stdout);
  process.exit(1);
}

const tgzName = stdout.trim();
if (!tgzName) {
  console.error(`Error: npm pack did not output a filename`);
  process.exit(1);
}

const sourcePath = path.join(packagePath, tgzName);

// Verify the packed file exists
if (!fs.existsSync(sourcePath)) {
  console.error(`Error: Packed file not found at: ${sourcePath}`);
  process.exit(1);
}

// Move result to the outputPath
try {
  fs.renameSync(sourcePath, outputPath);
  console.log(`✓ Successfully packed to: ${outputPath}`);
} catch (error) {
  console.error(`Error: Failed to move packed file to: ${outputPath}`);
  console.error(error.message);
  
  // Try to clean up the source file if it still exists
  if (fs.existsSync(sourcePath)) {
    try {
      fs.unlinkSync(sourcePath);
      console.log(`Cleaned up temporary file: ${sourcePath}`);
    } catch (cleanupError) {
      console.error(`Warning: Could not clean up: ${sourcePath}`);
    }
  }
  process.exit(1);
}
process.exit(0);

//