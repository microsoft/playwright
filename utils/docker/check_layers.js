#!/usr/bin/env node
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
 *
 * The same file is in microsoft/playwright, microsoft/playwright-python,
 * microsoft/playwright-java and microsoft/playwright-mcp, in utils/docker/.
 * Keep the copies the same.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SCRIPT_NAME = path.basename(__filename);

// A file that a later layer deletes is still in the layer that created it. It makes
// the image larger, and everyone who pulls the image can read it there. So the check
// reads every layer, not the file system of the final image.
//
// This check looks only at the paths of the files. It does not look for secrets:
// the Trivy scan in the Docker tests does that, by content.
//
// Each pattern is matched against the path of a file in a layer, for example
// "root/.npm/_logs/2026-01-01-debug-0.log".
const FORBIDDEN = [
  // npm: the cache and the debug logs.
  /(^|\/)\.npm\//,
  /(^|\/)_cacache\//,
  /(^|\/)_logs\/.*-debug-\d+\.log$/,
  // Node.js: the compile cache that npm turns on. It is in the temporary directory.
  /(^|\/)node-compile-cache\//,
  // yarn.
  /(^|\/)\.yarn\//,
  // Maven: the local repository.
  /(^|\/)\.m2\//,
  // The cache directory of a user: pip, virtualenv, yarn and other tools write here.
  /(^|\/)\.cache\//,
  // Source control.
  /(^|\/)\.git\//,
];

function usage() {
  return `usage: ${SCRIPT_NAME} [--list-files] playwright:localbuild-noble

Check that no layer of the docker image contains files that a build step
must not leave behind, such as a package manager cache or a .git directory.

  --list-files  also print every file that the layers of our Dockerfile add.
                Layers of the base image are not listed.
`;
}

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(usage());
  process.exit(args.length ? 0 : 1);
}
const listFiles = args.includes('--list-files');
const images = args.filter(arg => arg !== '--list-files');
if (images.length !== 1 || images[0].startsWith('-')) {
  console.error(usage());
  process.exit(1);
}
const image = images[0];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-layers-'));
process.on('exit', () => fs.rmSync(tmpDir, { recursive: true, force: true }));

console.log(`Checking the layers of ${image} for caches and other files that must not be in the image...`);
// Unpack the image without a copy of the archive on disk. With pipefail, a
// failure of "docker save" fails the command too.
const saved = spawnSync('bash', ['-o', 'pipefail', '-c', 'docker save "$0" | tar -x -C "$1"', image, tmpDir], { stdio: 'inherit' });
if (saved.status !== 0) {
  console.error(`ERROR: cannot save and unpack ${image}`);
  process.exit(1);
}

let failed = false;
const layers = readLayers(tmpDir);
if (!layers.length) {
  console.error(`ERROR: found no layers in ${image}`);
  process.exit(1);
}
layers.forEach((layer, index) => {
  const files = listLayerFiles(path.join(tmpDir, layer.file));
  if (listFiles && layer.ours) {
    console.log(`\n=== layer ${index + 1}: ${layer.step}`);
    console.log(`=== ${files.length} file(s). A ".wh." name marks a file that the layer deletes.`);
    console.log(files.join('\n'));
  }
  const matches = files.filter(file => FORBIDDEN.some(re => re.test(file)));
  if (!matches.length)
    return;
  failed = true;
  console.log(`\nERROR: layer ${index + 1} contains ${matches.length} forbidden file(s).`);
  console.log(`  step: ${layer.step}`);
  for (const file of matches.slice(0, 20))
    console.log(`  ${file}`);
});

if (failed) {
  console.error('\nThese files stay in the image even when a later layer deletes them.');
  console.error('Do not create them, or delete them in the RUN step that creates them.');
  process.exit(1);
}
console.log(`\nChecked ${layers.length} layer(s), found no forbidden files.`);

/**
 * Returns the layers of an unpacked "docker save" archive, bottom layer first.
 * @returns {{ file: string, ours: boolean, step: string }[]}
 */
function readLayers(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))[0];
  const config = JSON.parse(fs.readFileSync(path.join(dir, manifest.Config), 'utf8'));
  // The history also has the steps that make no layer, such as ENV and ARG.
  const steps = (config.history || []).filter(step => !step.empty_layer);
  return manifest.Layers.map((file, i) => {
    const step = steps[i] || {};
    // BuildKit puts the build arguments in front of a RUN command. Remove them.
    const command = (step.created_by || '?').replace(/^RUN \|\d+ .*? \/bin\/sh -c /, 'RUN ').replace(/\s+/g, ' ');
    return {
      file,
      // BuildKit marks the steps of the Dockerfile that it runs. The base image has no mark.
      ours: (step.comment || '').includes('buildkit.dockerfile'),
      step: command.length > 100 ? command.slice(0, 100) + '...' : command,
    };
  });
}

/**
 * Returns the paths of the files in a layer. tar reads both plain and compressed layers.
 */
function listLayerFiles(layerFile) {
  const output = execFileSync('tar', ['-tf', layerFile], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 });
  return output.split('\n')
      // Paths in a layer can start with "./".
      .map(line => line.replace(/^\.\//, ''))
      // Skip directory entries: an empty directory is not a problem.
      .filter(line => line && !line.endsWith('/'));
}
