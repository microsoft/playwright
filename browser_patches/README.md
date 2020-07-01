# Contributing Browser Patches

Firefox and WebKit have additional patches atop to expose necessary capabilities.

Ideally, all these changes should be upstreamed.
For the time being, it is possible to setup a browser checkout
and develop from there.

[WebKit upstream status](webkit/upstream_status.md)

## 1. Setting up local browser checkout

From the `playwright` repo, run the following command:

```sh
$ ./browser_patches/prepare_checkout.sh firefox <path to checkout>
```
(you can optionally pass "webkit" for a webkit checkout)

If you don't have a checkout, don't pass a path and one will be created for you in `./browser_patches/firefox/checkout`

> **NOTE:** this command downloads GBs of data.


This command will:
- create a `browser_upstream` remote in the checkout
- create a `playwright-build` branch and apply all playwright-required patches to it.

## 2. Developing a new change

You want to create a new branch off the `playwright-build` branch.

Assuming that you're under `./browser_patches/firefox/checkout`:

```sh
$ git checkout -b my-new-feature playwright-build
$ # develop my feature on the my-new-feature branch ....
```

## 3. Exporting your change to playwright repo

Once you're happy with the work you did in the browser-land, you want to export it to the `playwright` repo.

Assuming that you're in the root of the `playwright` repo and that your browser checkout has your feature branch checked out:

```sh
$ ./browser_patches/export.sh firefox <path to checkout>
```

This script will:
- create a new patch and put it to the `./browser_patches/firefox/patches/`
- update the `./browser_patches/firefox/UPSTREAM_CONFIG.sh` if necessary
- bump the `./browser_patches/firefox/BUILD_NUMBER` number.

If you omit the path to your checkout, the script will assume one is located at `./browser_patches/firefox/checkout`

Send a PR to the Playwright repo to be reviewed.

## 4. Rolling Playwright to the new browser build

Once the patch has been committed, the build bots will kick in, compile and upload a new browser version to all the platforms. Then you can roll the browser:

```sh
$ node utils/roll_browser.js chromium 123456
```
