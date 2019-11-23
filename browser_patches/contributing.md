# Contributing Browser Patches

Firefox and WebKit have additional patches atop to expose necessary capabilities.

Ideally, all these changes should be upstreamed.
For the time being, it is possible to setup a browser checkout
and develop from there.

## 1. Setting up local browser checkout

From the `playwright` repo, run the following command:

```sh
$ ./browser_patches/prepare_checkout.sh firefox
```

(you can optionally pass "webkit" for a webkit checkout)

> **NOTE:** this command downloads GBs of data.

This command will:
- create a git browser checkout at `./browser_patches/firefox/checkout`
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
$ ./browser_patches/export.sh firefox
```

This script will:
- create a new patch and put it to the `./browser_patches/firefox/patches/`
- update the `./browser_patches/firefox/UPSTREAM_CONFIG.sh` if necessary
- bump the `./browser_patches/firefox/BUILD_NUMBER` number.

Send a PR to the PlayWright repo to be reviewed. 

## 4. Rolling PlayWright to the new browser build

Once the patch has been committed, the build bots will kick in, compile and upload a new browser version to all the platforms.

You can check the CDN status:

```sh
$ ./browser_patches/tools/check_cdn.sh
```

As the builds appear, you can roll to a new browser version in the `./package.json` file.


# FAQ

## Q: Can I reuse my other browser checkout?

Yes, you can. For this:
- pass path to your browser checkout as a second argument to `prepare_checkout.sh` script.
- pass path to your browser checkout as a second argument to `export.sh` when exporting changes.