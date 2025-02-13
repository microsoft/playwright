// Replace 'import.meta.url' with the CJS equivalent.
// See https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
export var import_meta_url = require('url').pathToFileURL(__filename);
