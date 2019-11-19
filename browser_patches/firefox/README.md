# Building Juggler (Linux & Mac)

1. Run `./do_checkout.sh` script. This will create a "checkout" folder with gecko-dev mirror from
GitHub and apply the PlayWright-specific patches.
2. Run `./do_build.sh` script to compile browser. Note: you'll need to follow [build instructions](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions) to setup host environment first.

# Updating `FIREFOX_REVISION` and `//patches/*`

The `./export.sh` script will export a patch that describes all the differences between the current branch in `./checkout`
and the `beta` branch in `./checkout`.

# Uploading to Azure CDN

Uploading requires having both `AZ_ACCOUNT_KEY` and `AZ_ACCOUNT_NAME` env variables to be defined.

The following sequence of steps will checkout, build and upload build to Azure CDN on both Linux and Mac:

```sh
$ ./do_checkout.sh
$ ./build.sh
$ ./upload.sh
```
