# Setting Up Build Bots

This document describes setting up bots infrastructure to produce
browser builds.

We currently have 4 build bots that produce 6 builds
- **[bot-linux]** Ubuntu 18.04 machine
    - builds: `Webkit-Linux`, `Firefox-Linux`
- **[bot-mac-10.14]** Mac 10.14 machine
    - builds: `WebKit-mac-10.14`, `Firefox-Mac`
- **[bot-mac-10.15]** machine
    - builds: `WebKit-mac-10.15`
- **[bot-windows]** Windows machine
    - builds: `Firefox-win32`

# bot-windows

## Setting Up Host Machine

### 1. Prepare machine to compile firefox

Follow instructions on [Building Firefox for Windows](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Windows_Prerequisites). Get the checkout with mercurial and run "./mach bootstrap" from mercurial root.

After this step, you should have `c:\mozilla-build` folder
and `c:\mozilla-source` folder with firefox checkout.

> **NOTE:** No spaces or quotes are allowed here!

### 2. Install azure-cli

Install [azure-cli](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-windows?view=azure-cli-latest) for windows using MS Installer

### 3. Export "az" to the mingw world

Run `cmd` as administrator and run the following line:

```
> echo cmd.exe /c "\"C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd\" $1 $2 $3 $4 $5 $6 $7 $8 $9 ${10} ${11} ${12} ${13} ${14} ${15} ${16}" > "%SYSTEMROOT%\az"
```

This command will create a `c:\Windows\az` file that will call azure-cli with passed parameters (Not the most beautiful solution, but it works!)


### 4. Provide CDN credentials to mingw env

Edit `c:\mozilla-build\start-shell.bat` and add two lines in the beginning:

```bat
SET AZ_ACCOUNT_NAME=<account-name>
SET AZ_ACCOUNT_KEY=<account-key>
```

change `<account-name>` and `<account-key>` with relevant keys/names.

### 5. Checkout PlayWright to /c/

Run `c:\mozilla-build\start-shell.bat` and checkout PlayWright repo to `/c/playwright`.

## Running Build Loop

1. Launch `c:\mozilla-build/start-shell.bat`
2. Run `/c/playwright/browser_patches/buildbots/buildbot-windows.sh`
3. Disable "QuickEdit" terminal mode to avoid [terminal freezing and postponing builds](https://stackoverflow.com/questions/33883530/why-is-my-command-prompt-freezing-on-windows-10)
