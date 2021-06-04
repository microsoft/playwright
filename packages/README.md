# Managing and Publishing Playwright Packages

## Overview

- Playwright ships multiple packages to NPM. All packages that are published to NPM are listed as folders under [`//packages/`](../packages).
- Playwright's [root package.json](../package.json) is **never published to NPM**. It is only used for devmode, e.g. when running `npm install` with no arguments or installing from github.
- Playwright dependencies for all packages are the same and are managed with the [`root package.json`](../package.json).
- Playwright browser versions for all packages are the same and are managed with the [`browsers.json`](../browsers.json).

> **NOTE** As of May 20, 2020, the only exception is the `playwright-electron` package that
> doesn't follow the pack and is published manually. This is due to it's pre-1.0 status.


## Building NPM package

To build a package that will be shipped to NPM, use [`//packages/build_package.js`](./build_package.js) script.
The script populates package folder with contents, and then uses `npm pack` to archive the folder.

As of May 20, 2020, [`//packages/build_package.js`](./build_package.js) does the following:
- copies certain files and folders from `playwright-internal` to the subpackage (e.g. `//lib`, `//types`, `//LICENSE` etc)
- generates `package.json` and puts it in the subpackage
- generates `browsers.json` and puts it in the subpackage
- uses `npm pack` to pack the subpackage folder
- removes all the files that were added during the process

To build `playwright` package and save result as `./playwright.tgz` file:

```bash
./packages/build_package.js playwright ./playwright.tgz
```

To debug what files are put into the folder, use `--no-cleanup` flag and inspect the package folder:

```bash
./packages/build_package.js playwright ./playwright.tgz --no-cleanup
ls ./packages/playwright # inspect the folder
```


## Testing packages

To test packages, use [`//packages/installation-tests/installation-tests.sh`](./installation-tests/installation-tests.sh).


## Publishing packages

 All package publishing happens **exclusively** over CI/CD using the [`//utils/publish_all_packages.sh`](../utils/publish_all_packages.sh) script.

