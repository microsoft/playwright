// @ts-check
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

// Can be removed once https://github.com/thejoshwolfe/yauzl/issues/114 is fixed.
/** @type{import('esbuild').Plugin} */
let patchFdSlicerToHideBufferDeprecationWarning = {
  name: 'patch-fd-slicer-deprecation',
  setup(build) {
    build.onResolve({ filter: /fd-slicer/ }, () => {
      const originalPath = require.resolve('fd-slicer');
      const patchedPath = path.join(path.dirname(originalPath), path.basename(originalPath, '.js') + '.pw-patched.js');
      let sourceFileContent = fs.readFileSync(originalPath, 'utf8')
      sourceFileContent = sourceFileContent.replace(/new Buffer\(toRead\)/g, 'Buffer.alloc(toRead)');
      fs.writeFileSync(patchedPath, sourceFileContent);
      return { path: patchedPath }
    });
  },
}

esbuild.build({
  entryPoints: [path.join(__dirname, 'src/zipBundleImpl.ts')],
  bundle: true,
  outdir: path.join(__dirname, '../../lib'),
  plugins: [patchFdSlicerToHideBufferDeprecationWarning],
  format: 'cjs',
  platform: 'node',
  target: 'ES2019',
  watch: process.argv.includes('--watch'),
  sourcemap: process.argv.includes('--sourcemap'),
  minify: process.argv.includes('--minify'),
}).catch(() => process.exit(1));
