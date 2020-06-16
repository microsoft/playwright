# playwright-cli

## Install

```
$ npm install --save-dev playwright-cli
```

## Usage

To open website in webkit browser:

```
$ npx playwright wk google.com
```

Other options:

```
Usage: playwright [options] [command]
  -V, --version                output the version number
  -b, --browser <browserType>  browser to use, one of cr, chromium, ff, firefox, wk, webkit (default: "chromium")
  --headless                   run in headless mode (default: false)
  --device <deviceName>        emulate device, for example  "iPhone 11"
  -h, --help                   display help for command

Commands:
  open [url]                   open page in browser specified via -b, --browser
  cr [url]                     open page in Chromium browser
  ff [url]                     open page in Firefox browser
  wk [url]                     open page in WebKit browser
  help [command]               display help for command
```
