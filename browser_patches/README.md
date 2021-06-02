- [Contributing Browser Patches](#Contributing-browser-patches)
    * [1. Setting up local browser checkout](#1-setting-up-local-browser-checkout)
    * [2. Developing a new change](#2-developing-a-new-change)
    * [3. Exporting your change to playwright repo](#3-exporting-your-change-to-playwright-repo)
    * [4. Rolling Playwright to the new browser build](#4-rolling-playwright-to-the-new-browser-build)
- [Cheatsheet](#cheatsheet)
    * [Firefox](#firefox)
        - [stack trace](#stack-trace)
        - [logging](#logging)
    * [WebKit](#webkit)
        - [Debugging Windows](#degugging-windows)
        - [Enable core dumps on Linux](#enable-core-dumps-on-linux)

# Contributing Browser Patches

Firefox and WebKit have additional patches atop to expose necessary capabilities.

Ideally, all these changes should be upstreamed.
For the time being, it is possible to setup a browser checkout
and develop from there.

[WebKit upstream status](webkit/upstream_status.md)

## 1. Setting up local browser checkout

From the `playwright` repo, run the following command:

```bash
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

```bash
$ git checkout -b my-new-feature playwright-build
$ # develop my feature on the my-new-feature branch ....
```

## 3. Exporting your change to playwright repo

Once you're happy with the work you did in the browser-land, you want to export it to the `playwright` repo.

Assuming that you're in the root of the `playwright` repo and that your browser checkout has your feature branch checked out:

```bash
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

```bash
$ node utils/roll_browser.js chromium 123456
```

# Cheatsheet

## See browser stdout/stderr

Set the `DEBUG=pw:browser` environment variable to see it.

## Firefox

#### Stack trace

In `//mozglue/misc/StackWalk.cpp` add

```c++
#define MOZ_DEMANGLE_SYMBOLS 1
```

In native code use

```c++
nsTraceRefcnt::WalkTheStack(stderr);
```

If the stack trace is still mangled `cat` it to `tools/rb/fix_linux_stack.py`

#### Logging

Upstream documentation: https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Gecko_Logging

```bash
MOZ_LOG=nsHttp:5
```

Module name is a string passed to the `mozilla::LazyLogModule` of the corresponding component, e.g.:

```c++
LazyLogModule gHttpLog("nsHttp");
```

Inside Juggler, you can use `dump('foo\n')`.

## WebKit

#### Logging

Inside Objective-C you can use [NSLog](https://developer.apple.com/documentation/foundation/1395275-nslog).

```
NSLog(@"Foobar value: %@", value);
```

#### Debugging windows

In `Source\WTF\wtf\win\DbgHelperWin.cpp` replace

```#if !defined(NDEBUG)``` with ```#if 1```

Then regular `WTFReportBacktrace()` works.

#### Enable core dumps on Linux

```bash
mkdir -p /tmp/coredumps
sudo bash -c 'echo "/tmp/coredumps/core-pid_%p.dump" > /proc/sys/kernel/core_pattern'
ulimit -c unlimited
```

Then to read stack traces run the following command:
```bash
# To find out crashing process name
file core-pid_29652.dump
# Point gdb to the local binary of the crashed process and the core file
gdb $HOME/.cache/ms-playwright/webkit-1292/minibrowser-gtk/WebKitWebProcess core-pid_29652
# Inside gdb update .so library search path to the local one
set solib-search-path /home/yurys/.cache/ms-playwright/webkit-1292/minibrowser-gtk
# Finally print backtrace
bt
```
