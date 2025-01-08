# Playwright CLI

## `playwright ls`

List installed browsers.

### Usage

```sh
npx playwright ls
```

### Description

The `playwright ls` command lists all installed browsers along with their versions and installation locations.

### Example

```sh
$ npx playwright ls
Browser: chromium
  Version: 91.0.4472.124
  Install location: /path/to/chromium

Browser: firefox
  Version: 89.0
  Install location: /path/to/firefox

Browser: webkit
  Version: 14.2
  Install location: /path/to/webkit
```

## `npx playwright install --list`

List installed browsers after installing them.

### Usage

```sh
npx playwright install --list
```

### Description

The `--list` option for the `npx playwright install` command lists all installed browsers along with their versions and installation locations after installing them.

### Example

```sh
$ npx playwright install --list
Installing browsers...
Browser: chromium
  Version: 91.0.4472.124
  Install location: /path/to/chromium

Browser: firefox
  Version: 89.0
  Install location: /path/to/firefox

Browser: webkit
  Version: 14.2
  Install location: /path/to/webkit
```
