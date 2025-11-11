# Custom

## Installation

Follow [CONTRIBUTING.md](./CONTRIBUTING.md) guidelines.

## Build locally

Do these following commands into `packages/playwright` to build `.tgz` file.

```Bash
npm install
npm run build
npm pack
```

Integrate it into a real project through `npm`:

```Bash
npm install produced-file.tgz
```

And look like this in `package.json`:

```JSON
  "dependencies": {
    "playwright": "file:./playwright.tgz",
  }
```
