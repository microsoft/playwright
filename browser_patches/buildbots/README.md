# Setting Up Build Bots

We currently have 4 build bots that produce 6 builds
- **[buildbot-linux]** Ubuntu 18.04 machine
    - builds: `Webkit-Linux`, `Firefox-Linux`
- **[buildbot-mac-10.14]** Mac 10.14 machine
    - builds: `WebKit-mac-10.14`, `Firefox-Mac`
- **[buildbot-mac-10.15]** machine
    - builds: `WebKit-mac-10.15`
- **[buildbot-windows]** Windows 10 machine
    - builds: `Firefox-win32`, `Firefox-win64`

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
  - [Setting Up Browser Toolchains](#setting-up-browser-toolchains-2)
  - [Setting Bot Environment](#setting-bot-environment-2)
  - [Running Build Loop](#running-build-loop-2)


# Windows

## Setting Up Browser Toolchains

We currently only build firefox on Windows. Follow instructions on [Building Firefox for Windows](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Windows_Prerequisites). Get the checkout with mercurial and run "./mach bootstrap" from mercurial root.

After this step, you should have `c:\mozilla-build` folder
and `c:\mozilla-source` folder with firefox checkout.

## Setting Bot Environment

### 1. Install azure-cli

Install [azure-cli](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-windows?view=azure-cli-latest) for windows using MS Installer

### 2. Export "az" to the mingw world

Run `cmd` as administrator and run the following line:

```
> echo cmd.exe /c "\"C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd\" $1 $2 $3 $4 $5 $6 $7 $8 $9 ${10} ${11} ${12} ${13} ${14} ${15} ${16}" > "%SYSTEMROOT%\az"
```

This command will create a `c:\Windows\az` file that will call azure-cli with passed parameters (Not the most beautiful solution, but it works!)


### 3. Set custom env variables to mingw env

Edit `c:\mozilla-build\start-shell.bat` and add the following lines in the beginning:

```bat
SET AZ_ACCOUNT_NAME=<account-name>
SET AZ_ACCOUNT_KEY=<account-key>
SET TELEGRAM_BOT_KEY=<bot_key>
```

change `<account-name>` and `<account-key>` with relevant keys/names.

> **NOTE:** No spaces or quotes are allowed here!

### 4. Checkout PlayWright to /c/

Run `c:\mozilla-build\start-shell.bat` and checkout PlayWright repo to `/c/playwright`.

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

```plist
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
