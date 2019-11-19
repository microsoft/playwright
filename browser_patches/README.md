# Compiling and Uploading Builds

### 1. Getting code

```sh
$ ./checkout.sh firefox/ # or ./checkout.sh webkit/
```

This command will create a `./firefox/checkout` folder that contains firefox GIT checkout.
Checkout current branch will be set to `pwdev` and it will have all additional changes
applied to the browser atop of the `./firefox/BASE_REVISION` version.

### 2. Compiling

> **NOTE** You might need to prepare your host environment according to browser build instructions:
> - [firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions)
> - [webkit](https://webkit.org/building-webkit/)

```sh
$ ./firefox/build.sh # or ./webkit/build.sh
```

### 3. Uploading builds to Azure CDN

> **NOTE** You should have `$AZ_ACCOUNT_KEY` and `$AZ_ACCOUNT_NAME` variables set in your environment.

```sh
$ ./upload.sh firefox/ # or ./upload.sh webkit/
```

This will package archives and upload builds to Azure CDN.
