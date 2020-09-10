# Setting Up Build Bots

We currently have 5 build bots that produce 9 browser builds:
- **`buildbot-ubuntu-18.04`**
    - `firefox-ubuntu-18.04.zip`
    - `webkit-ubuntu-18.04.zip`
- **`buildbot-ubuntu-20.04`**
    - `webkit-ubuntu-20.04.zip`
- **`buildbot-mac-10.14`**
    - `firefox-mac-10.14.zip`
    - `webkit-mac-10.14.zip`
- **`buildbot-mac-10.15`**
    - `webkit-mac-10.15.zip`
- **`buildbot-windows`**
    - `firefox-win32.zip`
    - `firefox-win64.zip`
    - `webkit-win64.zip`

This document describes setting up bots infrastructure to produce
browser builds.

Each bot configuration has 3 parts:
1. Setup toolchains to build browsers
2. Setup bot-specific environment required for bot operations
  - `azure-cli`
  - setting `AZ_ACCOUNT_KEY`, `AZ_ACCOUNT_NAME`, `TELEGRAM_BOT_KEY` env variables
3. Running relevant build script `//browser_patches/buildbots/buildbot-*.sh` using host scheduling system (cron on Linux, launchctl on Mac, polling on Win).

- [Windows](#windows)
  - [Setting Up Browser Toolchains](#setting-up-browser-toolchains)
  - [Setting Bot Environment](#setting-bot-environment)
  - [Running Build Loop](#running-build-loop)
- [Mac](#mac)
  - [Setting Up Browser Toolchains](#setting-up-browser-toolchains-1)
  - [Setting Bot Environment](#setting-bot-environment-1)
  - [Running Build Loop](#running-build-loop-1)
- [Linux](#linux)
  - [Setting Up Browser Toolchains](#setting-up-browser-toolchains-2)
  - [Setting Bot Environment](#setting-bot-environment-2)
  - [Running Build Loop](#running-build-loop-2)


# Windows

## Setting Up Browser Toolchains

We currently use MINGW environment that comes with Firefox to run our buildbot infrastructure on Windows.
Browser toolchains:
- Firefox: Follow instructions on [Building Firefox for Windows](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Windows_Prerequisites). Get the checkout with mercurial and run "./mach bootstrap" from mercurial root.
- WebKit: mostly follow instructions on [Building WebKit For Windows](https://trac.webkit.org/wiki/BuildingCairoOnWindows). Use chocolatey to install dependencies; we don't use clang to compile webkit on windows. (**NOTE**: we didn't need to install pywin32 with pip and just skipped that step).
- Our WebKit port requires libvpx. Install [vcpkg](https://github.com/Microsoft/vcpkg) and build libvpx from source. Run the following commands in Windows Terminal as Administrator(required for bootstrap-vcpkg.bat).
```bash
cd c:\
git clone https://github.com/microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat
.\vcpkg.exe install libvpx --triplet x64-windows
```
 If you install vcpkg in a different location, cmake files should be pointed to the new location (see `-DLIBVPX_PACKAGE_PATH` parameter in [`buildwin.bat`](https://github.com/microsoft/playwright/blob/master/browser_patches/webkit/buildwin.bat)).

After this step, you should:
- have `c:\mozilla-build` folder and `c:\mozilla-source` folder with firefox checkout.
- being able to build webkit-cairo from `cmd.exe`. 

## Setting Bot Environment

### 1. Install azure-cli

Install [azure-cli](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-windows?view=azure-cli-latest) for windows using MS Installer

### 2. Export "az" to the mingw world

The easiest away to export "az" to mingw is to create `c:\mozilla-build\bin\az` with the following content:

```
cmd.exe /c "\"C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd\" $1 $2 $3 $4 $5 $6 $7 $8 $9 ${10} ${11} ${12} ${13} ${14} ${15} ${16}"
```

### 3. Install node.js 

Node.js: https://nodejs.org/en/download/


### 4. Set custom env variables to mingw env

Edit `c:\mozilla-build\start-shell.bat` and add the following lines in the beginning:

```bat
SET AZ_ACCOUNT_NAME=<account-name>
SET AZ_ACCOUNT_KEY=<account-key>
SET TELEGRAM_BOT_KEY=<bot_key>
SET WEBKIT_BUILD_PATH=<value of "PATH" variable from cmd.exe>
SET DEVENV="C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\devenv.com"
```
> **NOTE:** mind different quotes position in DEVENV="..." than in PATH (and WEBKIT_BUILD_PATH). This is important.

And right before the `REM Start shell.`, change `PATH` to export locally-installed node.js:
```bat
SET "PATH=C:\Program Files\nodejs\;%PATH%"
```

Remarks:
- the `WEBKIT_BUILD_PATH` value is the value of `PATH` variable. To get the value, run `cmd.exe` and run `PATH` command.
- the `DEVENV` variable should point to VS2019 devenv executable.
- change `<account-name>` and `<account-key>` with relevant keys/names.

> **NOTE:** No spaces or quotes are allowed here!

### 5. Disable git autocrlf and enable longpaths

Run `c:\mozilla-build\start-shell.bat` and run:
- `git config --global core.autocrlf false`
- `git config --global core.longpaths true`

The `core.longpaths` is needed for webkit since it has some very long layout paths.

> **NOTE:** If git config fails, run shell as administrator!

### 6. Checkout Playwright to /c/

Run `c:\mozilla-build\start-shell.bat` and checkout Playwright repo to `/c/playwright`.

### 7. Create a c:\WEBKIT_WIN64_LIBS\ directory with win64 dlls


Create a new `c:\WEBKIT_WIN64_LIBS` folder and copy the following libraries from `C:\Windows\System32` into it:
- `msvcp140.dll`
- `msvcp140_2.dll`
- `vcruntime140.dll`
- `vcruntime140_1.dll`

> **NOTE**: these libraries are expected by `//browser_patches/webkit/archive.sh`. 

This is necessary since mingw is a 32-bit application and cannot access the `C:\Windows\System32` folder due to [Windows FileSystem Redirector](https://docs.microsoft.com/en-us/windows/win32/winprog64/file-system-redirector?redirectedfrom=MSDN). ([StackOverflow question](https://stackoverflow.com/questions/18982551/is-mingw-caching-windows-directory-contents)) 

## Running Build Loop

1. Launch `c:\mozilla-build/start-shell.bat`
2. Run `/c/playwright/browser_patches/buildbots/buildbot-windows.sh`
3. Disable "QuickEdit" terminal mode to avoid [terminal freezing and postponing builds](https://stackoverflow.com/questions/33883530/why-is-my-command-prompt-freezing-on-windows-10)


# Mac

## Setting Up Browser Toolchains

1. Install XCode from AppStore
2. Run XCode once and install components, if it requires any.
2. Install XCode command-line tools: `xcode-select --install`
3. Install homebrew: https://brew.sh/

Mac 10.14 builds both firefox and webkit, whereas we only build webkit on mac 10.15.
Browser Toolchains:
- [Building Firefox On Mac](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Mac_OS_X_Prerequisites)
- [Building WebKit On Mac](https://webkit.org/building-webkit/) (though as of Dec, 2019 it does not require any additional steps)

## Setting Bot Environment

1. Install [`azure-cli`](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-macos?view=azure-cli-latest)
2. Clone `https://github.com/microsoft/playwright`
3. Run `//browser_patches/prepare_checkout.sh` for every browser you care about
4. Make sure `//browser_patches/{webkit,firefox}/build.sh` works and compiles browsers

## Running Build Loop

We use `launchctl` on Mac instead of cron since launchctl lets us run daemons even for non-logged-in users.

Create a `/Library/LaunchDaemons/dev.playwright.plist` with the contents below (will require `sudo` access).
Make sure to change the following fields:

1. Set values for all keys in the `EnvironmentVariables` dict.
2. Put a proper path to the `Program`
3. Make sure to put correct `UserName`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>dev.playwright</string>

    <key>Program</key>
    <string>/Users/aslushnikov/prog/cron/playwright/browser_patches/buildbots/buildbot-mac-10.14.sh</string>

    <key>UserName</key>
    <string>aslushnikov</string>

    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/usr/bin:/usr/sbin</string>

      <key>TELEGRAM_BOT_KEY</key>
      <string></string>

      <key>AZ_ACCOUNT_NAME</key>
      <string></string>

      <key>AZ_ACCOUNT_KEY</key>
      <string></string>

      <key>MOZ_NOSPAM</key>
      <string>1</string>
    </dict>


    <key>StandardOutPath</key>
    <string>/tmp/launchctl-playwright-buildbot.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/launchctl-playwright-buildbot.errorlog</string>

    <key>StartInterval</key>
    <integer>300</integer>
  </dict>
</plist>
```

Next, you can either use `launchctl load` command to load the daemon, or reboot bot to make sure it auto-starts.

> **NOTE**: mozbuild uses [terminal-notifier](https://github.com/julienXX/terminal-notifier) which hangs
> in launchctl environment. The `MOZ_NOSPAM` env variable disables terminal notifications.

Finally, MacBooks tend to go to sleep no matter what their "energy settings" are. To disable sleep permanently on Macs ([source](https://gist.github.com/pwnsdx/2ae98341e7e5e64d32b734b871614915)):

```sh
sudo pmset -a sleep 0; sudo pmset -a hibernatemode 0; sudo pmset -a disablesleep 1;
```

# Linux

## Setting Up Browser Toolchains

1. Note: firefox binaries will crash randomly if compiled with clang 6. They do work when compiled with clang 9.
To install clang 9 on ubuntu and make it default:
```sh
$ sudo apt-get install clang-9
$ sudo update-alternatives --install /usr/bin/clang++ clang++ /usr/bin/clang++-9 100
$ sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-9 100
```

2. FFMPEG cross-compilation requires Docker. Install docker and add `$USER` to docker for sudo-less docker access

```sh
$ sudo apt-get install -y docker.io # install docker
$ sudo usermod -aG docker $USER # add user to docker group
$ newgrp docker # activate group changes
```

> **NOTE**: Firefox build config can be checked official Firefox builds, navigating to `about:buildconfig` URL.

To document precisely my steps to bring up bots:
- [July 22, 2020: Setting up Ubuntu 18.04 buildbot on Azure](https://gist.github.com/aslushnikov/a4a3823b894888546e741899e69a1d8e)
- [July 22, 2020: Setting up Ubuntu 20.04 buildbot on Azure](https://gist.github.com/aslushnikov/a0bd658b575022e198443f856b5185e7)
